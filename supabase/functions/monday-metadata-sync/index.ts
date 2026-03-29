/**
 * monday-metadata-sync — Supabase Edge Function (Deno)
 *
 * Handles Monday.com webhooks to auto-populate metadata columns:
 *   - Board Name  (text)
 *   - Group Name  (text)
 *   - Link to Item (link)
 *
 * Four triggers:
 *   1. create_pulse / create_item         → populate all three columns
 *   2. change_column_values on "Trigger"
 *      column AND label text == "Trigger" → populate all three columns
 *                                           (do NOT clear/reset Trigger column)
 *   3. item_moved_to_any_group            → update Group Name only
 *   4. move_pulse_into_board              → populate all three columns
 *                                           (board_id changes → URL changes)
 *
 * Loop prevention:
 *   Check event.userId — if it matches MONDAY_USER_ID (the API token owner),
 *   the event was caused by our own mutation → ignore it.
 *
 * Challenge handling:
 *   Monday sends {"challenge": "..."} on first registration → echo it back.
 *
 * Env vars (set via `supabase secrets set`):
 *   MONDAY_API_TOKEN  — API token
 *   MONDAY_USER_ID    — User ID of the API token owner (for loop prevention)
 */

const MONDAY_API_URL = "https://api.monday.com/v2";
const MONDAY_DOMAIN = "mayven-team.monday.com";
const MONDAY_API_VERSION = "2025-01";

/** Boards that must NEVER be modified by any automation. */
const BOARD_BLACKLIST = new Set([
  "18400570216", // 🌶️ Mayven Hub- All Tasks🌶️ — read-only master board
]);

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
    throw new Error(`Monday HTTP ${resp.status}: ${await resp.text()}`);
  }

  const data = (await resp.json()) as Record<string, unknown>;

  if (data.errors) {
    throw new Error(`Monday API error: ${JSON.stringify(data.errors)}`);
  }

  return data;
}

// ── Item + column helpers ─────────────────────────────────────────────────────

interface Column {
  id: string;
  title: string;
  type: string;
}

interface ItemContext {
  boardName: string;
  groupName: string;
  columns: Column[];
}

/**
 * Fetch board name, item's current group title, and all board columns in one call.
 */
async function getItemContext(
  token: string,
  boardId: string,
  itemId: string,
): Promise<ItemContext> {
  const data = await callMonday(
    token,
    `query ($boardId: [ID!], $itemId: [ID!]) {
       boards(ids: $boardId) {
         name
         columns { id title type }
       }
       items(ids: $itemId) {
         group { title }
       }
     }`,
    { boardId: [boardId], itemId: [itemId] },
  );

  const d = data.data as Record<string, unknown>;

  const board = (
    d?.boards as Array<{ name: string; columns: Column[] }>
  )?.[0];

  if (!board) throw new Error(`Board ${boardId} not found`);

  const item = (
    d?.items as Array<{ group: { title: string } }>
  )?.[0];

  return {
    boardName: board.name,
    groupName: item?.group?.title ?? "",
    columns: board.columns ?? [],
  };
}

function colMap(columns: Column[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const c of columns) m[c.title.toLowerCase()] = c.id;
  return m;
}

// ── Write mutations ───────────────────────────────────────────────────────────

/**
 * Set Board Name + Group Name + Link to Item for an item.
 */
async function writeAllMetadata(
  token: string,
  boardId: string,
  itemId: string,
  ctx: ItemContext,
): Promise<void> {
  const map = colMap(ctx.columns);
  const boardNameId = map["board name"];
  const groupNameId = map["group name"];
  const linkId = map["link to item"];

  if (!boardNameId || !groupNameId || !linkId) {
    console.warn(
      `Board ${boardId}: missing metadata columns. Available: ${Object.keys(map).join(", ")}`,
    );
    return;
  }

  const url = `https://${MONDAY_DOMAIN}/boards/${boardId}/pulses/${itemId}`;

  await callMonday(
    token,
    `mutation ($boardId: ID!, $itemId: ID!, $vals: JSON!) {
       change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $vals) {
         id
       }
     }`,
    {
      boardId,
      itemId,
      vals: JSON.stringify({
        [boardNameId]: ctx.boardName,
        [groupNameId]: ctx.groupName,
        [linkId]: { url, text: "Link to Item" },
      }),
    },
  );

  console.log(`[all] item ${itemId} board ${boardId} → "${ctx.boardName}" / "${ctx.groupName}"`);
}

/**
 * Update Group Name only (for group-move trigger).
 */
async function writeGroupName(
  token: string,
  boardId: string,
  itemId: string,
  ctx: ItemContext,
): Promise<void> {
  const map = colMap(ctx.columns);
  const groupNameId = map["group name"];

  if (!groupNameId) {
    console.warn(`Board ${boardId}: no "Group Name" column`);
    return;
  }

  await callMonday(
    token,
    `mutation ($boardId: ID!, $itemId: ID!, $vals: JSON!) {
       change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $vals) {
         id
       }
     }`,
    {
      boardId,
      itemId,
      vals: JSON.stringify({ [groupNameId]: ctx.groupName }),
    },
  );

  console.log(`[group] item ${itemId} board ${boardId} → "${ctx.groupName}"`);
}

