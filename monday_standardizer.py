"""
Monday.com Board Standardizer — Phase 1
Adds metadata columns to boards and populates them for all existing items.
"""

import csv
import json
import os
import sys
import time
import argparse
import logging
from typing import Optional

import requests

# ── Config ──────────────────────────────────────────────────────────────────

API_URL = "https://api.monday.com/v2"
API_VERSION = "2025-01"
MONDAY_DOMAIN = "mayven-team.monday.com"
DEFAULT_SLEEP = 0.5  # seconds between mutations

# Boards that must NEVER be modified by any script or automation.
BOARD_BLACKLIST = {
    "18400570216",  # 🌶️ Mayven Hub- All Tasks🌶️ — read-only master board
}
MAX_RETRIES = 5
ITEMS_PER_PAGE = 100

REQUIRED_COLUMNS = {
    "Board Name": "text",
    "Group Name": "text",
    "Link to Item": "link",
    "Trigger": "status",
    "metadata_synced": "checkbox",
}

# ── Logging ─────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# ── API helpers ─────────────────────────────────────────────────────────────


def get_headers(token: str) -> dict:
    return {
        "Authorization": token,
        "Content-Type": "application/json",
        "API-Version": API_VERSION,
    }


def api_call(token: str, query: str, variables: Optional[dict] = None) -> dict:
    """Execute a Monday.com GraphQL call with retry + exponential backoff."""
    payload: dict = {"query": query}
    if variables:
        payload["variables"] = variables

    headers = get_headers(token)
    backoff = 1

    for attempt in range(MAX_RETRIES + 1):
        resp = requests.post(API_URL, json=payload, headers=headers, timeout=30)

        # Rate limit
        if resp.status_code == 429:
            wait = min(backoff, 30)
            log.warning(f"  Rate limited (429). Waiting {wait}s… (attempt {attempt+1})")
            time.sleep(wait)
            backoff *= 2
            continue

        resp.raise_for_status()
        data = resp.json()

        # Complexity error
        if "errors" in data:
            error_msg = str(data["errors"])
            if "complexity" in error_msg.lower() or "rate" in error_msg.lower():
                wait = min(backoff, 30)
                log.warning(f"  Complexity/rate error. Waiting {wait}s… (attempt {attempt+1})")
                time.sleep(wait)
                backoff *= 2
                continue
            # Real error — raise
            raise RuntimeError(f"Monday API error: {data['errors']}")

        return data

    raise RuntimeError(f"Max retries ({MAX_RETRIES}) exceeded")


# ── Core logic ──────────────────────────────────────────────────────────────


def get_board_columns(token: str, board_id: str) -> tuple[dict, str]:
    """Returns (column_map {title: {id, type}}, board_state)."""
    query = """
    query ($boardId: [ID!]!) {
      boards(ids: $boardId) {
        state
        columns { id title type }
      }
    }
    """
    data = api_call(token, query, {"boardId": [board_id]})
    board = data["data"]["boards"][0]
    state = board["state"]
    col_map = {}
    for c in board["columns"]:
        col_map[c["title"]] = {"id": c["id"], "type": c["type"]}
    return col_map, state


def create_column(token: str, board_id: str, title: str, col_type: str) -> str:
    """Create a column and return its ID."""
    # Monday API column types mapping
    type_map = {
        "text": "text",
        "link": "link",
        "status": "status",
        "checkbox": "checkbox",
    }
    mutation = """
    mutation ($boardId: ID!, $title: String!, $columnType: ColumnType!) {
      create_column(board_id: $boardId, title: $title, column_type: $columnType) {
        id
      }
    }
    """
    data = api_call(token, mutation, {
        "boardId": board_id,
        "title": title,
        "columnType": type_map[col_type],
    })
    col_id = data["data"]["create_column"]["id"]
    log.info(f"    Created column '{title}' (type={col_type}, id={col_id})")
    time.sleep(DEFAULT_SLEEP)
    return col_id


