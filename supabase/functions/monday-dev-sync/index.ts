// monday-dev-sync v6
// One-time sync: Dev board (18352701419) → WM board (18404395098)
// Trigger: POST /monday-dev-sync?phase=1|2|3

const MONDAY_API_URL = "https://api.monday.com/v2";
const DEV_BOARD_ID = "18352701419";
const WM_BOARD_ID = "18404395098";

const DEV_COL = {
  epic: "task_epic",
  project: "lookup_mkxdjfz8",   // mirror of Project board name — fallback for matching
  status: "task_status",
  devEnv: "dropdown_mkxdh9md",
  planned: "task_estimation",
  effort: "task_actual_effort",
  qa: "numeric_mkxsr08n",
  sprint: "task_sprint",
  priority: "task_priority",
  syncFlag: "boolean_mm2evmbk", // Dev Sync ✓
};

const WM_COL = {
  boardName: "text_mm1rxnws",
  status: "color_mm1jr8z",
  devEnv: "dropdown_mm1jdck0",
  planned: "project_planned_effort",
  effort: "numeric_mkxapvw6",
  fixRounds: "18326974024__numeric_mkxtphm1",
  priority: "color_mm2ecyd3",      // Dev Priority
  activeSprint: "boolean_mm2esfa7", // Active Sprint
  sprint: "text_mm2eg8ax",         // Sprint
  syncFlag: "boolean_mm2eq8ys",   // Dev Sync ✓
};

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function mondayApi(query: string, token: string): Promise<any> {
  const res = await fetch(MONDAY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": token,
      "API-Version": "2025-01",
    },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (json.errors) console.warn("API errors:", JSON.stringify(json.errors));
  return json.data;
}

interface DevItem {
  id: string;
  name: string;
  epicName: string | null;
  projectName: string | null; // mirror column lookup_mkxdjfz8 — fallback for matching
  status: string | null;
  devEnvIds: number[];
  planned: string | null;
  effort: string | null;
  qa: string | null;
  priority: string | null;
  sprintIds: string[]; // linked sprint item IDs
  sprintNames: string[]; // sprint name(s)
  alreadySynced: boolean;
}

interface WMItem {
  id: string;
  name: string;
  boardName: string | null;
}

interface Match {
  dev: DevItem;
  wm: WMItem[];
}

async function fetchDevItems(token: string): Promise<DevItem[]> {
  const all: DevItem[] = [];
  let cursor: string | null = null;

  do {
    const cursorArg = cursor ? `, cursor: "${cursor}"` : "";
    const query = `
      query {
        boards(ids: [${DEV_BOARD_ID}]) {
          items_page(limit: 50${cursorArg}) {
            cursor
            items {
              id name
              column_values(ids: [
                "${DEV_COL.epic}", "${DEV_COL.project}", "${DEV_COL.status}", "${DEV_COL.devEnv}",
                "${DEV_COL.planned}", "${DEV_COL.effort}", "${DEV_COL.qa}",
                "${DEV_COL.priority}", "${DEV_COL.sprint}", "${DEV_COL.syncFlag}"
              ]) {
                id text value
                ... on BoardRelationValue { linked_items { id name } }
                ... on MirrorValue { display_value }
              }
            }
          }
        }
      }
    `;
    const data = await mondayApi(query, token);
    const page = data?.boards?.[0]?.items_page;
    if (!page) break;

    for (const item of page.items ?? []) {
      const get = (id: string) => item.column_values.find((c: any) => c.id === id);
      const epicCol = get(DEV_COL.epic);
      let devEnvIds: number[] = [];
      try { const v = get(DEV_COL.devEnv)?.value; if (v) devEnvIds = JSON.parse(v).ids ?? []; } catch {}

      const projectCol = get(DEV_COL.project);
      // MirrorValue returns display_value; may be comma-separated if multiple — take first
      const projectRaw = projectCol?.display_value ?? projectCol?.text ?? null;
      const projectName = projectRaw ? projectRaw.split(",")[0].trim() || null : null;

      all.push({
        id: item.id,
        name: item.name,
        epicName: epicCol?.linked_items?.[0]?.name ?? null,
        projectName,
        status: get(DEV_COL.status)?.text ?? null,
        devEnvIds,
        planned: get(DEV_COL.planned)?.text ?? null,
        effort: get(DEV_COL.effort)?.text ?? null,
        qa: get(DEV_COL.qa)?.text ?? null,
        priority: get(DEV_COL.priority)?.text ?? null,
        sprintIds: get(DEV_COL.sprint)?.linked_items?.map((s: any) => s.id) ?? [],
        sprintNames: get(DEV_COL.sprint)?.linked_items?.map((s: any) => s.name) ?? [],
        alreadySynced: get(DEV_COL.syncFlag)?.value
          ? JSON.parse(get(DEV_COL.syncFlag).value)?.checked === true
          : false,
      });
    }
    cursor = page.cursor ?? null;
    await sleep(300);
  } while (cursor);

  return all;
}

