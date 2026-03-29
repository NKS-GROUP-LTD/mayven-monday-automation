"""
Workspace Backfill — Phase 1 (Workspace-Wide)

Queries ALL boards in Monday.com Workspace 5398602.
For each board that:
  1. Does NOT start with "Subitems of"
  2. Has a column titled "Trigger" (type: status)
  3. Has at least one item where metadata_synced is NOT checked
→ Creates any missing metadata columns + populates all unsynced items.

Replaces the CSV-based approach — covers the entire workspace.
"""

import csv
import importlib.util
import json
import logging
import os
import sys
import time
from typing import Optional

import requests

# ── Config ────────────────────────────────────────────────────────────────────

API_URL = "https://api.monday.com/v2"
API_VERSION = "2025-01"
TOKEN = os.environ.get("MONDAY_API_TOKEN", "")
WORKSPACE_ID = "5398602"

# Boards that must NEVER be modified by any script or automation.
BOARD_BLACKLIST = {
    "18400570216",  # 🌶️ Mayven Hub- All Tasks🌶️ — read-only master board
}

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# ── API helpers ───────────────────────────────────────────────────────────────


def get_headers() -> dict:
    return {
        "Authorization": TOKEN,
        "Content-Type": "application/json",
        "API-Version": API_VERSION,
    }


def api_call(query: str, variables: Optional[dict] = None) -> dict:
    payload: dict = {"query": query}
    if variables:
        payload["variables"] = variables

    backoff = 1
    for attempt in range(6):
        resp = requests.post(API_URL, json=payload, headers=get_headers(), timeout=30)
        if resp.status_code == 429:
            wait = min(backoff, 30)
            log.warning(f"  Rate limited. Waiting {wait}s…")
            time.sleep(wait)
            backoff *= 2
            continue
        resp.raise_for_status()
        data = resp.json()
        if "errors" in data:
            err = str(data["errors"])
            if "complexity" in err.lower() or "rate" in err.lower():
                wait = min(backoff, 30)
                log.warning(f"  Complexity error. Waiting {wait}s…")
                time.sleep(wait)
                backoff *= 2
                continue
            raise RuntimeError(f"API error: {data['errors']}")
        return data
    raise RuntimeError("Max retries exceeded")


# ── Board discovery ───────────────────────────────────────────────────────────


def fetch_workspace_boards() -> list[dict]:
    """Page through all boards in workspace 5398602."""
    all_boards = []
    page = 1
    page_size = 100

    log.info(f"Fetching all boards in Workspace {WORKSPACE_ID}…")
    while True:
        query = """
        query ($wsId: [ID!], $page: Int, $limit: Int) {
          boards(workspace_ids: $wsId, page: $page, limit: $limit, order_by: created_at) {
            id
            name
            state
            board_kind
            columns { id title type }
          }
        }
        """
        data = api_call(query, {
            "wsId": [WORKSPACE_ID],
            "page": page,
            "limit": page_size,
        })
        boards = data.get("data", {}).get("boards", [])
        if not boards:
            break
        all_boards.extend(boards)
        log.info(f"  Page {page}: {len(boards)} boards (total: {len(all_boards)})")
        if len(boards) < page_size:
            break
        page += 1
        time.sleep(0.3)

    log.info(f"Total boards fetched: {len(all_boards)}")
    return all_boards


def board_qualifies(board: dict) -> tuple[bool, str]:
    """
    Returns (qualifies, reason).
    A board qualifies if:
    - Not in BOARD_BLACKLIST
    - State is active (not archived/deleted)
    - Name does NOT start with "Subitems of"
    - Has a column titled "Trigger" with type "status"
    """
    if board.get("id") in BOARD_BLACKLIST:
        return False, "blacklisted"
    if board.get("state") == "archived":
        return False, "archived"
    if board.get("name", "").startswith("Subitems of"):
        return False, "subitems board"
    columns = board.get("columns", [])
    has_trigger = any(
        c["title"].lower() == "trigger" and c["type"] == "status"
        for c in columns
    )
    if not has_trigger:
        return False, "no Trigger column"
    return True, "ok"


# ── Quick check for unsynced items ────────────────────────────────────────────