def ensure_columns(token: str, board_id: str, existing_columns: dict) -> Optional[dict]:
    """
    Ensure all required columns exist. Returns column ID map or None if board should be skipped.
    column_ids = {"Board Name": "col_id", "Group Name": "col_id", ...}
    """
    column_ids = {}
    created_count = 0

    for title, expected_type in REQUIRED_COLUMNS.items():
        if title in existing_columns:
            existing = existing_columns[title]
            # Type check — Monday types may differ slightly
            if not is_type_compatible(existing["type"], expected_type):
                log.warning(
                    f"    ⚠ Column '{title}' exists but type is '{existing['type']}' "
                    f"(expected '{expected_type}'). Skipping board."
                )
                return None
            column_ids[title] = existing["id"]
        else:
            col_id = create_column(token, board_id, title, expected_type)
            column_ids[title] = col_id
            created_count += 1

    return column_ids


def is_type_compatible(actual: str, expected: str) -> bool:
    """Check if Monday's column type matches our expected type."""
    # Monday API returns various type names; map common equivalents
    compat = {
        "text": ["text", "long_text"],
        "link": ["link"],
        "status": ["status", "color"],
        "checkbox": ["checkbox", "boolean"],
    }
    return actual.lower() in compat.get(expected, [expected])


def fetch_items_page(
    token: str, board_id: str, cursor: Optional[str] = None
) -> tuple[list[dict], Optional[str]]:
    """Fetch one page of items with group info. Returns (items, next_cursor)."""
    if cursor:
        query = """
        query ($cursor: String!) {
          next_items_page(cursor: $cursor, limit: 100) {
            cursor
            items {
              id
              group { title }
              column_values { id text value }
            }
          }
        }
        """
        data = api_call(token, query, {"cursor": cursor})
        page = data["data"]["next_items_page"]
    else:
        query = """
        query ($boardId: ID!) {
          boards(ids: [$boardId]) {
            items_page(limit: 100) {
              cursor
              items {
                id
                group { title }
                column_values { id text value }
              }
            }
          }
        }
        """
        data = api_call(token, query, {"boardId": board_id})
        page = data["data"]["boards"][0]["items_page"]

    items = page["items"]
    next_cursor = page.get("cursor")
    return items, next_cursor


def is_item_synced(item: dict, synced_col_id: str) -> bool:
    """Check if metadata_synced checkbox is checked."""
    for cv in item["column_values"]:
        if cv["id"] == synced_col_id:
            val = cv.get("value")
            if val:
                try:
                    parsed = json.loads(val)
                    return parsed.get("checked") in ["true", True]
                except (json.JSONDecodeError, TypeError):
                    pass
            return False
    return False


def update_item_metadata(
    token: str,
    board_id: str,
    item_id: str,
    board_name: str,
    group_title: str,
    column_ids: dict,
) -> None:
    """Set all metadata columns for a single item."""
    item_url = f"https://{MONDAY_DOMAIN}/boards/{board_id}/pulses/{item_id}"

    col_values = {
        column_ids["Board Name"]: board_name,
        column_ids["Group Name"]: group_title,
        column_ids["Link to Item"]: {"url": item_url, "text": "Link to Item"},
        column_ids["metadata_synced"]: {"checked": "true"},
    }

    mutation = """
    mutation ($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
      change_multiple_column_values(
        board_id: $boardId
        item_id: $itemId
        column_values: $columnValues
      ) {
        id
      }
    }
    """
    api_call(token, mutation, {
        "boardId": board_id,
        "itemId": item_id,
        "columnValues": json.dumps(col_values),
    })