async function fetchWMItems(token: string): Promise<WMItem[]> {
  const all: WMItem[] = [];
  let cursor: string | null = null;

  do {
    const cursorArg = cursor ? `, cursor: "${cursor}"` : "";
    const query = `
      query {
        boards(ids: [${WM_BOARD_ID}]) {
          items_page(limit: 100${cursorArg}) {
            cursor
            items {
              id name
              column_values(ids: ["${WM_COL.boardName}"]) { id text }
            }
          }
        }
      }
    `;
    const data = await mondayApi(query, token);
    const page = data?.boards?.[0]?.items_page;
    if (!page) break;

    for (const item of page.items ?? []) {
      all.push({
        id: item.id,
        name: item.name,
        boardName: item.column_values.find((c: any) => c.id === WM_COL.boardName)?.text ?? null,
      });
    }
    cursor = page.cursor ?? null;
    await sleep(200);
  } while (cursor);

  return all;
}

function stripStar(s: string): string {
  return s.replace(/^✨\s*/, "").trim();
}

function buildMatches(devItems: DevItem[], wmItems: WMItem[]): { matched: Match[]; unmatched: DevItem[] } {
  const matched: Match[] = [];
  const unmatched: DevItem[] = [];

  for (const dev of devItems) {
    if (!dev.epicName && !dev.projectName) { unmatched.push(dev); continue; }
    const devName = stripStar(dev.name);
    const epicKey  = dev.epicName   ? stripStar(dev.epicName)   : null;
    const projKey  = dev.projectName ? stripStar(dev.projectName) : null;

    const wmMatches = wmItems.filter((wm) => {
      const wmBoard = stripStar(wm.boardName ?? "");
      const wmName  = stripStar(wm.name);
      if (wmName !== devName) return false;
      // UNION: match if WM board name equals Epic OR Project
      return (epicKey !== null && wmBoard === epicKey) ||
             (projKey !== null && wmBoard === projKey);
    });

    wmMatches.length > 0 ? matched.push({ dev, wm: wmMatches }) : unmatched.push(dev);
  }

  return { matched, unmatched };
}

// Sprint activation cache — avoid re-fetching same sprint
const sprintCache = new Map<string, boolean>();

