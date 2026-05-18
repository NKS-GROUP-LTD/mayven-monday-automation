// hub-sync v3 — two-phase delta sync
// Phase 1: fetch ALL item IDs + updated_at (lightweight, no column_values)
// Phase 2: fetch full column_values ONLY for items newer than what's in Supabase
// Result: first run syncs everything in multiple calls; subsequent runs are fast (only changed items)

const HUB_BOARD_ID = "18400570216";
const MONDAY_API_URL = "https://api.monday.com/v2";
const PAGE_SIZE = 500;
const BATCH_FULL = 50; // how many items to fetch with full column_values per call

const NEEDED_COLS = [
  "text_mm1rz19m","text_mm1sma80","color_mm3a8hzs",
  "multiple_person_mm0pfs7x","multiple_person_mm0pepdk","multiple_person_mm0pwp6q",
  "multiple_person_mm0p6kqe","multiple_person_mm3e4yy4",
  "color_mm0pdjry","color_mm1jhvap","color_mm1rz2vt","color_mm0prghm",
  "color_mm3e690x","color_mm3e98bb",
  "dropdown_mm3ezsvq","dropdown_mm3ersa1","color_mm3emh6c","dropdown_mm3eqtpn",
  "color_mm3en599","date_mm0p2hfk","date_mm0pzjaw","color_mm1rgerb",
  "date_mm0ppepz","timerange_mm0pbdag","numeric_mm0pr6mf","numeric_mm0p7e5k",
  "numeric_mm0ppf5f","color_mm2jkkq1",
];

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
  if (!supabaseUrl || !serviceKey) return json({ error: "Missing Supabase env" }, 500);

  try {
    const started = Date.now();
    const now = new Date().toISOString();

    // ── Phase 1: fetch all IDs + updated_at from Monday (no column values) ──
    console.log("hub-sync v3: phase 1 — fetch IDs + timestamps");
    const mondayMeta = await fetchAllMeta(mondayToken);
    console.log(`phase 1 done: ${mondayMeta.length} items from Monday`);

    // ── Load current updated_at_monday from Supabase to diff ──
    const sbMap = await loadSupabaseMeta(supabaseUrl, serviceKey);
    console.log(`supabase has ${sbMap.size} items`);

    // ── Determine what changed ──
    const toUpdate: typeof mondayMeta = [];
    const mondayIds = new Set<number>();

    for (const m of mondayMeta) {
      const id = parseInt(m.id, 10);
      mondayIds.add(id);
      const sbUpdated = sbMap.get(id);
      const mUpdated  = m.updated_at ? new Date(m.updated_at).getTime() : 0;
      const sUpdated  = sbUpdated    ? new Date(sbUpdated).getTime()    : 0;
      if (!sbUpdated || mUpdated > sUpdated) toUpdate.push(m);
    }

    console.log(`${toUpdate.length} items need full sync`);

    // ── Phase 2: fetch full column_values for changed items in batches ──
    let itemsUpserted = 0, cvUpserted = 0;

    for (let i = 0; i < toUpdate.length; i += BATCH_FULL) {
      const batch = toUpdate.slice(i, i + BATCH_FULL);
      const ids = batch.map(m => m.id);
      const items = await fetchItemsFull(ids, mondayToken);
      const r = await upsertItems(items, supabaseUrl, serviceKey, now);
      itemsUpserted += r.items;
      cvUpserted    += r.cvs;

      // Safety: stop if we're getting close to the 140s limit
      if (Date.now() - started > 130_000) {
        console.warn("hub-sync: approaching timeout, stopping early");
        break;
      }
    }

    // ── Delete items that no longer exist in Monday ──
    let itemsDeleted = 0;
    const staleIds: number[] = [];
    for (const [sbId] of sbMap) {
      if (!mondayIds.has(sbId)) staleIds.push(sbId);
    }
    if (staleIds.length > 0) {
      await fetch(`${supabaseUrl}/rest/v1/items?id=in.(${staleIds.join(",")})`, {
        method: "DELETE", headers: sbHeaders(serviceKey),
      });
      itemsDeleted = staleIds.length;
    }

    const elapsed = Date.now() - started;
    console.log(`hub-sync done in ${elapsed}ms — updated=${itemsUpserted} cvs=${cvUpserted} deleted=${itemsDeleted} pending=${Math.max(0, toUpdate.length - itemsUpserted)}`);

    return json({ ok: true, itemsUpserted, cvUpserted, itemsDeleted,
                  totalChanged: toUpdate.length, elapsedMs: elapsed });

  } catch (err) {
    console.error("hub-sync error:", err);
    return json({ error: String(err) }, 500);
  }
});

