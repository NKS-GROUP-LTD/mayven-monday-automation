/**
 * monday-board-scanner — Supabase Edge Function (Deno)
 *
 * Auto-detects and connects new boards in Monday Workspace 5398602.
 * Runs every 5 minutes via pg_cron.
 *
 * For each board in the workspace:
 *   1. Skip "Subitems of…" boards and non-active boards
 *   2. Check if board has a "Trigger" column (type: status)
 *   3. Check if our webhook URL is already registered
 *   4. If not registered → register create_item + change_column_values +
 *      item_moved_to_any_group + move_pulse_into_board webhooks
 *   5. After registering webhooks → backfill any unsynced items
 *
 * Env vars:
 *   MONDAY_API_TOKEN  — API token
 */

const MONDAY_API_URL = "https://api.monday.com/v2";
const MONDAY_DOMAIN = "mayven-team.monday.com";
const MONDAY_API_VERSION = "2025-01";
const WORKSPACE_ID = "5398602";

/** Boards that must NEVER be modified or receive webhooks from any automation. */
const BOARD_BLACKLIST = new Set([
  "18400570216", // 🌶️ Mayven Hub- All Tasks🌶️ — read-only master board
]);

const METADATA_SYNC_URL =
  "https://syrhxhytlkcnakicnyde.supabase.co/functions/v1/monday-metadata-sync";

const WEBHOOK_EVENTS = [
  "create_item",
  "change_column_value",      // payload fires as "change_column_values"
  "item_moved_to_any_group",
  // note: move_item_to_board not in WebhookEventType enum (API v2025-01)
] as const;

// ── Monday API helper ─────────────────────────────────────────────────────────

