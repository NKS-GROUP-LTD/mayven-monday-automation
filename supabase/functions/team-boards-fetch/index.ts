// team-boards-fetch v1
// Read-only proxy that fetches a single Mayven Team board (items + column metadata)
// from the Monday API, for the executive dashboard "תצוגה כללית" (Overview) page.
//
// The Overview page calls this once per board, in parallel (?board=<id>), so each
// board resolves independently and sections fill progressively. Column TITLES are
// returned alongside ids/types because team boards do NOT share column ids — the
// frontend builds a per-board title→id resolver from this metadata.
//
// Deploy: supabase functions deploy team-boards-fetch --no-verify-jwt --project-ref syrhxhytlkcnakicnyde

const MONDAY_API_URL = "https://api.monday.com/v2";

// Whitelist — the 10 department team boards (verified live 2026-05-31).
// Only these ids may be fetched; any other id is rejected.
const ALLOWED_BOARDS = new Set([
  "18390642189", // Team Marketing
  "18404395098", // Team Technology
  "18409966592", // Team Product
  "18391276985", // Team Logistics & Product
  "18390477104", // Team Performance
  "18392040653", // Team Sales & Support
  "18392041728", // Team Finance
  "18392890397", // Team HR
  "18393812533", // Team Office Management
  "18392435688", // Team PM
]);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const token = Deno.env.get("MONDAY_API_TOKEN") ?? "";
  if (!token) {
    return new Response(JSON.stringify({ ok: false, error: "Missing MONDAY_API_TOKEN" }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }

  const url = new URL(req.url);
  const boardId = url.searchParams.get("board") ?? "";
  if (!ALLOWED_BOARDS.has(boardId)) {
    return new Response(
      JSON.stringify({ ok: false, error: `board not allowed: ${boardId || "(missing)"}` }),
      { status: 400, headers: CORS_HEADERS },
    );
  }

  try {
    const meta = await fetchBoardMeta(boardId, token);
    const items = await fetchAllItems(boardId, token);
    return new Response(
      JSON.stringify({
        ok: true,
        board: { id: boardId, name: meta.name, columns: meta.columns },
        items,
        count: items.length,
      }),
      { status: 200, headers: CORS_HEADERS },
    );
  } catch (err) {
    console.error(`team-boards-fetch error (board ${boardId}):`, err);
    return new Response(JSON.stringify({ ok: false, board: boardId, error: String(err) }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
});

async function fetchBoardMeta(
  boardId: string,
  token: string,
): Promise<{ name: string; columns: Array<{ id: string; title: string; type: string }> }> {
  const query = `
    query {
      boards(ids: [${boardId}]) {
        name
        columns { id title type }
      }
    }`;
  const data = await mondayApi(query, token);
  const board = data?.boards?.[0];
  return {
    name: board?.name ?? "",
    columns: (board?.columns ?? []).map((c: any) => ({
      id: c.id,
      title: c.title,
      type: c.type,
    })),
  };
}

async function fetchAllItems(boardId: string, token: string): Promise<any[]> {
  const allItems: any[] = [];
  let cursor: string | null = null;
  const PAGE_SIZE = 100;

  while (true) {
    const cursorArg = cursor ? `, cursor: "${cursor}"` : "";
    const query = `
      query {
        boards(ids: [${boardId}]) {
          items_page(limit: ${PAGE_SIZE}${cursorArg}) {
            cursor
            items {
              id
              name
              state
              group { id title }
              column_values { id text value type }
            }
          }
        }
      }`;

    const data = await mondayApi(query, token);
    const page = data?.boards?.[0]?.items_page;
    if (!page) break;

    const items: any[] = page.items ?? [];
    allItems.push(...items.map((item: any) => ({
      id: item.id,
      name: item.name,
      state: item.state,
      group_id: item.group?.id ?? null,
      group_title: item.group?.title ?? null,
      column_values: (item.column_values ?? []).map((cv: any) => ({
        id: cv.id,
        text: cv.text,
        value: cv.value,
        type: cv.type,
      })),
    })));

    cursor = page.cursor ?? null;
    if (!cursor || items.length < PAGE_SIZE) break;
  }

  return allItems;
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
  if (json.errors) {
    const errMsg = JSON.stringify(json.errors);
    console.error("Monday API errors:", errMsg);
    throw new Error(errMsg);
  }
  return json.data;
}
