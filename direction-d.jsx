// Direction D — Editorial Briefing (bold, print-style)
// Newspaper-feel: masthead, lede stat, multi-column body. Voice is direct.

function DirectionD({ projects, opts }) {
  const now = NOW;

  // Compute everything once
  const active = projects.filter(p => p.status === "בעבודה");
  const done = projects.filter(p => p.status === "הסתיימה");
  const cancelled = projects.filter(p => p.status === "מבוטלת");
  const onTimeRate = done.length ? Math.round(done.filter(p => isOnTime(p) === true).length / done.length * 100) : 0;
  const late = projects.filter(p => {
    if (p.status !== "בעבודה" || !p.deadline) return false;
    return p.end > p.deadline || p.deadline < now;
  });
  const shippingThisMonth = projects.filter(p => {
    if (p.status === "מבוטלת" || !p.deadline) return false;
    const d = new Date(p.deadline);
    const m = new Date(now);
    return d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth() && p.status !== "הסתיימה";
  }).sort((a, b) => a.deadline - b.deadline);

  // By type — focus on top 6 by activity
  const typeStats = {};
  projects.forEach(p => {
    const t = p.type || "";
    if (!t) return;
    if (!typeStats[t]) typeStats[t] = { total: 0, done: 0, active: 0, backlog: 0, dones: [] };
    typeStats[t].total++;
    if (p.status === "הסתיימה") { typeStats[t].done++; typeStats[t].dones.push(p); }
    if (p.status === "בעבודה") typeStats[t].active++;
    if (p.status === "בנק משימות") typeStats[t].backlog++;
  });

  const typeRank = Object.entries(typeStats)
    .map(([t, v]) => ({
      type: t, ...v,
      ot: v.dones.length ? Math.round(v.dones.filter(p => isOnTime(p) === true).length / v.dones.length * 100) : null,
    }))
    .sort((a, b) => (b.active + b.backlog) - (a.active + a.backlog));

  const winner = [...typeRank].filter(t => t.ot !== null && t.done >= 3).sort((a, b) => b.ot - a.ot)[0];
  const laggard = [...typeRank].filter(t => t.ot !== null && t.done >= 3).sort((a, b) => a.ot - b.ot)[0];

  const typeLabel = (t) => opts.emoji ? t : (TYPE_LABELS[t] || t);

  const todayStr = new Date(now).toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="dir-d" style={{
      maxWidth: 1100, margin: "0 auto",
      background: "var(--paper)",
      border: "2px solid var(--ink)",
      borderRadius: 4,
      padding: "32px 40px 40px",
      boxShadow: "5px 5px 0 var(--ink)",
      position: "relative",
    }}>
      {/* Masthead */}
      <div style={{ borderBottom: "3px double var(--ink)", paddingBottom: 12, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16 }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 13, letterSpacing: 6, opacity: 0.6, textTransform: "uppercase" }}>
            MAYVEN · BRIEFING · 14/05/26
          </div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 60, fontWeight: 700, lineHeight: 0.95, marginTop: 6 }}>
            תדרוך השבוע
          </div>
        </div>
        <div style={{ fontFamily: "var(--font-hand)", fontSize: 11, opacity: 0.55, textAlign: "left", lineHeight: 1.5 }}>
          {todayStr}<br/>
          {projects.length} פרויקטים<br/>
          {projects.reduce((s, p) => s + p.totalItems, 0)} משימות פתוחות
        </div>
      </div>

      {/* Lede */}
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", gap: 28, paddingBottom: 24, borderBottom: "1.5px solid var(--ink)" }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 11, letterSpacing: 3, opacity: 0.55, textTransform: "uppercase", marginBottom: 8 }}>הכותרת</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 32, lineHeight: 1.1, fontWeight: 700 }}>
            <span style={{ color: onTimeRate >= 70 ? "var(--accent2)" : "var(--accent)" }}>{onTimeRate}%</span> <Highlight>עמדו בזמן</Highlight> <br/>
            <span style={{ fontWeight: 500 }}>מתוך {done.length} שהסתיימו.</span>
          </div>
          <p style={{ fontFamily: "var(--font-hand)", fontSize: 14, lineHeight: 1.6, marginTop: 12, opacity: 0.85 }}>
            {active.length} פרויקטים בעבודה, {late.length} מהם באיחור או חוצים את הדד־ליין.
            {cancelled.length > 0 && ` ${cancelled.length} פרויקטים בוטלו ברבעון.`} {projects.filter(p => p.status === "בנק משימות").length} ממתינים בבנק־משימות, {projects.filter(p => p.status === "מאושר לביצוע").length} מאושרים לביצוע.
          </p>
        </div>

        <div style={{ borderInlineStart: "1.5px solid var(--ink)", paddingInlineStart: 20 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 11, letterSpacing: 3, opacity: 0.55, textTransform: "uppercase", marginBottom: 8 }}>השבוע</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 56, lineHeight: 1, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{shippingThisMonth.length}</div>
          <div style={{ fontFamily: "var(--font-hand)", fontSize: 13, opacity: 0.75, marginTop: 4 }}>צפויים החודש</div>
          <ul style={{ listStyle: "none", padding: 0, margin: "14px 0 0", display: "flex", flexDirection: "column", gap: 6 }}>
            {shippingThisMonth.slice(0, 5).map((p, i) => (
              <li key={i} style={{ fontFamily: "var(--font-hand)", fontSize: 12.5, lineHeight: 1.3, display: "flex", justifyContent: "space-between", gap: 8, borderBottom: "1px dashed var(--ink-soft)", paddingBottom: 4 }}>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {opts.emoji ? p.name : (stripEmoji(p.name) || p.name)}
                </span>
                <span style={{ opacity: 0.6, fontVariantNumeric: "tabular-nums" }}>{fmtDate(p.deadline)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div style={{ borderInlineStart: "1.5px solid var(--ink)", paddingInlineStart: 20 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 11, letterSpacing: 3, opacity: 0.55, textTransform: "uppercase", marginBottom: 8 }}>בסיכון</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 56, lineHeight: 1, fontWeight: 700, color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}>{late.length}</div>
          <div style={{ fontFamily: "var(--font-hand)", fontSize: 13, opacity: 0.75, marginTop: 4 }}>פרויקטים שדורשים התערבות</div>
          <ul style={{ listStyle: "none", padding: 0, margin: "14px 0 0", display: "flex", flexDirection: "column", gap: 6 }}>
            {late.slice(0, 5).map((p, i) => {
              const overdue = p.deadline ? Math.round((Math.max(p.end || now, now) - p.deadline) / DAY) : 0;
              return (
                <li key={i} style={{ fontFamily: "var(--font-hand)", fontSize: 12.5, lineHeight: 1.3, display: "flex", justifyContent: "space-between", gap: 8, borderBottom: "1px dashed var(--ink-soft)", paddingBottom: 4 }}>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {opts.emoji ? p.name : (stripEmoji(p.name) || p.name)}
                  </span>
                  <span style={{ color: "var(--accent)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>+{overdue} ימ׳</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Body — by-type column + sidebar callouts */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 32, paddingTop: 22 }}>
        <section>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 11, letterSpacing: 3, opacity: 0.55, textTransform: "uppercase", marginBottom: 8 }}>לפי סוג פרויקט</div>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, margin: "0 0 14px", lineHeight: 1.1 }}>
            איפה אנחנו ממוקדים השבוע
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {typeRank.slice(0, 6).map(r => (
              <div key={r.type} style={{ borderBottom: "1.5px solid var(--ink)", paddingBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>{typeLabel(r.type)}</div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{r.total}</div>
                </div>
                <div style={{ fontFamily: "var(--font-hand)", fontSize: 12, opacity: 0.75, marginTop: 6, lineHeight: 1.5 }}>
                  <span style={{ color: "var(--accent)", fontWeight: 600 }}>{r.active}</span> בעבודה · <span>{r.done}</span> סיום · <span style={{ opacity: 0.65 }}>{r.backlog}</span> ממתין
                  {r.ot !== null && (
                    <> · בזמן <Highlight color={r.ot >= 80 ? "var(--accent2-soft)" : r.ot >= 50 ? "var(--accent-soft)" : "rgba(208,90,114,0.25)"}>{r.ot}%</Highlight></>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside style={{ borderInlineStart: "1.5px solid var(--ink)", paddingInlineStart: 24, display: "flex", flexDirection: "column", gap: 22 }}>
          {/* Callout: winner */}
          {winner && (
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 11, letterSpacing: 3, opacity: 0.55, textTransform: "uppercase", marginBottom: 6 }}>הצטיינות</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>
                <Highlight color="var(--accent2-soft)">{typeLabel(winner.type)}</Highlight>
              </div>
              <p style={{ fontFamily: "var(--font-hand)", fontSize: 13, opacity: 0.8, marginTop: 6, lineHeight: 1.5 }}>
                <strong style={{ fontWeight: 600 }}>{winner.ot}%</strong> עמידה בזמנים מתוך {winner.done} פרויקטים שהסתיימו. הצוות הזה עומד במחויבויות.
              </p>
            </div>
          )}
          {/* Callout: laggard */}
          {laggard && laggard !== winner && (
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 11, letterSpacing: 3, opacity: 0.55, textTransform: "uppercase", marginBottom: 6 }}>צריך מבט</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>
                <Highlight color="rgba(208,90,114,0.28)">{typeLabel(laggard.type)}</Highlight>
              </div>
              <p style={{ fontFamily: "var(--font-hand)", fontSize: 13, opacity: 0.8, marginTop: 6, lineHeight: 1.5 }}>
                רק <strong style={{ fontWeight: 600, color: "var(--accent)" }}>{laggard.ot}%</strong> מ־{laggard.done} פרויקטים הסתיימו בזמן. ייתכן שצריך לכייל אומדנים או לחזק תיעדוף.
              </p>
            </div>
          )}
          {/* Pipeline mini */}
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 11, letterSpacing: 3, opacity: 0.55, textTransform: "uppercase", marginBottom: 6 }}>הצינור</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {PIPELINE_ORDER.map(s => {
                const n = projects.filter(p => p.status === s).length;
                const cfg = STATUS_CONFIG[s];
                if (cfg.key === "cancel" && opts.hideCancelled) return null;
                return (
                  <div key={s} style={{ display: "flex", alignItems: "baseline", gap: 8, borderBottom: "1px dashed var(--ink-soft)", paddingBottom: 4 }}>
                    <span style={{ fontFamily: "var(--font-hand)", fontSize: 13, flex: 1, opacity: cfg.key === "cancel" ? 0.5 : 1 }}>
                      {cfg.label}
                    </span>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, color: cfg.key === "active" ? "var(--accent)" : "var(--ink)", fontVariantNumeric: "tabular-nums", opacity: cfg.key === "cancel" ? 0.5 : 1 }}>
                      {n}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>

      {/* Footer rule */}
      <div style={{ borderTop: "3px double var(--ink)", marginTop: 24, paddingTop: 10, fontFamily: "var(--font-hand)", fontSize: 11, opacity: 0.55, textAlign: "center", letterSpacing: 1 }}>
        — סוף הדף — תדרוך הבא: 21/05/26 —
      </div>
    </div>
  );
}

window.DirectionD = DirectionD;
