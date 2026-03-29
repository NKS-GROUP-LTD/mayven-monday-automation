"""
register_webhooks.py — Initial Bulk Webhook Registration (Phase 2 Bootstrap)

Queries ALL boards in Monday.com Workspace 5398602.
For each qualifying board (active, not "Subitems of…", has "Trigger" column):
  - Checks if our webhook URL is already registered for each event
  - Registers missing webhooks pointing to the Supabase Edge Function
  - Saves results to webhook_registration_log.csv

Run once to bootstrap. After this, monday-board-scanner (via pg_cron)
handles new boards automatically every 5 minutes.

Usage:
  python register_webhooks.py              # Register all qualifying boards
  python register_webhooks.py --dry-run    # Preview only
  python register_webhooks.py --boards 123,456  # Specific boards
"""

import argparse
import csv
import json
import logging
import os
import time
from typing import Optional

import requests

# ── Config ────────────────────────────────────────────────────────────────────

API_URL = "https://api.monday.com/v2"
API_VERSION = "2025-01"
TOKEN = os.environ.get("MONDAY_API_TOKEN", "")
WORKSPACE_ID = "5398602"

# Boards that must NEVER receive webhooks or be modified by any automation.
BOARD_BLACKLIST = {
    "18400570216",  # 🌶️ Mayven Hub- All Tasks🌶️ — read-only master board
}

WEBHOOK_URL = (
    "https://syrhxhytlkcnakicnyde.supabase.co/functions/v1/monday-metadata-sync"
)

