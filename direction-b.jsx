// Direction B — Quarter Roadmap (Swimlane Gantt by project type)
// Top: thin KPI strip · Hero: swimlane gantt with month grid · Footer: at-risk list

function DirectionB({ projects, opts }) {
  const now = NOW;

  // Roadmap range — show ~6 months centered around now (3 back, 3 forward)
  const rangeStart = new Date(2025, 11, 1).getTime();  // Dec 2025
  const rangeEnd   = new Date(2026, 7, 1).getTime();    // Aug 2026
  const totalMs = rangeEnd - rangeStart;

  // Month ticks
  const months = [];
  for (let d = new Date(rangeStart); d < new Date(rangeEnd); d.setMonth(d.getMonth() + 1)) {
    months.push(new Date(d).getTime());
  }
  const monthLabel = (ts) => new Date(ts).toLocaleDateString("he-IL", { month: "short" }).replace(".", "");

  // Filter projects that overlap the visible range AND have start+end
  const visible = projects.filter(p => p.start && p.end && p.end >= rangeStart && p.start <= rangeEnd);

  // Group by type → swimlanes
  const typeOrder = [
    "🚀Product Launch",
    "📦 New Product",
    "📦 New Product- Gummies",
    "🎁 PR Box",
    "🛍️ Accessories",
    "🎀 Wellness Club👑",
    "⚡ Promotion 15%",
    "📊A/B Tests",
    "👩‍💻 Website Dev",
    "🌀Changing Projects🔄",
    "🧬 Subscription",
    "✨ Department",
  ];
  const lanes = typeOrder.map(t => ({
    type: t,
    items: visible.filter(p => p.type === t).sort((a, b) => a.start - b.start),
  })).filter(l => l.items.length > 0);

  const xFor = (ts) => Math.max(0, Math.min(100, ((ts - rangeStart) / totalMs) * 100));

  const typeLabel = (t) => opts.emoji ? t : (TYPE_LABELS[t] || t);

  // Pack lane items into sub-rows so overlapping bars don't collide
  function packLane(items) {
    const rows = [];
    items.forEach(it => {
      let placed = false;
      for (const row of rows) {
        if (row[row.length - 1].end < it.start) {
          row.push(it);
          placed = true;
          break;
        }
      }
      if (!placed) rows.push([it]);
    });
    return rows;
  }

  // KPIs
  const active = projects.filter(p => p.status === "בעבודה").length;
  const shippingThisMonth = projects.filter(p => {
    if (p.status === "מבוטלת" || !p.deadline) return false;
    const d = new Date(p.deadline);
    const m = new Date(now);
    return d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth();
  }).length;
  const atRisk = projects.filter(p => {
    if (p.status !== "בעבודה" || !p.deadline) return false;
    return p.end > p.deadline || p.deadline < now;
  });
  const done = projects.filter(p => p.status === "הסתיימה");
  const onTimeRate = done.length ? Math.round(done.filter(p => isOnTime(p) === true).length / done.length * 100) : 0;

  return (
    <div className="dir-b" style={{ display: "grid", gap: 18 }}>
      {/* Header */}
      <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", borderBottom: "1.5px solid var(--ink)", paddingBottom: 12, gap: 24 }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 36, lineHeight: 1, fontWeight: 700 }}>
            <Highlight color="var(--accent2-soft)">מפת דרכים · רבעוני</Highlight>
          </div>
          <div style={{ fontFamily: "var(--font-hand)", fontSize: 13, opacity: 0.65, marginTop: 6 }}>
            דצמ׳ 25 ← אוגוסט 26 · קו זמן אנכי לפי סוג פרויקט
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <StatTile label="בעבודה" value={active} />
          <StatTile label="החודש" value={shippingThisMonth} />
          <StatTile label="סיכון" value={atRisk.length} accent="var(--accent)" dashed />
          <StatTile label="בזמן" value={onTimeRate + "%"} accent="var(--accent2)" />
        </div>
      </header>

      {/* Roadmap */}
      <div style={{
        border: "1.5px solid var(--ink)",
        borderRadius: 8,
        background: "var(--paper)",
        boxShadow: "3px 3px 0 var(--ink)",
        overflow: "hidden",
      }}>
        {/* Month header */}
        <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", borderBottom: "1.5px solid var(--ink)" }}>
          <div style={{ padding: "10px 14px", borderInlineStart: "1.5px solid var(--ink)", fontFamily: "var(--font-hand)", fontSize: 12, opacity: 0.6 }}>
            סוג פרויקט
          </div>
          <div style={{ position: "relative", height: 36 }}>
            <div style={{ display: "flex", height: "100%", direction: "ltr" }}>
              {months.map((m, i) => (
                <div key={i} style={{
                  flex: 1,
                  borderInlineEnd: i < months.length - 1 ? "1px dashed var(--ink-soft)" : "none",
                  fontFamily: "var(--font-hand)", fontSize: 11, opacity: 0.7,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  textTransform: "uppercase", letterSpacing: 0.5,
                }}>
                  {monthLabel(m)}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Lanes */}
        {lanes.map((lane, li) => {
          const rows = packLane(lane.items);
          const laneHeight = Math.max(40, rows.length * 26 + 12);
          return (
            <div key={lane.type} style={{
              display: "grid", gridTemplateColumns: "150px 1fr",
              borderBottom: li < lanes.length - 1 ? "1px solid var(--ink-soft)" : "none",
              minHeight: laneHeight,
            }}>
              {/* Lane label */}
              <div style={{ padding: "10px 14px", borderInlineStart: "1.5px solid var(--ink)", fontFamily: "var(--font-hand)", fontSize: 12, fontWeight: 600, lineHeight: 1.3, display: "flex", alignItems: "center" }}>
                <div>
                  {typeLabel(lane.type)}
                  <div style={{ fontFamily: "var(--font-hand)", fontSize: 10, opacity: 0.55, fontWeight: 400, marginTop: 2 }}>
                    {lane.items.length} פרויקטים
                  </div>
                </div>
              </div>
              {/* Track */}
              <div style={{ position: "relative", direction: "ltr" }}>
                {/* Month gridlines */}
                {months.map((m, i) => (
                  <div key={i} style={{
                    position: "absolute", top: 0, bottom: 0,
                    left: xFor(m) + "%",
                    width: 1, background: "var(--ink-soft)",
                    borderRight: i % 3 === 0 ? "1px solid var(--ink-soft)" : "1px dashed transparent",
                    opacity: 0.4,
                  }} />
                ))}
                {/* Today marker */}
                <div style={{
                  position: "absolute", top: 0, bottom: 0,
                  left: xFor(now) + "%",
                  width: 2, background: "var(--accent)",
                  zIndex: 3,
                }} />
                {li === 0 && (
                  <div style={{ position: "absolute", left: xFor(now) + "%", top: -22, transform: "translateX(-50%)", fontFamily: "var(--font-hand)", fontSize: 10, color: "var(--accent)", fontWeight: 700, whiteSpace: "nowrap", background: "var(--paper)", padding: "0 4px" }}>
                    היום ↓
                  </div>
                )}
                {/* Bars */}
                {rows.map((row, ri) => (
                  row.map((p, pi) => {
                    const left = xFor(p.start);
                    const right = xFor(p.end);
                    const width = Math.max(0.8, right - left);
                    const cfg = STATUS_CONFIG[p.status];
                    const isDone = cfg?.key === "done";
                    const isCancel = cfg?.key === "cancel";
                    const isActive = cfg?.key === "active";
                    const ot = isOnTime(p);
                    if (isCancel && opts.hideCancelled) return null;
                    const barColor = isCancel ? "transparent" : isActive ? "var(--accent)" : isDone ? "var(--ink)" : "var(--paper)";
                    const barOpacity = isCancel ? 0.4 : isDone ? 0.65 : 1;
                    const cleanName = opts.emoji ? p.name : (stripEmoji(p.name) || p.name);
                    return (
                      <div key={ri + "-" + pi} title={`${p.name} · ${fmtDate(p.start)} → ${fmtDate(p.end)}`} style={{
                        position: "absolute",
                        top: 6 + ri * 26,
                        left: left + "%",
                        width: width + "%",
                        height: 20,
                        border: `1.4px ${isCancel ? "dashed" : "solid"} var(--ink)`,
                        borderRadius: 4,
                        background: barColor,
                        opacity: barOpacity,
                        backgroundImage: isCancel ? "repeating-linear-gradient(45deg, var(--ink) 0 1.5px, transparent 1.5px 4px)" : "none",
                        overflow: "hidden",
                        display: "flex", alignItems: "center",
                        padding: "0 6px",
                        fontFamily: "var(--font-hand)", fontSize: 10,
                        color: isActive || isDone ? "var(--paper)" : "var(--ink)",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                        minWidth: 4,
                        boxShadow: width > 8 ? "1px 1px 0 var(--ink)" : "none",
                      }}>
                        <span style={{
                          textDecoration: isCancel ? "line-through" : "none",
                          opacity: width < 4 ? 0 : 1,
                          direction: "rtl",
                          unicodeBidi: "plaintext",
                        }}>
                          {cleanName}
                        </span>
                        {p.deadline && !isCancel && Math.abs(p.deadline - p.end) > DAY && (
                          <span style={{ position: "absolute", left: ((xFor(p.deadline) - left) / width * 100) + "%", top: -3, height: 26, width: 2, background: ot === false ? "var(--accent)" : "var(--accent2)", transform: "translateX(-1px)" }} />
                        )}
                      </div>
                    );
                  })
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontFamily: "var(--font-hand)", fontSize: 12, opacity: 0.8 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 18, height: 10, background: "var(--accent)", border: "1.2px solid var(--ink)", borderRadius: 2 }} /> בעבודה
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 18, height: 10, background: "var(--ink)", border: "1.2px solid var(--ink)", borderRadius: 2, opacity: 0.65 }} /> הסתיים
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 18, height: 10, background: "var(--paper)", border: "1.2px solid var(--ink)", borderRadius: 2 }} /> ממתין / מאושר
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 18, height: 10, border: "1.2px dashed var(--ink)", borderRadius: 2, backgroundImage: "repeating-linear-gradient(45deg, var(--ink) 0 1.5px, transparent 1.5px 4px)", opacity: 0.5 }} /> מבוטל
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 2, height: 14, background: "var(--accent)" }} /> דד־ליין / היום
        </span>
      </div>
    </div>
  );
}

window.DirectionB = DirectionB;