def has_unsynced_items(board_id: str, board_columns: list[dict]) -> bool:
    """
    Returns True if the board needs backfill:
    - No metadata_synced column exists yet, OR
    - At least one item has metadata_synced unchecked (raw value is null/"")
    Fetches the first page of items and checks the synced column value directly.
    """
    synced_col = next(
        (c for c in board_columns if c["title"].lower() == "metadata_synced"),
        None,
    )
    if not synced_col:
        return True  # column doesn't exist → needs backfill

    # Fetch a sample of items and check their synced values
    query = """
    query ($boardId: [ID!], $colId: ID!) {
      boards(ids: $boardId) {
        items_page(limit: 50) {
          items {
            id
            column_values(ids: [$colId]) { id value }
          }
        }
      }
    }
    """
    try:
        data = api_call(query, {"boardId": [board_id], "colId": synced_col["id"]})
        items = (
            data.get("data", {})
            .get("boards", [{}])[0]
            .get("items_page", {})
            .get("items", [])
        )
        if not items:
            return False  # no items at all → nothing to backfill

        for item in items:
            col_val = (item.get("column_values") or [{}])[0].get("value")
            if col_val:
                try:
                    checked = json.loads(col_val).get("checked") is True
                    if not checked:
                        return True
                except Exception:
                    return True  # can't parse → assume needs backfill
            else:
                return True  # null value = unchecked
        return False  # all sampled items are synced
    except Exception as e:
        log.warning(f"  Could not check sync status for board {board_id}: {e} — assuming unsynced")
        return True


# ── Standardizer loader ───────────────────────────────────────────────────────


def load_standardizer():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    spec = importlib.util.spec_from_file_location(
        "monday_standardizer",
        os.path.join(script_dir, "monday_standardizer.py"),
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# ── Main ──────────────────────────────────────────────────────────────────────


def main():
    log.info("=" * 65)
    log.info("Workspace Backfill — Scanning all boards in Workspace 5398602")
    log.info("=" * 65)

    all_boards = fetch_workspace_boards()

    # Filter qualifying boards
    qualifying = []
    skip_counts: dict[str, int] = {}

    for board in all_boards:
        ok, reason = board_qualifies(board)
        if ok:
            qualifying.append(board)
        else:
            skip_counts[reason] = skip_counts.get(reason, 0) + 1

    log.info(f"\nQualifying boards (active + has Trigger column): {len(qualifying)}")
    for reason, count in sorted(skip_counts.items()):
        log.info(f"  Skipped — {reason}: {count}")

    # Check for unsynced items
    log.info("\nChecking for unsynced items…")
    to_process = []
    for board in qualifying:
        if has_unsynced_items(board["id"], board.get("columns", [])):
            to_process.append(board)
            log.info(f"  → [{board['id']}] {board['name']!r} has unsynced items")
        else:
            log.info(f"  ✓ [{board['id']}] {board['name']!r} already fully synced")
        time.sleep(0.2)

    log.info(f"\nBoards needing backfill: {len(to_process)}")
    if not to_process:
        log.info("Nothing to do — workspace is fully synced!")
        return

    # Load standardizer
    log.info("Loading standardizer…")
    std = load_standardizer()

    # Run Phase 1 on each board
    successes = 0
    failures = []
    total = len(to_process)

    log.info("\n" + "=" * 65)
    log.info("Starting backfill…")
    log.info("=" * 65)

    for idx, board in enumerate(to_process, start=1):
        board_id = board["id"]
        board_name = board["name"]
        try:
            items_updated, columns_created, error = std.process_board(
                TOKEN, board_id, board_name, idx, total
            )
            if error:
                log.error(f"  ✗ FAILED: {error}")
                failures.append({"board_id": board_id, "board_name": board_name, "error": error})
            else:
                successes += 1
                log.info(f"  ✓ Done — {items_updated} items, {columns_created} columns created")
        except Exception as e:
            log.error(f"  ✗ EXCEPTION: {e}")
            failures.append({"board_id": board_id, "board_name": board_name, "error": str(e)})

    # Summary
    log.info("")
    log.info("=" * 65)
    log.info("WORKSPACE BACKFILL COMPLETE")
    log.info(f"  Total boards scanned:   {len(all_boards)}")
    log.info(f"  Qualifying boards:      {len(qualifying)}")
    log.info(f"  Boards backfilled:      {successes}")
    log.info(f"  Failures:               {len(failures)}")
    if failures:
        log.warning("Failed boards:")
        for f in failures:
            log.warning(f"  [{f['board_id']}] {f['board_name']}: {f['error']}")

    # Save failures
    if failures:
        out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "failed_boards.csv")
        with open(out_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["board_id", "board_name", "error"])
            writer.writeheader()
            writer.writerows(failures)
        log.info(f"Failures saved to: {out_path}")

    log.info("=" * 65)


if __name__ == "__main__":
    main()