WEBHOOK_EVENTS = [
    "create_item",
    "change_column_value",      # payload fires as "change_column_values"
    "item_moved_to_any_group",
    # note: move_item_to_board / move_pulse_into_board not in WebhookEventType enum (API v2025-01)
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


# ── Board discovery ───────────────────────────────────────────────────────────

def fetch_workspace_boards() -> list[dict]:
    """Page through all boards in workspace 5398602, including column info."""
    all_boards = []
    page = 1
    page_size = 100

    log.info(f"Fetching all boards in Workspace {WORKSPACE_ID}…")
    while True:
        query = """
        query ($wsId: [ID!], $page: Int, $limit: Int) {
          boards(workspace_ids: $wsId, page: $page, limit: $limit, order_by: created_at) {
            id name state
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


def board_qualifies(board: dict) -> bool:
    """Active board, not blacklisted, not 'Subitems of…', has a 'Trigger' status column."""
    if board.get("id") in BOARD_BLACKLIST:
        return False
    if board.get("state") != "active":
        return False
    if board.get("name", "").startswith("Subitems of"):
        return False
    return any(
        c["title"].lower() == "trigger" and c["type"] == "status"
        for c in board.get("columns", [])
    )


# ── Webhook management ────────────────────────────────────────────────────────

def get_existing_webhooks(board_id: str) -> set[str]:
    """Returns the set of already-registered events on a board (any URL).

    Note: API v2025-01 removed the 'url' field from Webhook type.
    We check by event name only — sufficient to prevent duplicate registrations.
    """
    query = """
    query ($boardId: ID!) {
      webhooks(board_id: $boardId) { event }
    }
    """
    try:
        data = api_call(query, {"boardId": board_id})
        webhooks = data.get("data", {}).get("webhooks", [])
        return {w["event"] for w in webhooks}
    except Exception as e:
        log.warning(f"  Could not fetch webhooks for board {board_id}: {e}")
        return set()


def create_webhook(board_id: str, event: str) -> Optional[str]:
    """Register one webhook. Returns webhook ID or None on failure."""
    query = """
    mutation ($boardId: ID!, $url: String!, $event: WebhookEventType!) {
      create_webhook(board_id: $boardId, url: $url, event: $event) {
        id
      }
    }
    """
    data = api_call(query, {"boardId": board_id, "url": WEBHOOK_URL, "event": event})
    return data.get("data", {}).get("create_webhook", {}).get("id")


def register_board(
    board: dict, index: int, total: int, dry_run: bool
) -> dict:
    """Register all webhook events for a board. Returns result summary."""
    board_id = board["id"]
    board_name = board["name"]
    log.info(f"[{index}/{total}] {board_name!r} ({board_id})")

    existing = get_existing_webhooks(board_id)
    registered = []
    skipped = []
    failed = []

    for event in WEBHOOK_EVENTS:
        if event in existing:
            skipped.append(event)
            log.info(f"    ↳ {event}: already registered")
            continue

        if dry_run:
            registered.append(event)
            log.info(f"    ↳ {event}: would register [DRY RUN]")
            continue

        try:
            webhook_id = create_webhook(board_id, event)
            registered.append(event)
            log.info(f"    ↳ {event}: ✓ registered (id={webhook_id})")
            time.sleep(0.3)
        except Exception as e:
            failed.append({"event": event, "error": str(e)})
            log.error(f"    ↳ {event}: ✗ FAILED — {e}")

    return {
        "board_id": board_id,
        "board_name": board_name,
        "registered": registered,
        "skipped": skipped,
        "failed": failed,
    }


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Register Monday.com webhooks for all qualifying boards in WS 5398602"
    )
    parser.add_argument("--dry-run", action="store_true", help="Preview without registering")
    parser.add_argument(
        "--boards", type=str, default="",
        help="Comma-separated board IDs to process (skips workspace scan)"
    )
    args = parser.parse_args()

    if args.dry_run:
        log.info("🔍 DRY RUN — no webhooks will be registered")

    # Build board list
    if args.boards:
        board_ids = [b.strip() for b in args.boards.split(",") if b.strip()]
        boards = [{"id": bid, "name": bid, "state": "active", "columns": [
            {"id": "trigger", "title": "Trigger", "type": "status"}
        ]} for bid in board_ids]
        log.info(f"Processing {len(boards)} board(s) from --boards flag")
    else:
        all_boards = fetch_workspace_boards()
        boards = [b for b in all_boards if board_qualifies(b)]
        skipped_count = len(all_boards) - len(boards)
        log.info(f"Qualifying boards: {len(boards)} (skipped {skipped_count})")

    log.info(f"Webhook URL: {WEBHOOK_URL}")
    log.info(f"Events per board: {', '.join(WEBHOOK_EVENTS)}")
    log.info("=" * 65)

    results = []
    total = len(boards)

    for idx, board in enumerate(boards, start=1):
        try:
            result = register_board(board, idx, total, args.dry_run)
            results.append(result)
        except Exception as e:
            log.error(f"[{idx}/{total}] Fatal error for board {board['id']}: {e}")
            results.append({
                "board_id": board["id"],
                "board_name": board["name"],
                "registered": [],
                "skipped": [],
                "failed": [{"event": "ALL", "error": str(e)}],
            })
        time.sleep(0.5)

    # ── Summary ────────────────────────────────────────────────────────────────

    total_reg = sum(len(r["registered"]) for r in results)
    total_skip = sum(len(r["skipped"]) for r in results)
    total_fail = sum(len(r["failed"]) for r in results)
    boards_failed = [r for r in results if r["failed"]]

    log.info("")
    log.info("=" * 65)
    log.info("WEBHOOK REGISTRATION COMPLETE" + (" [DRY RUN]" if args.dry_run else ""))
    log.info(f"  Boards processed:    {total}")
    log.info(f"  Webhooks registered: {total_reg}")
    log.info(f"  Already existed:     {total_skip}")
    log.info(f"  Failures:            {total_fail}")
    if boards_failed:
        log.warning("Failed:")
        for r in boards_failed:
            for f in r["failed"]:
                log.warning(f"  [{r['board_id']}] {r['board_name']} / {f['event']}: {f['error']}")
    log.info("=" * 65)

    # ── Save CSV log ───────────────────────────────────────────────────────────

    log_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "webhook_registration_log.csv")
    with open(log_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["board_id", "board_name", "event", "status", "error"])
        for r in results:
            for event in r["registered"]:
                writer.writerow([r["board_id"], r["board_name"], event, "registered", ""])
            for event in r["skipped"]:
                writer.writerow([r["board_id"], r["board_name"], event, "skipped", ""])
            for f in r["failed"]:
                writer.writerow([r["board_id"], r["board_name"], f["event"], "failed", f["error"]])

    log.info(f"Log saved to: {log_path}")


if __name__ == "__main__":
    main()
