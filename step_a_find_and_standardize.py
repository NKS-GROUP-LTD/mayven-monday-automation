"""
Step A — Find additional boards by name and run Phase 1 standardizer on them.

Searches Monday.com for 14 boards/templates by name,
then runs the same standardizer logic on each found board.
"""

import json
import sys
import time
import logging
import importlib.util
from typing import Optional

import requests

# ── Config ───────────────────────────────────────────────────────────────────

API_URL = "https://api.monday.com/v2"
API_VERSION = "2025-01"
TOKEN = os.environ.get("MONDAY_API_TOKEN", "")

TARGET_NAMES = [
    "📊A/B Tests template",
    "15% OFF חדש template",
    "🎀 Wellness Club Y👑 template",
    "Accessories - Template",
    "Sample - Template",
    "Edible - Template",
    "Pr Box - Template",
    "טמפלט גאמיז template",
    "השקת מוצר חדש template",
    "טמפלט- פיתוחים חדשים template",
    "טמפלט- פיתוחים חדשים מנהלים template",
    "Mini-Cart (One-Step Bundle Upgrade)",
    "PDP Variant Change",
    "Tabbed Mobile Navigation Structure",
]

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


# ── Search boards by name ─────────────────────────────────────────────────────

def fetch_all_boards() -> list[dict]:
    """Paginate through all boards in the workspace and return them."""
    all_boards = []
    page = 1
    page_size = 100

    log.info("Fetching all boards from workspace (paginating)…")
    while True:
        query = """
        query ($page: Int, $limit: Int) {
          boards(page: $page, limit: $limit, order_by: created_at) {
            id
            name
            state
            board_kind
          }
        }
        """
        data = api_call(query, {"page": page, "limit": page_size})
        boards = data.get("data", {}).get("boards", [])
        if not boards:
            break
        all_boards.extend(boards)
        log.info(f"  Page {page}: fetched {len(boards)} boards (total so far: {len(all_boards)})")
        if len(boards) < page_size:
            break
        page += 1
        time.sleep(0.3)

    log.info(f"Total boards fetched: {len(all_boards)}")
    return all_boards


def find_all_target_boards() -> dict[str, list[dict]]:
    """Returns dict: name → list of matching boards (case-insensitive match)."""
    all_boards = fetch_all_boards()

    # Build lowercase lookup
    target_lower = {name.lower(): name for name in TARGET_NAMES}
    results: dict[str, list[dict]] = {name: [] for name in TARGET_NAMES}

    for board in all_boards:
        board_name_lower = board["name"].lower()
        if board_name_lower in target_lower:
            original_name = target_lower[board_name_lower]
            results[original_name].append(board)

    # Log results
    for name, boards in results.items():
        if boards:
            for b in boards:
                log.info(f"  ✓ Found: [{b['id']}] {b['name']} (kind={b['board_kind']}, state={b['state']})")
        else:
            log.warning(f"  ✗ Not found: {name}")

    return results


# ── Inline standardizer (reuses monday_standardizer.py logic) ─────────────────

def load_standardizer():
    """Dynamically load monday_standardizer module."""
    import os
    script_dir = os.path.dirname(os.path.abspath(__file__))
    spec = importlib.util.spec_from_file_location(
        "monday_standardizer",
        os.path.join(script_dir, "monday_standardizer.py")
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    log.info("=" * 60)
    log.info("Step A — Searching for 14 target boards")
    log.info("=" * 60)

    found_map = find_all_target_boards()

    # Collect unique board IDs to process
    board_ids_to_process: dict[str, str] = {}  # id → name
    not_found: list[str] = []

    for name, boards in found_map.items():
        if not boards:
            not_found.append(name)
        else:
            for b in boards:
                if b["id"] not in board_ids_to_process:
                    board_ids_to_process[b["id"]] = b["name"]

    log.info("")
    log.info("=" * 60)
    log.info(f"Found {len(board_ids_to_process)} unique boards to standardize")
    if not_found:
        log.warning(f"NOT FOUND ({len(not_found)}):")
        for n in not_found:
            log.warning(f"  - {n}")
    log.info("=" * 60)

    if not board_ids_to_process:
        log.error("No boards found — nothing to do.")
        sys.exit(1)

    # Load standardizer
    log.info("Loading standardizer…")
    std = load_standardizer()

    # Run Phase 1 on each found board
    successes = 0
    failures = []

    total = len(board_ids_to_process)
    for idx, (board_id, board_name) in enumerate(board_ids_to_process.items(), start=1):
        log.info("")
        try:
            items_updated, columns_created, error = std.process_board(
                TOKEN, board_id, board_name, idx, total
            )
            if error:
                log.error(f"  ✗ FAILED: {error}")
                failures.append({"board_id": board_id, "board_name": board_name, "error": error})
            else:
                successes += 1
                log.info(f"  ✓ Done — items_updated={items_updated}, columns_created={columns_created}")
        except Exception as e:
            log.error(f"  ✗ FAILED (exception): {e}")
            failures.append({"board_id": board_id, "board_name": board_name, "error": str(e)})

    # Summary
    log.info("")
    log.info("=" * 60)
    log.info("STEP A COMPLETE")
    log.info(f"  Boards processed:  {successes}")
    log.info(f"  Failures:          {len(failures)}")
    if failures:
        log.warning("Failed boards:")
        for f in failures:
            log.warning(f"  [{f['board_id']}] {f['board_name']}: {f['error']}")
    log.info("=" * 60)

    # Summary of found/not-found
    log.info("")
    log.info("SEARCH SUMMARY:")
    for name, boards in found_map.items():
        if boards:
            ids = ", ".join(b["id"] for b in boards)
            log.info(f"  ✓ {name!r} → {ids}")
        else:
            log.info(f"  ✗ {name!r} → NOT FOUND")


if __name__ == "__main__":
    main()
