// hub-sync v1
// Full refresh of Hub board (18400570216) items → Supabase items + column_values tables.
// Deploy to: hrdniczngcoymqjpmvqn (data project)
// Schedule: every 30 min via pg_cron (see setup_hub_sync_cron.sql)
// Manual trigger: GET/POST with optional Authorization header

const HUB_BOARD_ID = "18400570216";
const MONDAY_API_URL = "https://api.monday.com/v2";
const PAGE_SIZE = 200;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const mondayToken = Deno.env.get("MONDAY_API_TOKEN") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!mondayToken) return json({ error: "Missing MONDAY_API_TOKEN" }, 500);
  if (!supabaseUrl || !serviceKey) return json({ error: "Missing Supabase env vars" }, 500);

  try {
    const started = Date.now();

    // 1. Fetch all Hub items from Monday API
    console.log("hub-sync: fetching Monday items…");
    const mondayItems = await fetchAllHubItems(mondayToken);
    console.log(`hub-sync: fetched ${mondayItems.length} items from Monday`);

    // 2. Upsert items into Supabase
    const { itemsUpserted, cvUpserted, itemsDeleted } =
      await upsertToSupabase(mondayItems, supabaseUrl, serviceKey);

    const elapsed = Date.now() - started;
    console.log(`hub-sync: done in ${elapsed}ms — items=${itemsUpserted} cvs=${cvUpserted} deleted=${itemsDeleted}`);

    return json({ ok: true, itemsUpserted, cvUpserted, itemsDeleted, elapsedMs: elapsed });
  } catch (err) {
    console.error("hub-sync error:", err);
    return json({ error: String(err) }, 500);
  }
});

// ── Monday API ────────────────────────────────────────────────────────────────

async function fetchAllHubItems(token: string): Promise<any[]> {
  const all: any[] = [];
  let cursor: string | null = null;

  while (true) {
    const cursorArg = cursor ? `, cursor: "${cursor}"` : "";
    const query = `
      query {
        boards(ids: [${HUB_BOARD_ID}]) {
          items_page(limit: ${PAGE_SIZE}${cursorArg}) {
            cursor
            items {
              id name state
              group { id }
              parent_item { id }
              creator_id
              created_at
              updated_at
              column_values { id text value }
            }
          }
        }
      }`;

    const data = await mondayApi(query, token);
    const page = data?.boards?.[0]?.items_page;
    if (!page) break;

    const items: any[] = page.items ?? [];
    all.push(...items);

    cursor = page.cursor ?? null;
    if (!cursor || items.length < PAGE_SIZE) break;
  }

  return all;
}

async function mondayApi(query: string, token: string): Promise<any> {
  const res = await fetch(MONDAY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": token.startsWith("Bearer ") ? token : `Bearer ${token}`,
      "API-Version": "2025-01",
    },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

// ── Supabase upsert ───────────────────────────────────────────────────────────

async function upsertToSupabase(
  mondayItems: any[],
  supabaseUrl: string,
  serviceKey: string
): Promise<{ itemsUpserted: number; cvUpserted: number; itemsDeleted: number }> {
  const now = new Date().toISOString();
  const mondayIds = new Set(mondayItems.map((i) => String(i.id)));

  // Build rows for items table
  const itemRows = mondayItems.map((item) => ({
    id: parseInt(item.id, 10),
    board_id: parseInt(HUB_BOARD_ID, 10),
    group_id: item.group?.id ?? null,
    parent_item_id: item.parent_item?.id ? parseInt(item.parent_item.id, 10) : null,
    name: item.name ?? "",
    state: item.state ?? "active",
    creator_id: item.creator_id ? parseInt(item.creator_id, 10) : null,
    created_at_monday: item.created_at ?? null,
    updated_at_monday: item.updated_at ?? null,
    synced_at: now,
  }));

  // Build rows for column_values table
  const cvRows: any[] = [];
  for (const item of mondayItems) {
    for (const cv of item.column_values ?? []) {
      if (cv.text == null && cv.value == null) continue; // skip empty
      cvRows.push({
        item_id: parseInt(item.id, 10),
        column_id: cv.id,
        board_id: parseInt(HUB_BOARD_ID, 10),
        text_value: cv.text ?? null,
        value: cv.value ?? null,
        updated_at: now,
      });
    }
  }

  // Upsert items in batches of 500
  let itemsUpserted = 0;
  for (let i = 0; i < itemRows.length; i += 500) {
    const batch = itemRows.slice(i, i + 500);
    await sbPost(supabaseUrl, serviceKey, "items", batch);
    itemsUpserted += batch.length;
  }

  // Upsert column_values in batches of 500
  let cvUpserted = 0;
  for (let i = 0; i < cvRows.length; i += 500) {
    const batch = cvRows.slice(i, i + 500);
    await sbPost(supabaseUrl, serviceKey, "column_values", batch);
    cvUpserted += batch.length;
  }

  // Delete items in Supabase that are no longer in Monday
  let itemsDeleted = 0;
  try {
    const deleteRes = await fetch(
      `${supabaseUrl}/rest/v1/items?board_id=eq.${HUB_BOARD_ID}&synced_at=lt.${encodeURIComponent(now)}`,
      {
        method: "DELETE",
        headers: sbHeaders(serviceKey),
      }
    );
    const deleteHeader = deleteRes.headers.get("content-range");
    if (deleteHeader) {
      const m = deleteHeader.match(/\d+/g);
      if (m) itemsDeleted = parseInt(m[0], 10);
    }
  } catch (e) {
    console.warn("Delete stale items failed (non-fatal):", e);
  }

  return { itemsUpserted, cvUpserted, itemsDeleted };
}

async function sbPost(supabaseUrl: string, serviceKey: string, table: string, rows: any[]) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      ...sbHeaders(serviceKey),
      "Prefer": "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase ${table} upsert failed (${res.status}): ${body}`);
  }
}

function sbHeaders(serviceKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "apikey": serviceKey,
    "Authorization": `Bearer ${serviceKey}`,
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}
