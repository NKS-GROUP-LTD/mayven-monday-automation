# Monday.com Board Standardization — Final Execution Plan
## Ready for Claude Code

---

## Locked Decisions

| Parameter | Value |
|-----------|-------|
| Monday Domain | `mayven-team.monday.com` |
| Total Boards | 160 |
| Board List | `board_ids.csv` (attached) |
| Board Name column | Text, API-populated |
| Group Name column | Text, API-populated + webhook on group move |
| Link to Item column | Link (clickable), API-populated |
| Guardrail column | Checkbox `metadata_synced` |
| Phase 1 engine | Python script, runs locally via Claude Code |
| Phase 2 engine | Supabase Edge Function on existing project |
| Supabase project | `mayven-meeting-notes` (ref: `syrhxhytlkcnakicnyde`, NKS GROUP / Pro) |
| Make.com | **NOT USED** — $0 ongoing cost |

---

## Phase 1: Claude Code Prompt — Bulk Retroactive Update

### Context
160 Monday.com boards at `mayven-team.monday.com` need 4 metadata columns added and populated for all existing items. A CSV file `board_ids.csv` contains all board IDs and names. This is a one-time operation.

### Goal
Build `monday_standardizer.py` that:

1. **Reads** `board_ids.csv` (columns: `board_id`, `board_name`)

2. **For each board**, check if these 5 columns exist (match by column **title**):
   - "Board Name" → type: `text`
   - "Group Name" → type: `text`
   - "Link to Item" → type: `link`
   - "Trigger" → type: `status` (used by Phase 2 for manual re-sync)
   - "metadata_synced" → type: `checkbox`
   - Create missing ones via `create_column` mutation

3. **Paginate all items** (use `items_page` with cursor-based pagination, 100 items per page)

4. **For each item**, skip if `metadata_synced` is already checked. Otherwise, update with `change_multiple_column_values`:
   - `Board Name` → board name string (from CSV, no extra API call needed)
   - `Group Name` → item's group title (from the `group { title }` field on the item query)
   - `Link to Item` → `{"url": "https://mayven-team.monday.com/boards/{board_id}/pulses/{item_id}", "text": "Link to Item"}`
   - `metadata_synced` → `{"checked": "true"}`

5. **Log progress**: `[42/160] "Marketing Pipeline" — 350 items updated, 2 columns created`

6. **Write summary** at end: total boards processed, items updated, errors, and save failures to `failed_boards.csv`

### Constraints

**API:**
- `requests` library, direct GraphQL to `https://api.monday.com/v2`
- Header: `API-Version: 2025-01`, `Authorization: {MONDAY_API_TOKEN}`
- Token from env var `MONDAY_API_TOKEN`
- **Do NOT use `moncli`** or any wrapper library
- 500ms default sleep between mutations
- On 429 or complexity error → exponential backoff (1s → 2s → 4s → 8s → 16s → 30s max, 5 retries)
- Query only needed fields to minimize complexity points

**Column matching:**
- Match by TITLE not ID (IDs differ per board)
- If column with same title but wrong type exists → log warning, skip board
- Link column JSON: `{"url": "...", "text": "Link to Item"}`
- Checkbox JSON: `{"checked": "true"}`

**Safety:**
- Never modify existing data — only fill empty/unsynced
- Never delete anything
- Skip archived boards (check `state` field)
- `--boards 123,456` flag for testing on specific boards
- `--resume` flag to retry only boards from `failed_boards.csv`

### Verify
1. Test on boards: `python monday_standardizer.py --boards 18390477104,18392904489,18393146547`
2. Check 5 random items: Board Name correct? Group Name correct? Link opens correct item?
3. Run again on same boards → "0 items need updating"
4. Full run: `python monday_standardizer.py`

---

## Phase 2: Claude Code Prompt — Supabase Edge Function

### Context
After Phase 1, new items and group moves need automatic handling. Monday.com webhooks call a Supabase Edge Function deployed on the existing `mayven-meeting-notes` project (ref: `syrhxhytlkcnakicnyde`). The Edge Function is stateless — it does NOT touch the database.

### Goal
Build two deliverables:

**A) Edge Function: `monday-metadata-sync`**

```
supabase/functions/monday-metadata-sync/index.ts
```

TypeScript function (Deno runtime) that:

1. Handles Monday.com webhook **challenge** (first request sends `{"challenge": "..."}` — respond with same value)