async function callMonday(
  token: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const resp = await fetch(MONDAY_API_URL, {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
      "API-Version": MONDAY_API_VERSION,
    },
    body: JSON.stringify({ query, variables: variables ?? {} }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Monday HTTP ${resp.status}: ${text}`);
  }

  const data = (await resp.json()) as Record<string, unknown>;
  if (data.errors) {
    throw new Error(`Monday API error: ${JSON.stringify(data.errors)}`);
  }

  return data;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Column {
  id: string;
  title: string;
  type: string;
}

interface BoardRow {
  id: string;
  name: string;
  state: string;
  columns: Column[];
}

interface WebhookRow {
  id: string;
  event: string;
  // Note: 'url' field was removed in Monday API v2025-01
}

// ── Board discovery ───────────────────────────────────────────────────────────

async function fetchWorkspaceBoards(token: string): Promise<BoardRow[]> {
  const all: BoardRow[] = [];
  let page = 1;
  const limit = 100;

  while (true) {
    const data = await callMonday(
      token,
      `query ($wsId: [ID!], $page: Int, $limit: Int) {
         boards(workspace_ids: $wsId, page: $page, limit: $limit, order_by: created_at) {
           id name state
           columns { id title type }
         }
       }`,
      { wsId: [WORKSPACE_ID], page, limit },
    );

    const boards = (
      (data.data as Record<string, unknown>)?.boards as BoardRow[]
    ) ?? [];

    if (!boards.length) break;
    all.push(...boards);
    if (boards.length < limit) break;
    page++;

    // Brief pause between pages to respect rate limits
    await new Promise((r) => setTimeout(r, 300));
  }

  return all;
}

function boardQualifies(board: BoardRow): boolean {
  if (BOARD_BLACKLIST.has(board.id)) return false;
  if (board.state !== "active") return false;
  if (board.name.startsWith("Subitems of")) return false;
  return board.columns.some(
    (c) => c.title.toLowerCase() === "trigger" && c.type === "status",
  );
}

// ── Webhook management ────────────────────────────────────────────────────────

async function getBoardWebhooks(
  token: string,
  boardId: string,
): Promise<WebhookRow[]> {
  const data = await callMonday(
    token,
    `query ($boardId: ID!) {
       webhooks(board_id: $boardId) { id event }
     }`,
    { boardId },
  );

  return (
    ((data.data as Record<string, unknown>)?.webhooks as WebhookRow[]) ?? []
  );
}

async function registerWebhook(
  token: string,
  boardId: string,
  event: string,
): Promise<string | null> {
  try {
    const data = await callMonday(
      token,
      `mutation ($boardId: ID!, $url: String!, $event: WebhookEventType!) {
         create_webhook(board_id: $boardId, url: $url, event: $event) {
           id
         }
       }`,
      { boardId, url: METADATA_SYNC_URL, event },
    );

    return (
      (
        (data.data as Record<string, unknown>)?.create_webhook as Record<
          string,
          unknown
        >
      )?.id as string
    ) ?? null;
  } catch (e) {
    console.error(`  Failed to register ${event} on board ${boardId}:`, e);
    return null;
  }
}

// ── Backfill helpers ──────────────────────────────────────────────────────────

async function backfillBoard(
  token: string,
  boardId: string,
  boardName: string,
  columns: Column[],
): Promise<{ updated: number; skipped: number }> {
  const colMap: Record<string, string> = {};
  for (const c of columns) colMap[c.title.toLowerCase()] = c.id;

  const boardNameId = colMap["board name"];
  const groupNameId = colMap["group name"];
  const linkId = colMap["link to item"];
  const syncedId = colMap["metadata_synced"];

  // Create missing columns if needed
  const missingCols: Array<{ title: string; type: string }> = [];
  if (!boardNameId) missingCols.push({ title: "Board Name", type: "text" });
  if (!groupNameId) missingCols.push({ title: "Group Name", type: "text" });
  if (!linkId) missingCols.push({ title: "Link to Item", type: "link" });
  if (!syncedId) missingCols.push({ title: "metadata_synced", type: "checkbox" });

  for (const col of missingCols) {
    try {
      await callMonday(
        token,
        `mutation ($boardId: ID!, $title: String!, $type: ColumnType!) {
           create_column(board_id: $boardId, title: $title, column_type: $type) {
             id title
           }
         }`,
        { boardId, title: col.title, type: col.type },
      );
      console.log(`  Created column "${col.title}" on board ${boardId}`);
    } catch (e) {
      console.warn(`  Could not create "${col.title}" on board ${boardId}:`, e);
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  // Re-fetch columns after creation if any were missing
  let effectiveColMap = colMap;
  if (missingCols.length > 0) {
    const refreshed = await callMonday(
      token,
      `query ($id: [ID!]) {
         boards(ids: $id) { columns { id title type } }
       }`,
      { id: [boardId] },
    );
    const cols = (
      (refreshed.data as Record<string, unknown>)?.boards as Array<{
        columns: Column[];
      }>
    )?.[0]?.columns ?? [];

    effectiveColMap = {};
    for (const c of cols) effectiveColMap[c.title.toLowerCase()] = c.id;
  }

  const finalBoardNameId = effectiveColMap["board name"];
  const finalGroupNameId = effectiveColMap["group name"];
  const finalLinkId = effectiveColMap["link to item"];
  const finalSyncedId = effectiveColMap["metadata_synced"];

  if (!finalBoardNameId || !finalGroupNameId || !finalLinkId || !finalSyncedId) {
    console.warn(`Board ${boardId}: still missing columns after creation attempt — skipping`);
    return { updated: 0, skipped: 0 };
  }

  // Page through items and update unsynced ones
  let cursor: string | null = null;
  let updated = 0;
  let skipped = 0;

  while (true) {
    const query = cursor
      ? `query ($boardId: [ID!], $cursor: String!) {
           boards(ids: $boardId) {
             items_page(limit: 50, cursor: $cursor) {
               cursor
               items {
                 id
                 group { title }
                 column_values(ids: ["${finalSyncedId}"]) { id value }
               }
             }
           }
         }`
      : `query ($boardId: [ID!]) {
           boards(ids: $boardId) {
             items_page(limit: 50) {
               cursor
               items {
                 id
                 group { title }
                 column_values(ids: ["${finalSyncedId}"]) { id value }
               }
             }
           }
         }`;

    const vars = cursor ? { boardId: [boardId], cursor } : { boardId: [boardId] };

    const data = await callMonday(token, query, vars);
    const page = (
      (data.data as Record<string, unknown>)?.boards as Array<{
        items_page: {
          cursor: string | null;
          items: Array<{
            id: string;
            group: { title: string };
            column_values: Array<{ id: string; value: string | null }>;
          }>;
        };
      }>
    )?.[0]?.items_page;

    if (!page?.items?.length) break;

    for (const item of page.items) {
      const syncVal = item.column_values?.[0]?.value;
      const isSynced = syncVal
        ? (JSON.parse(syncVal) as Record<string, unknown>)?.checked === true
        : false;

      if (isSynced) {
        skipped++;
        continue;
      }

      const url = `https://${MONDAY_DOMAIN}/boards/${boardId}/pulses/${item.id}`;
      const vals = JSON.stringify({
        [finalBoardNameId]: boardName,
        [finalGroupNameId]: item.group?.title ?? "",
        [finalLinkId]: { url, text: "Link to Item" },
        [finalSyncedId]: { checked: "true" },
      });

      try {
        await callMonday(
          token,
          `mutation ($boardId: ID!, $itemId: ID!, $vals: JSON!) {
             change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $vals) {
               id
             }
           }`,
          { boardId, itemId: item.id, vals },
        );
        updated++;
      } catch (e) {
        console.warn(`  Could not update item ${item.id}:`, e);
      }

      await new Promise((r) => setTimeout(r, 400));
    }

    cursor = page.cursor ?? null;
    if (!cursor) break;
  }

  return { updated, skipped };
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const token = Deno.env.get("MONDAY_API_TOKEN") ?? "";

  const started = Date.now();
  const results = {
    boards_scanned: 0,
    boards_qualified: 0,
    webhooks_registered: 0,
    boards_backfilled: 0,
    items_updated: 0,
    errors: [] as string[],
  };

  console.log("Board scanner started");

  try {
    const boards = await fetchWorkspaceBoards(token);
    results.boards_scanned = boards.length;
    console.log(`Scanned ${boards.length} boards`);

    for (const board of boards) {
      if (!boardQualifies(board)) continue;
      results.boards_qualified++;

      // Check existing webhooks
      let existing: WebhookRow[];
      try {
        existing = await getBoardWebhooks(token, board.id);
      } catch (e) {
        console.warn(`Could not fetch webhooks for board ${board.id}:`, e);
        continue;
      }

      // Note: API v2025-01 removed 'url' from Webhook type.
      // We track by event name only — sufficient since we own all webhooks on these boards.
      const registeredEvents = new Set(existing.map((w) => w.event));

      const needsWebhooks = WEBHOOK_EVENTS.some((ev) => !registeredEvents.has(ev));

      if (!needsWebhooks) {
        console.log(`Board ${board.id} "${board.name}": all webhooks already registered`);
        continue;
      }

      // Register missing webhooks
      console.log(`Board ${board.id} "${board.name}": registering webhooks…`);
      let anyRegistered = false;

      for (const event of WEBHOOK_EVENTS) {
        if (registeredEvents.has(event)) continue;
        const id = await registerWebhook(token, board.id, event);
        if (id) {
          console.log(`  ✓ ${event} (id=${id})`);
          results.webhooks_registered++;
          anyRegistered = true;
        }
        await new Promise((r) => setTimeout(r, 300));
      }

      // Backfill unsynced items on newly connected boards
      if (anyRegistered) {
        console.log(`  Backfilling "${board.name}"…`);
        try {
          const { updated, skipped } = await backfillBoard(
            token,
            board.id,
            board.name,
            board.columns,
          );
          results.boards_backfilled++;
          results.items_updated += updated;
          console.log(`  ✓ Backfill: ${updated} updated, ${skipped} already synced`);
        } catch (e) {
          const msg = `Backfill failed for board ${board.id}: ${e}`;
          console.error(msg);
          results.errors.push(msg);
        }
      }

      await new Promise((r) => setTimeout(r, 300));
    }
  } catch (e) {
    const msg = `Scanner error: ${e}`;
    console.error(msg);
    results.errors.push(msg);
  }

  const elapsed = Math.round((Date.now() - started) / 1000);
  console.log(`Scanner done in ${elapsed}s`, results);

  return new Response(
    JSON.stringify({ ...results, elapsed_seconds: elapsed }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
});