def process_board(
    token: str, board_id: str, board_name: str, index: int, total: int
) -> tuple[int, int, Optional[str]]:
    """
    Process a single board. Returns (items_updated, columns_created, error_or_None).
    """
    log.info(f"[{index}/{total}] Processing \"{board_name}\" (board {board_id})")

    if board_id in BOARD_BLACKLIST:
        log.warning(f"  SKIPPED — board {board_id} is blacklisted")
        return 0, 0, None

    # Get existing columns + state
    try:
        existing_columns, state = get_board_columns(token, board_id)
    except Exception as e:
        return 0, 0, f"Failed to get board info: {e}"

    if state == "archived":
        log.info(f"  Skipping — board is archived")
        return 0, 0, None

    # Ensure columns
    column_ids = ensure_columns(token, board_id, existing_columns)
    if column_ids is None:
        return 0, 0, "Column type mismatch — skipped"

    columns_created = sum(
        1 for title in REQUIRED_COLUMNS if title not in existing_columns
    )

    # Paginate items
    items_updated = 0
    items_skipped = 0
    cursor = None
    first_page = True

    while True:
        try:
            items, cursor = fetch_items_page(
                token, board_id, cursor=None if first_page else cursor
            )
        except Exception as e:
            return items_updated, columns_created, f"Failed fetching items: {e}"

        if first_page and not cursor and not items:
            log.info(f"  No items found")
            break

        first_page = False

        for item in items:
            # Skip already synced
            if is_item_synced(item, column_ids["metadata_synced"]):
                items_skipped += 1
                continue

            group_title = item.get("group", {}).get("title", "")
            try:
                update_item_metadata(
                    token, board_id, item["id"], board_name, group_title, column_ids
                )
                items_updated += 1
                time.sleep(DEFAULT_SLEEP)
            except Exception as e:
                log.error(f"  Failed to update item {item['id']}: {e}")

        if not cursor:
            break

    log.info(
        f"  Done — {items_updated} items updated, {items_skipped} already synced, "
        f"{columns_created} columns created"
    )
    return items_updated, columns_created, None


# ── Main ────────────────────────────────────────────────────────────────────


def load_boards(csv_path: str) -> list[dict]:
    """Load board_id,board_name from CSV."""
    boards = []
    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            boards.append({
                "board_id": row["board_id"].strip(),
                "board_name": row["board_name"].strip().strip('"'),
            })
    return boards


def main():
    parser = argparse.ArgumentParser(description="Monday.com Board Standardizer — Phase 1")
    parser.add_argument(
        "--boards",
        help="Comma-separated board IDs to process (for testing)",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Retry only boards from failed_boards.csv",
    )
    parser.add_argument(
        "--csv",
        default="board_ids.csv",
        help="Path to board IDs CSV (default: board_ids.csv)",
    )
    args = parser.parse_args()

    token = os.environ.get("MONDAY_API_TOKEN")
    if not token:
        log.error("MONDAY_API_TOKEN environment variable not set")
        sys.exit(1)

    # Determine which boards to process
    if args.resume:
        boards = load_boards("failed_boards.csv")
        log.info(f"Resuming — {len(boards)} failed boards to retry")
    elif args.boards:
        # Filter CSV by specified IDs
        all_boards = load_boards(args.csv)
        target_ids = set(args.boards.split(","))
        boards = [b for b in all_boards if b["board_id"] in target_ids]
        # Add any IDs not in CSV with placeholder names
        found_ids = {b["board_id"] for b in boards}
        for bid in target_ids - found_ids:
            boards.append({"board_id": bid, "board_name": f"(board {bid})"})
        log.info(f"Testing mode — {len(boards)} boards selected")
    else:
        boards = load_boards(args.csv)
        log.info(f"Full run — {len(boards)} boards to process")

    total = len(boards)
    total_items_updated = 0
    total_columns_created = 0
    failed = []

    for i, board in enumerate(boards, 1):
        items_updated, cols_created, error = process_board(
            token, board["board_id"], board["board_name"], i, total
        )
        total_items_updated += items_updated
        total_columns_created += cols_created
        if error:
            failed.append({
                "board_id": board["board_id"],
                "board_name": board["board_name"],
                "error": error,
            })
            log.error(f"  ✗ Error: {error}")

    # Summary
    log.info("=" * 60)
    log.info(f"SUMMARY")
    log.info(f"  Boards processed: {total}")
    log.info(f"  Items updated:    {total_items_updated}")
    log.info(f"  Columns created:  {total_columns_created}")
    log.info(f"  Failures:         {len(failed)}")

    if failed:
        with open("failed_boards.csv", "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["board_id", "board_name", "error"])
            writer.writeheader()
            writer.writerows(failed)
        log.info(f"  Failed boards saved to failed_boards.csv")

    log.info("=" * 60)


if __name__ == "__main__":
    main()