// ── Phase 1: lightweight fetch — just id + updated_at ────────────────────────

async function fetchAllMeta(token: string): Promise<{ id: string; updated_at: string }[]> {
  const all: { id: string; updated_at: string }[] = [];
  let cursor: string | null = null;

  while (true) {
    const cursorArg = cursor ? `, cursor: "${cursor}"` : "";
    const query = `query {
      boards(ids: [${HUB_BOARD_ID}]) {
        items_page(limit: ${PAGE_SIZE}${cursorArg}) {
          cursor
          items { id updated_at }
        }
      }
    }`;
    const data = await mondayApi(query, token);
    const page = data?.boards?.[0]?.items_page;
    if (!page) break;
    all.push(...(page.items ?? []));
    cursor = page.cursor ?? null;
    if (!cursor || (page.items ?? []).length < PAGE_SIZE) break;
  }

  return all;
}

// ── Load existing updated_at_monday from Supabase ────────────────────────────

async function loadSupabaseMeta(supabaseUrl: string, serviceKey: string): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  let offset = 0;
  const limit = 1000;

  while (true) {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/items?board_id=eq.${HUB_BOARD_ID}&select=id,updated_at_monday&limit=${limit}&offset=${offset}`,
      { headers: sbHeaders(serviceKey) }
    );
    if (!res.ok) break;
    const rows: { id: number; updated_at_monday: string | null }[] = await res.json();
    if (!rows.length) break;
    for (const r of rows) map.set(r.id, r.updated_at_monday ?? "");
    if (rows.length < limit) break;
    offset += limit;
  }

  return map;
}

// ── Phase 2: full fetch for specific item IDs ─────────────────────────────────

async function fetchItemsFull(ids: string[], token: string): Promise<any[]> {
  const colIds = NEEDED_COLS.map(id => `"${id}"`).join(", ");
  const idList = ids.join(", ");
  const query = `query {
    items(ids: [${idList}], limit: ${ids.length}) {
      id name state
      group { id }
      parent_item { id }
      creator_id
      created_at
      updated_at
      column_values(ids: [${colIds}]) { id text value }
    }
  }`;
  const data = await mondayApi(query, token);
  return data?.items ?? [];
}

// ── Upsert to Supabase ────────────────────────────────────────────────────────

async function upsertItems(
  items: any[], supabaseUrl: string, serviceKey: string, now: string
): Promise<{ items: number; cvs: number }> {
  const itemRows = items.map(item => ({
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

  const cvRows: any[] = [];
  for (const item of items) {
    for (const cv of item.column_values ?? []) {
      if (cv.text == null && cv.value == null) continue;
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

  await sbUpsert(supabaseUrl, serviceKey, "items", itemRows);
  if (cvRows.length) await sbUpsert(supabaseUrl, serviceKey, "column_values", cvRows);

  return { items: itemRows.length, cvs: cvRows.length };
}

async function sbUpsert(url: string, key: string, table: string, rows: any[]) {
  if (!rows.length) return;
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...sbHeaders(key), "Prefer": "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${table} upsert ${res.status}: ${body.slice(0, 300)}`);
  }
}

function sbHeaders(k: string): Record<string, string> {
  return { "Content-Type": "application/json", "apikey": k, "Authorization": `Bearer ${k}` };
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
  const data = await res.json();
  if (data.errors) throw new Error(JSON.stringify(data.errors));
  return data.data;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}