async function isSprintActive(sprintId: string, token: string): Promise<boolean> {
  if (sprintCache.has(sprintId)) return sprintCache.get(sprintId)!;
  const data = await mondayApi(`
    query { items(ids: [${sprintId}]) { column_values(ids: ["sprint_activation"]) { value } } }
  `, token);
  const val = data?.items?.[0]?.column_values?.[0]?.value;
  const active = val ? JSON.parse(val)?.checked === true : false;
  sprintCache.set(sprintId, active);
  return active;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/\u200B/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchDevUpdates(itemId: string, token: string) {
  const data = await mondayApi(`
    query {
      items(ids: [${itemId}]) {
        updates(limit: 100) {
          body created_at
          creator { name }
          replies {
            body created_at
            creator { name }
          }
        }
      }
    }
  `, token);
  return (data?.items?.[0]?.updates ?? []).map((u: any) => ({
    creator: u.creator?.name ?? "Unknown",
    createdAt: u.created_at?.slice(0, 10) ?? "",
    body: stripHtml(u.body ?? ""),
    replies: (u.replies ?? []).map((r: any) => ({
      creator: r.creator?.name ?? "Unknown",
      createdAt: r.created_at?.slice(0, 10) ?? "",
      body: stripHtml(r.body ?? ""),
    })),
  }));
}

function formatUpdates(updates: any[]): string {
  const sorted = [...updates].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const blocks = sorted.map((u) => {
    let block = `👤 ${u.creator} | 📅 ${u.createdAt}\n${u.body}`;
    if (u.replies?.length > 0) {
      const replySorted = [...u.replies].sort((a: any, b: any) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      const replyLines = replySorted.map((r: any) =>
        `  ↳ 👤 ${r.creator} | 📅 ${r.createdAt}\n  ${r.body.replace(/\n/g, "\n  ")}`
      );
      block += "\n\n" + replyLines.join("\n\n");
    }
    return block;
  });

  return `📜 ארכיון עדכונים מסביבת Dev:\n\n${blocks.join("\n\n---\n\n")}`;
}

async function postUpdate(itemId: string, body: string, token: string) {
  const escaped = body.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
  await mondayApi(`mutation { create_update(item_id: ${itemId}, body: "${escaped}") { id } }`, token);
}

async function markSynced(itemId: string, boardId: string, colId: string, token: string) {
  // Monday checkbox value must be {"checked": "true"} — string not boolean
  const colJson = JSON.stringify(JSON.stringify({ [colId]: { checked: "true" } }));
  const result = await mondayApi(`
    mutation {
      change_multiple_column_values(
        item_id: ${itemId}, board_id: ${boardId}, column_values: ${colJson}
      ) { id }
    }
  `, token);
  if (!result?.change_multiple_column_values?.id) {
    console.warn(`  ⚠ markSynced failed for item ${itemId} on board ${boardId}`);
  }
}

async function syncColumns(dev: DevItem, wmId: string, token: string) {
  const values: Record<string, any> = {};
  if (dev.status) values[WM_COL.status] = { label: dev.status };
  if (dev.devEnvIds.length > 0) values[WM_COL.devEnv] = { ids: dev.devEnvIds };
  if (dev.planned) values[WM_COL.planned] = dev.planned;
  if (dev.effort) values[WM_COL.effort] = dev.effort;
  if (dev.qa) values[WM_COL.fixRounds] = dev.qa;
  if (dev.priority) values[WM_COL.priority] = { label: dev.priority };
  if (dev.sprintNames.length > 0) values[WM_COL.sprint] = dev.sprintNames.join(", ");

  // Active Sprint: check each linked sprint for activation
  if (dev.sprintIds.length > 0) {
    let active = false;
    for (const sid of dev.sprintIds) {
      if (await isSprintActive(sid, token)) { active = true; break; }
      await sleep(100);
    }
    values[WM_COL.activeSprint] = { checked: active ? "true" : "false" };
  }

  if (Object.keys(values).length === 0) return;

  const colJson = JSON.stringify(JSON.stringify(values));
  await mondayApi(`
    mutation {
      change_multiple_column_values(
        item_id: ${wmId}, board_id: ${WM_BOARD_ID}, column_values: ${colJson}
      ) { id }
    }
  `, token);
}

// ── main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const token = Deno.env.get("MONDAY_API_TOKEN") ?? "";
  if (!token) return new Response("Missing MONDAY_API_TOKEN", { status: 500 });

  const url = new URL(req.url);
  const phase = parseInt(url.searchParams.get("phase") ?? "0");
  const testOnly = url.searchParams.get("test") === "true";
  const startAt = parseInt(url.searchParams.get("start") ?? "0");
  const batchSize = parseInt(url.searchParams.get("batch") ?? "30");

  if (!phase || phase < 1 || phase > 3) {
    return new Response("Usage: ?phase=1|2|3  (add &test=true for dry-run, &start=N for batching)", { status: 400 });
  }

  const log: string[] = [];
  const L = (msg: string) => { console.log(msg); log.push(msg); };

  try {
    L(`🚀 Starting Phase ${phase}${phase === 3 ? ` [batch start=${startAt} size=${batchSize}]` : ""}...`);

    L("📥 Fetching Dev items...");
    const devItems = await fetchDevItems(token);
    L(`✅ Dev: ${devItems.length} items | Epic=${devItems.filter(i => i.epicName).length} | Project=${devItems.filter(i => i.projectName).length} | Either=${devItems.filter(i => i.epicName || i.projectName).length}`);

    L("📥 Fetching WM items...");
    const wmItems = await fetchWMItems(token);
    L(`✅ WM: ${wmItems.length} items`);

    const { matched, unmatched } = buildMatches(devItems, wmItems);
    L(`📊 Matched: ${matched.length} | Unmatched: ${unmatched.length}`);

    // For phase 3: paginate via start/batch; for phase 1/2: use first 3 as test
    const targets = phase < 3
      ? matched.slice(0, 3)
      : matched.slice(startAt, startAt + batchSize);

    if (phase === 1 || phase === 3) {
      L(`\n━━━ Updates Sync (${targets.length} items) ━━━`);
      for (const { dev, wm } of targets) {
        if (dev.alreadySynced && !testOnly) {
          L(`  ⏭ "${dev.name}" — already synced, skipping`);
          continue;
        }
        const updates = await fetchDevUpdates(dev.id, token);
        if (updates.length === 0) { L(`  ↷ "${dev.name}" — no updates`); continue; }
        const body = formatUpdates(updates);

        // Show preview (first 600 chars) only for phase 1 test
        if (phase === 1) L(`  📋 Preview for "${dev.name}":\n${body.slice(0, 600)}${body.length > 600 ? "..." : ""}`);

        for (const wmItem of wm) {
          if (!testOnly) {
            await postUpdate(wmItem.id, body, token);
            await markSynced(dev.id, DEV_BOARD_ID, DEV_COL.syncFlag, token);
            await markSynced(wmItem.id, WM_BOARD_ID, WM_COL.syncFlag, token);
          }
          L(`  ${testOnly ? "🔍 DRY-RUN" : "✓"} "${dev.name}" → WM[${wmItem.id}] (${updates.length} updates, ${updates.reduce((s, u) => s + u.replies.length, 0)} replies)`);
          await sleep(300);
        }
      }
    }

    if (phase === 2 || phase === 3) {
      L(`\n━━━ Column Sync (${targets.length} items) ━━━`);
      for (const { dev, wm } of targets) {
        for (const wmItem of wm) {
          if (!testOnly) {
            await syncColumns(dev, wmItem.id, token);
            await markSynced(dev.id, DEV_BOARD_ID, DEV_COL.syncFlag, token);
            await markSynced(wmItem.id, WM_BOARD_ID, WM_COL.syncFlag, token);
          }
          L(`  ${testOnly ? "🔍 DRY-RUN" : "✓"} "${dev.name}" → WM[${wmItem.id}]\n    status=${dev.status} | priority=${dev.priority} | sprint=${dev.sprintNames.join(",")||"—"} | planned=${dev.planned} | effort=${dev.effort} | qa=${dev.qa}`);
          await sleep(300);
        }
      }
    }

    if (phase === 3) {
      const nextStart = startAt + batchSize;
      if (nextStart < matched.length) {
        L(`\n⏩ Next batch: ?phase=3&start=${nextStart}&batch=${batchSize}`);
      } else {
        L(`\n━━━ EXCEPTION REPORT ━━━`);
        L(`Unmatched items: ${unmatched.length}`);
        for (const item of unmatched) {
          const reason = (!item.epicName && !item.projectName) ? "no Epic/Project" : "no name match in WM";
          L(`  ❌ [${item.id}] "${item.name}" — ${reason}`);
        }
        L(`\n🏁 All batches complete! Total matched synced: ${matched.length}`);
      }
    }

    L(`\n✅ Phase ${phase} complete`);

    return new Response(log.join("\n"), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    console.error(err);
    return new Response(`Error: ${err}\n\n${log.join("\n")}`, { status: 500 });
  }
});
