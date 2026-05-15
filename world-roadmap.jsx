// World: Roadmap — quarterly swimlane Gantt by project type
// Ported from v1 Direction B with sketchy aesthetic.

function WorldRoadmap({ projects, filters }) {
  // Range: 3 months back to 4 months forward (8 months total)
  const now = NOW;
  const rangeStart = new Date(2025, 11, 1).getTime();  // Dec 2025
  const rangeEnd   = new Date(2026, 7, 1).getTime();    // Aug 2026
  const totalMs = rangeEnd - rangeStart;

  // Month ticks (must produce 8 entries — Dec, Jan, Feb, Mar, Apr, May, Jun, Jul)
  const months = [];
  for (let d = new Date(rangeStart); d < new Date(rangeEnd); d.setMonth(d.getMonth() + 1)) {
    months.push(new Date(d).getTime());
  }

  const monthLabel = (ts) => new Date(ts).toLocaleDateString("he-IL", { month: "short" }).replace(".", "");

  // Filter: only projects with valid start+end overlapping range
  const visible = projects.filter(p => p.start && p.end && p.end >= rangeStart && p.start <= rangeEnd);

  // Group by type → swimlanes (ordered)
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

  return (
    <div className="page" data-screen-label="02 Roadmap">
      <PageHeader
        title="מפת דרכים"
        sub={`חצי שנה אחורה, חצי שנה קדימה · ${visible.length} פרויקטים על ציר הזמן · עוגן: היום`}
      />

      <Card padding="0" title={null}>
        <div className="rm-grid">
          <div className="rm-headcell">סוג פרויקט</div>
          <div className="rm-monthrow">
            {months.map((m, i) => (
              <div key={i} className="rm-monthcell">{monthLabel(m)}</div>
            ))}
          </div>

          {lanes.map((lane, li) => {
            const rows = packLane(lane.items);
            const laneHeight = Math.max(46, rows.length * 28 + 14);
            const isLastLane = li === lanes.length - 1;
            return (
              <React.Fragment key={lane.type}>
                <div className="rm-lanelabel" style={{
                  borderBottom: isLastLane ? "none" : "1px dashed var(--ink-soft)",
                  minHeight: laneHeight,
                }}>
                  <div>
                    {TYPE_LABELS[lane.type] || lane.type}
                    <div className="rm-lanelabel-sub">{lane.items.length} פרויקטים</div>
                  </div>
                </div>
                <div className="rm-track" style={{
                  minHeight: laneHeight,
                  borderBottom: isLastLane ? "none" : "1px dashed var(--ink-soft)",
                }}>
                  {/* Today marker */}
                  <div className="rm-today" style={{ left: xFor(now) + "%" }} />
                  {li === 0 && (
                    <div className="rm-today-label" style={{ left: xFor(now) + "%" }}>היום ↓</div>
                  )}
                  {/* Bars */}
                  {rows.map((row, ri) => (
                    row.map((p, pi) => {
                      const left = xFor(p.start);
                      const right = xFor(p.end);
                      const width = Math.max(0.8, right - left);
                      const cfg = STATUS_CONFIG[p.status];
                      const statusKey = cfg?.key || "backlog";
                      const cleanName = stripEmoji(p.name) || p.name;
                      return (
                        <div
                          key={ri + "-" + pi}
                          className="rm-bar"
                          data-status={statusKey}
                          title={`${p.name} · ${fmtDate(p.start)} → ${fmtDate(p.end)}`}
                          style={{
                            top: 8 + ri * 28,
                            left: left + "%",
                            width: width + "%",
                            minWidth: 4,
                          }}>
                          <span className="rm-bar-name">{cleanName}</span>
                        </div>
                      );
                    })
                  ))}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </Card>

      {/* Legend */}
      <div className="rm-legend">
        <span className="rm-legend-item">
          <span className="rm-legend-swatch" style={{ background: "var(--accent)" }} /> בעבודה
        </span>
        <span className="rm-legend-item">
          <span className="rm-legend-swatch" style={{ background: "var(--ink)", opacity: 0.65 }} /> הסתיים
        </span>
        <span className="rm-legend-item">
          <span className="rm-legend-swatch" style={{ background: "var(--paper)" }} /> ממתין / מאושר
        </span>
        <span className="rm-legend-item">
          <span className="rm-legend-swatch" style={{ borderStyle: "dashed", backgroundImage: "repeating-linear-gradient(45deg, var(--ink) 0 1.5px, transparent 1.5px 4px)", opacity: 0.5 }} /> מבוטל
        </span>
        <span className="rm-legend-item">
          <span className="rm-legend-swatch" style={{ background: "var(--accent)", width: 2 }} /> היום
        </span>
      </div>
    </div>
  );
}

window.WorldRoadmap = WorldRoadmap;
