# Phase 2 Deployment Instructions

## Prerequisites
- Supabase CLI installed: `npm install -g supabase` or `brew install supabase/tap/supabase`
- Logged in: `supabase login`
- Working directory: `C:/Claude Code/Projects/Mayven-Monday`

---

## Deployment Order

```
1. Set secrets
2. Deploy monday-metadata-sync   ← live webhook handler
3. Deploy monday-board-scanner   ← periodic new-board detector
4. Run register_webhooks.py      ← bootstrap existing boards
5. Run setup_pg_cron.sql         ← schedule recurring scanner
```

---

## Step 1 — Set secrets

```bash
supabase secrets set \
  MONDAY_API_TOKEN=eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjQ3NDkxNDg0NSwiYWFpIjoxMSwidWlkIjo2NzY1MzczOSwiaWFkIjoiMjAyNS0wMi0xOVQxNjoxNzo1MS4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6MTQ2NzU4OTUsInJnbiI6InVzZTEifQ.nNhrFWCcqejIjLqkxlNiiMwm72wQK_yNYlugrC5vxoY \
  MONDAY_USER_ID=67653739 \
  --project-ref syrhxhytlkcnakicnyde
```

---

## Step 2 — Deploy monday-metadata-sync

```bash
cd "C:/Claude Code/Projects/Mayven-Monday"
supabase functions deploy monday-metadata-sync --no-verify-jwt --project-ref syrhxhytlkcnakicnyde
```

Function URL: `https://syrhxhytlkcnakicnyde.supabase.co/functions/v1/monday-metadata-sync`

---

## Step 3 — Deploy monday-board-scanner

```bash
supabase functions deploy monday-board-scanner --no-verify-jwt --project-ref syrhxhytlkcnakicnyde
```

Function URL: `https://syrhxhytlkcnakicnyde.supabase.co/functions/v1/monday-board-scanner`

---

## Step 4 — Bootstrap webhook registration on all existing boards

```bash
# Dry run first (preview, no registrations)
python register_webhooks.py --dry-run

# Full run (~5-10 min for 169 boards)
python register_webhooks.py
```

Results saved to `webhook_registration_log.csv`

---

## Step 5 — Schedule recurring scanner (every 5 minutes)

Run `setup_pg_cron.sql` in:
**Supabase Dashboard → SQL Editor → New query → paste file → Run**

This schedules `monday-board-scanner` to run every 5 minutes via pg_cron.
After this, new boards added to the workspace are auto-detected and connected.

---

## Verify end-to-end

1. Create a new item in any Monday board
2. Wait ~5 seconds
3. Check: Board Name, Group Name, Link to Item populated?
4. Move item to a different group → Group Name updates?
5. Set "Trigger" status column to "Trigger" label → all metadata re-syncs?
6. Move item to another board → Board Name + Link update to new board?

---

## View logs

```bash
# Live log stream
supabase functions logs monday-metadata-sync --project-ref syrhxhytlkcnakicnyde

# Or: Supabase Dashboard → Edge Functions → select function → Logs tab
```

---

## Key env vars / secrets

| Secret | Value |
|--------|-------|
| MONDAY_API_TOKEN | API token (already set above) |
| MONDAY_USER_ID | `67653739` (Erel Yoggev — token owner, for loop prevention) |

---

## Architecture summary

```
New item created on any board
    ↓ Monday webhook
    ↓ monday-metadata-sync (Supabase Edge Function)
    → Populates: Board Name + Group Name + Link to Item

Item moved to group
    ↓ item_moved_to_any_group webhook
    → Updates: Group Name only

Item moved to another board
    ↓ move_pulse_into_board webhook
    → Updates: Board Name + Group Name + Link to Item (new board URL)

"Trigger" column set to "Trigger"
    ↓ change_column_values webhook
    → Re-syncs: Board Name + Group Name + Link to Item

New board added to workspace
    ↓ pg_cron → monday-board-scanner (every 5 min)
    → Registers webhooks + backfills existing items
```
