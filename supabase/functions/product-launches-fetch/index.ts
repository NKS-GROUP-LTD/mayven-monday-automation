// product-launches-fetch v1
// Fetches all items from the Product Portfolio Roadmap board (18406262354) via Monday API
// Called by the executive dashboard frontend.
// Deploy: npx supabase functions deploy product-launches-fetch --project-ref syrhxhytlkcnakicnyde

const PRODUCT_LAUNCHES_BOARD_ID = "18406262354";
const MONDAY_API_URL = "https://api.monday.com/v2";
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

  const rawToken = Deno.env.get("MONDAY_API_TOKEN") ?? "";
  if (!rawToken) {
    return new Response(JSON.stringify({ error: "Missing MONDAY_API_TOKEN" }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
  const token = rawToken;

  try {
    const items = await fetchAllItems(token);
    return new Response(JSON.stringify({ ok: true, items, count: items.length }), {
      status: 200,
      headers: CORS_HEADERS,
    });
  } catch (err) {
    console.error("product-launches-fetch error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
});

async function fetchAllItems(token: string): Promise<any[]> {
  const allItems: any[] = [];
  let cursor: string | null = null;
  const PAGE_SIZE = 100;

  while (true) {
    const cursorArg = cursor ? `, cursor: "${cursor}"` : "";
    const query = `
      query {
        boards(ids: [${PRODUCT_LAUNCHES_BOARD_ID}]) {
          items_page(limit: ${PAGE_SIZE}${cursorArg}) {
            cursor
            items {
              id
              name
              state
              group { id title }
              created_at
              updated_at
              column_values {
                id
                text
                value
                type
              }
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
      created_at: item.created_at,
      updated_at: item.updated_at,
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
    throw new Error(JSON.stringify(json.errors));
  }
  return json.data;
}