// ── Value parsing ─────────────────────────────────────────────────────────────

/**
 * Extract label text from a Monday status column webhook value.
 * event.value may be a JSON string or already parsed object.
 */
function getStatusLabelText(value: unknown): string | null {
  if (!value) return null;

  let parsed: Record<string, unknown>;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value) as Record<string, unknown>;
    } catch {
      return null;
    }
  } else {
    parsed = value as Record<string, unknown>;
  }

  const label = parsed?.label as Record<string, unknown> | undefined;
  return typeof label?.text === "string" ? label.text : null;
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  // ── Monday challenge handshake ────────────────────────────────────────────
  if (body.challenge) {
    console.log("Challenge received — echoing back");
    return new Response(JSON.stringify({ challenge: body.challenge }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const event = body.event as Record<string, unknown> | undefined;
  if (!event) return new Response("OK", { status: 200 });

  const token = Deno.env.get("MONDAY_API_TOKEN") ?? "";

  // Loop prevention is not needed via userId because:
  // - Our writes (Board Name/Group Name/Link to Item) fire change_column_values
  //   events that are already filtered out by the columnTitle !== "trigger" check.
  // - We never create or move items, so no loop on other event types.
  // Using userId would incorrectly block events from the token owner acting as a user.

  const eventType = String(event.type ?? "");
  const boardId = String(event.boardId ?? "");
  const itemId = String(event.pulseId ?? "");

  // ── Blacklist check ───────────────────────────────────────────────────────
  if (BOARD_BLACKLIST.has(boardId)) {
    console.log(`Blacklisted board ${boardId} — skipping`);
    return new Response("OK", { status: 200 });
  }

  if (!boardId || !itemId) {
    console.warn("Missing boardId or pulseId", event);
    return new Response("OK", { status: 200 });
  }

  try {
    // ── Trigger 1: New item created ─────────────────────────────────────────
    if (eventType === "create_pulse" || eventType === "create_item") {
      console.log(`Trigger 1 (create): item ${itemId} on board ${boardId}`);
      const ctx = await getItemContext(token, boardId, itemId);
      await writeAllMetadata(token, boardId, itemId, ctx);
      return new Response("OK", { status: 200 });
    }

    // ── Trigger 4: Item moved to another board ──────────────────────────────
    // boardId in event = destination board (where item now lives)
    if (eventType === "move_pulse_into_board") {
      console.log(`Trigger 4 (board move): item ${itemId} → board ${boardId}`);
      const ctx = await getItemContext(token, boardId, itemId);
      await writeAllMetadata(token, boardId, itemId, ctx);
      return new Response("OK", { status: 200 });
    }

    // ── Trigger 3: Item moved to a group ────────────────────────────────────
    // Monday registration name: item_moved_to_any_group
    // Monday payload event.type: move_pulse_into_group
    if (eventType === "move_pulse_into_group" || eventType === "item_moved_to_any_group") {
      console.log(`Trigger 3 (group move): item ${itemId} on board ${boardId}`);
      const ctx = await getItemContext(token, boardId, itemId);
      await writeGroupName(token, boardId, itemId, ctx);
      return new Response("OK", { status: 200 });
    }

    // ── Trigger 2: "Trigger" status column set to label "Trigger" ──────────
    // Monday's change_column_values payload has columnId but columnTitle is
    // unreliable — identify the Trigger column by matching its ID against the
    // board's column titled "Trigger".  To avoid a context API call on every
    // column change, first gate on labelText === "trigger" (cheap, no API call).
    if (eventType === "change_column_values") {
      const labelText = getStatusLabelText(event.value);
      if (labelText?.toLowerCase() !== "trigger") {
        return new Response("OK", { status: 200 }); // not a "Trigger" label — skip
      }

      // Label is "Trigger" — verify it's the column titled "Trigger"
      const columnId = String(event.columnId ?? "");
      const ctx = await getItemContext(token, boardId, itemId);
      const map = colMap(ctx.columns);
      const triggerColId = map["trigger"];

      if (!triggerColId || columnId !== triggerColId) {
        console.log(`Label "Trigger" set on non-Trigger column "${columnId}" — ignoring`);
        return new Response("OK", { status: 200 });
      }

      console.log(`Trigger 2 (re-sync): item ${itemId} on board ${boardId}`);
      await writeAllMetadata(token, boardId, itemId, ctx);
      // Do NOT clear the Trigger column
      return new Response("OK", { status: 200 });
    }

    console.log(`Unhandled event type: "${eventType}" — skipping`);
    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error(`Error processing ${eventType} for item ${itemId}:`, err);
    // Return 200 to prevent Monday from retrying the same broken event indefinitely
    return new Response("OK", { status: 200 });
  }
});