2. On normal webhook POST:
   - Extract `event.boardId`, `event.pulseId` (item ID), `event.type`, `event.columnId` from payload
   - **Trigger 1 (create_pulse):** New item created → set Board Name + Group Name + Link to Item
   - **Trigger 2 (change_column_values on "Trigger" column):** Status changed on "Trigger" column → set Board Name + Group Name + Link to Item → then **clear the Trigger column back to empty** (so it can be triggered again)
   - **Trigger 3 (change_column_values on group):** Item moved between groups → update Group Name only
   - For all triggers: construct URL as `https://mayven-team.monday.com/boards/{boardId}/pulses/{itemId}`
   - Use `change_multiple_column_values` mutation
   - Return 200

   **IMPORTANT — Loop prevention:** When the Edge Function writes back to Monday (updating columns), that mutation could re-trigger the webhook. The function MUST:
   - Ignore webhook events where `event.columnId` matches Board Name, Group Name, Link to Item, or metadata_synced columns
   - Only process events for `create_pulse`, group changes, or the "Trigger" status column

3. Environment variables (set via `supabase secrets set`):
   - `MONDAY_API_TOKEN`

4. Deploy command: `supabase functions deploy monday-metadata-sync --no-verify-jwt`

**Trigger Logic:**
The Edge Function handles 3 triggers:

| # | Trigger | Monday Event | What Updates |
|---|---------|-------------|-------------|
| 1 | Item created | `create_item` | Board Name + Group Name + Link to Item |
| 2 | Status column "Trigger" changed to any value | `change_column_values` on "Trigger" column | Board Name + Group Name + Link to Item (re-sync) |
| 3 | Item moved to group | `change_column_values` on group | Group Name only |

For Trigger 2: The column is named "Trigger" (type: status). It exists in templates. When ANY label is selected, it fires. After updating the metadata columns, the Edge Function **resets the Trigger status back to empty** (clears it) so it can be triggered again later.

The Edge Function does NOT create columns — they already exist from Phase 1 + templates.

**B) Webhook registration script: `register_webhooks.py`**

Python script that:
1. Reads `board_ids.csv`
2. For each board, registers webhooks via Monday.com `create_webhook` mutation:
   - Event `create_item` → URL: `https://syrhxhytlkcnakicnyde.supabase.co/functions/v1/monday-metadata-sync`
   - Event `change_column_values` → same URL (covers both Trigger column changes AND group moves)
3. Logs: `[42/160] Webhooks registered for "Marketing Pipeline"`
4. Saves results to `webhook_registration_log.csv`

### Constraints
- Edge Function must respond within 10 seconds
- Use `fetch()` for Monday.com API (no npm packages)
- Must be idempotent — duplicate calls are safe
- Log errors to console (visible in Supabase dashboard)
- The function URL: `https://syrhxhytlkcnakicnyde.supabase.co/functions/v1/monday-metadata-sync`

### Verify
1. Deploy edge function
2. Create test item in Monday → 4 columns populated within 5s?
3. Move item to different group → Group Name updated?
4. Check Supabase logs for successful execution
5. Create another item → metadata_synced checked?

---

## Phase 3: Template Setup (Manual — Aral)

For every board template used to create new boards:
1. Add "Board Name" (text)
2. Add "Group Name" (text)
3. Add "Link to Item" (link)
4. Add "Trigger" (status) — for manual re-sync trigger
5. Add "metadata_synced" (checkbox, can hide from view)

When new boards are created from templates → run `register_webhooks.py` with the new board ID.

---

## Execution Order

```
Step 1: Kobi provides MONDAY_API_TOKEN to Claude Code
        → Must be from a user with access to all 160 boards

Step 2: Claude Code builds + tests Phase 1 script on 3 boards
        → Kobi verifies results in Monday

Step 3: Claude Code runs Phase 1 on all 160 boards
        → ~30-45 min runtime

Step 4: Claude Code builds + deploys Phase 2 Edge Function to mayven-meeting-notes
        → Sets MONDAY_API_TOKEN secret via supabase secrets set

Step 5: Claude Code runs webhook registration on all 160 boards
        → ~5 min runtime

Step 6: Kobi tests end-to-end: create item → verify auto-population

Step 7: Aral updates board templates (Phase 3)
```

## Cost: $0/month forever
