// Direction A — Executive Status Board
// Top: KPI tiles, then pipeline funnel (status), then dept performance grid + at-risk rail

function DirectionA({ projects, opts }) {
  const now = NOW;

  // KPIs
  const active = projects.filter(p => p.status === "בעבודה");
  const atRisk = projects.filter(p => {
    if (p.status !== "בעבודה" || !p.deadline) return false;
    return p.end > p.deadline || (p.deadline < now && p.status !== "הסתיימה");
  });
  const shippingThisMonth = projects.filter(p => {
    if (p.status === "מבוטלת") return false;
    if (!p.deadline) return false;
    const d = new Date(p.deadline);
    const m = new Date(now);
    return d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth();
  });
  const done = projects.filter(p => p.status === "הסתיימה");
  const onTimeRate = done.length ? Math.round(done.filter(p => isOnTime(p) === true).length / done.length * 100) : 0;
  const launchesThisQuarter = projects.filter(p => {
    if (!p.start) return false;
    const d = new Date(p.start);
    const m = new Date(now);
    const qStart = new Date(m.getFullYear(), Math.floor(m.getMonth()/3)*3, 1).getTime();
    const qEnd = new Date(m.getFullYear(), Math.floor(m.getMonth()/3)*3 + 3, 1).getTime();
    return d.getTime() >= qStart && d.getTime() < qEnd && p.type === "🚀Product Launch";
  });

  // Pipeline funnel — counts per status
  const pipelineCounts = PIPELINE_ORDER.map(s => ({
    status: s,
    count: projects.filter(p => p.status === s).length,
    items: projects.filter(p => p.status === s).reduce((sum, p) => sum + (p.totalItems || 1), 0),
  }));
  const maxPipeline = Math.max(...pipelineCounts.map(p => p.count));

  // Type performance — group projects by type
  const typeGroups = {};
  projects.forEach(p => {
    const t = p.type || "";
    if (!typeGroups[t]) typeGroups[t] = [];
    typeGroups[t].push(p);
  });
  // Order types by total project count
  const typeRows = Object.entries(typeGroups)
    .map(([t, arr]) => {
      const tDone = arr.filter(p => p.status === "הסתיימה");
      const tActive = arr.filter(p => p.status === "בעבודה");
      const tBacklog = arr.filter(p => p.status === "בנק משימות");
      const tOnTime = tDone.length ? Math.round(tDone.filter(p => isOnTime(p) === true).length / tDone.length * 100) : null;
      return {
        type: t,
        total: arr.length,
        done: tDone.length,
        active: tActive.length,
        backlog: tBacklog.length,
        onTimeRate: tOnTime,
        items: arr.reduce((s, p) => s + (p.totalItems || 1), 0),
      };
    })
    .filter(r => r.type !== "")
    .sort((a, b) => b.total - a.total);

  const atRiskSorted = [...atRisk].sort((a, b) => (a.deadline || 0) - (b.deadline || 0));

  const typeLabel = (t) => opts.emoji ? t : (TYPE_LABELS[t] || t);

  return (
    <div className="dir-a" style={{ display: "grid", gap: 24 }}>
      {/* Header strip */}
      <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", borderBottom: "1.5px solid var(--ink)", paddingBottom: 12, gap: 24 }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 36, lineHeight: 1, fontWeight: 700 }}>
            <Highlight>לוח מצב הנהלה</Highlight>
          </div>
          <div style={{ fontFamily: "var(--font-hand)", fontSize: 13, opacity: 0.65, marginTop: 6 }}>
            רבעון נוכחי · {projects.length} פרויקטים · {projects.reduce((s, p) => s + p.totalItems, 0)} משימות
          </div>
        </div>
        <div style={{ fontFamily: "var(--font-hand)", fontSize: 12, opacity: 0.55, textAlign: "left" }}>
          <div>נכון ל־14/05/26</div>
          <div>· Wireframe direction A ·</div>
        </div>
      </header>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr", gap: 14 }}>
        <StatTile label="עומדים בזמן" value={onTimeRate + "%"} sub={`מתוך ${done.length} הסתיימו`} big accent="var(--accent2)" />
        <StatTile label="בעבודה כעת" value={active.length} sub="פרויקטים פעילים" />
        <StatTile label="באיחור / בסיכון" value={atRisk.length} accent="var(--accent)" sub="צריך התערבות" dashed />
        <StatTile label="צפויים החודש" value={shippingThisMonth.length} sub="עפ״י דד־ליין" />
        <StatTile label="השקות ברבעון" value={launchesThisQuarter.length} sub="Product Launches" />
      </div>

      {/* Pipeline funnel */}
      <section>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, margin: 0, fontWeight: 700 }}>
            צינור הפרויקטים
          </h2>
          <span style={{ fontFamily: "var(--font-hand)", fontSize: 12, opacity: 0.6 }}>מה ממתין · בעבודה · מה הסתיים</span>
          <span style={{ flex: 1, height: 1, background: "var(--ink)", opacity: 0.2 }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, alignItems: "stretch" }}>
          {pipelineCounts.map((p, i) => {
            const w = maxPipeline > 0 ? (p.count / maxPipeline) * 100 : 0;
            const cfg = STATUS_CONFIG[p.status];
            const isCancel = cfg?.key === "cancel";
            const isActive = cfg?.key === "active";
            return (
              <div key={p.status} style={{
                border: `1.5px ${isCancel ? "dashed" : "solid"} var(--ink)`,
                borderRadius: 6,
                padding: "12px 14px",
                background: "var(--paper)",
                boxShadow: "2px 2px 0 var(--ink)",
                opacity: isCancel ? 0.55 : 1,
                position: "relative",
              }}>
                <div style={{ fontFamily: "var(--font-hand)", fontSize: 12, opacity: 0.7 }}>{cfg?.label || p.status}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
                  <div style={{
                    fontFamily: "var(--font-display)", fontSize: 38, lineHeight: 1, fontWeight: 700,
                    color: isActive ? "var(--accent)" : "var(--ink)",
                    fontVariantNumeric: "tabular-nums",
                  }}>{p.count}</div>
                  <div style={{ fontFamily: "var(--font-hand)", fontSize: 11, opacity: 0.55 }}>{p.items} משימות</div>
                </div>
                {/* Sketchy bar */}
                <div style={{ marginTop: 10 }}>
                  <div style={{ height: 8, border: "1.2px solid var(--ink)", borderRadius: 3, position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: w + "%",
                      background: isActive ? "var(--accent)" : isCancel ? "transparent" : "var(--ink)",
                      backgroundImage: isCancel ? "repeating-linear-gradient(45deg, var(--ink) 0 2px, transparent 2px 5px)" : "none",
                      opacity: isCancel ? 0.4 : (isActive ? 1 : 0.7),
                    }} />
                  </div>
                </div>
                {i < pipelineCounts.length - 1 && !isCancel && (
                  <div style={{ position: "absolute", top: "50%", left: -22, transform: "translateY(-50%)", zIndex: 2 }}>
                    <SketchArrow direction="left" size={28} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Lower: dept performance grid + at-risk rail */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 24 }}>
        {/* Dept performance */}
        <section>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, margin: 0, fontWeight: 700 }}>
              ביצועי {opts.groupBy === "department" ? "מחלקות" : "סוגי פרויקטים"}
            </h2>
            <span style={{ flex: 1, height: 1, background: "var(--ink)", opacity: 0.2 }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {typeRows.map(r => (
              <div key={r.type} style={{
                border: "1.4px solid var(--ink)",
                borderRadius: 6, padding: "12px 14px",
                background: "var(--paper)",
                boxShadow: "2px 2px 0 var(--ink)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <div style={{ fontFamily: "var(--font-hand)", fontWeight: 600, fontSize: 13, lineHeight: 1.2 }}>
                    {typeLabel(r.type)}
                  </div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{r.total}</div>
                </div>
                <div style={{ marginTop: 8, display: "flex", gap: 4, fontFamily: "var(--font-hand)", fontSize: 11 }}>
                  <span style={{ opacity: 0.7 }}>{r.done} סיום</span>
                  <span style={{ opacity: 0.3 }}>·</span>
                  <span style={{ color: "var(--accent)", fontWeight: 600 }}>{r.active} בעבודה</span>
                  <span style={{ opacity: 0.3 }}>·</span>
                  <span style={{ opacity: 0.6 }}>{r.backlog} ממתין</span>
                </div>
                {/* stacked bar */}
                <div style={{ marginTop: 8, height: 8, border: "1.2px solid var(--ink)", borderRadius: 3, display: "flex", overflow: "hidden", direction: "ltr" }}>
                  <div style={{ width: (r.done / r.total * 100) + "%", background: "var(--ink)", opacity: 0.75 }} />
                  <div style={{ width: (r.active / r.total * 100) + "%", background: "var(--accent)" }} />
                  <div style={{ width: (r.backlog / r.total * 100) + "%",
                    backgroundImage: "repeating-linear-gradient(45deg, var(--ink) 0 1.5px, transparent 1.5px 4px)" }} />
                </div>
                {r.onTimeRate !== null && (
                  <div style={{ marginTop: 8, fontFamily: "var(--font-hand)", fontSize: 11, opacity: 0.7 }}>
                    <Highlight color={r.onTimeRate >= 80 ? "var(--accent2-soft)" : r.onTimeRate >= 50 ? "var(--accent-soft)" : "rgba(208,90,114,0.25)"}>
                      בזמן: {r.onTimeRate}%
                    </Highlight>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* At-risk rail */}
        <aside>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, margin: 0, fontWeight: 700 }}>
              דורש תשומת לב
            </h2>
            <span style={{ fontFamily: "var(--font-hand)", fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>
              {atRisk.length}
            </span>
            <span style={{ flex: 1, height: 1, background: "var(--ink)", opacity: 0.2 }} />
          </div>
          <div style={{
            border: "1.5px solid var(--ink)",
            borderRadius: 6,
            background: "var(--paper)",
            padding: 0,
            boxShadow: "2px 3px 0 var(--ink)",
            overflow: "hidden",
          }}>
            {atRiskSorted.length === 0 && (
              <div style={{ padding: 16, fontFamily: "var(--font-hand)", opacity: 0.6, fontSize: 13 }}>
                אין פרויקטים בסיכון.
              </div>
            )}
            {atRiskSorted.map((p, i) => {
              const overdueDays = p.deadline ? Math.round((Math.max(p.end || now, now) - p.deadline) / DAY) : 0;
              return (
                <div key={i} style={{
                  padding: "10px 14px",
                  borderBottom: i < atRiskSorted.length - 1 ? "1px dashed var(--ink-soft)" : "none",
                  display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between",
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "var(--font-hand)", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {opts.emoji ? p.name : stripEmoji(p.name) || p.name}
                    </div>
                    <div style={{ fontFamily: "var(--font-hand)", fontSize: 11, opacity: 0.6, marginTop: 2 }}>
                      {typeLabel(p.type)} · ד״ל {fmtDate(p.deadline)}
                    </div>
                  </div>
                  <SketchTag color="var(--accent)" dashed>
                    {overdueDays > 0 ? `+${overdueDays} ימ׳` : "סיכון"}
                  </SketchTag>
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}

window.DirectionA = DirectionA;
