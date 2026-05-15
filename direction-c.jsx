// Direction C — Risk-First Triage (bold)
// "What do I act on this morning?" — single big risk number, then a board of
// stuck/late/at-risk grouped by urgency. Right rail: workload heatmap by type.

function DirectionC({ projects, opts }) {
  const now = NOW;

  function projectRisk(p) {
    if (p.status === "מבוטלת" || p.status === "הסתיימה") return null;
    if (!p.deadline) return null;
    const ddDelta = (p.deadline - now) / DAY;       // days until deadline
    const endDelta = p.end ? (p.end - p.deadline) / DAY : 0;  // projected slip
    if (p.status === "בעבודה" && (ddDelta < 0 || endDelta > 0)) return "late";
    if (p.status === "בעבודה" && ddDelta < 7) return "soon";
    if (p.status === "בנק משימות" && ddDelta < 0) return "stuck";
    if (p.status === "מאושר לביצוע" && ddDelta < 14) return "starting";
    return null;
  }

  const buckets = { late: [], stuck: [], soon: [], starting: [] };
  projects.forEach(p => {
    const r = projectRisk(p);
    if (r && buckets[r]) buckets[r].push(p);
  });
  Object.values(buckets).forEach(arr => arr.sort((a, b) => (a.deadline || 0) - (b.deadline || 0)));

  const totalRisk = buckets.late.length + buckets.stuck.length;
  const totalAttention = totalRisk + buckets.soon.length + buckets.starting.length;

  // Workload heatmap — for each type, count {late, soon, active, backlog}
  const typeCounts = {};
  projects.forEach(p => {
    const t = p.type || "ללא";
    if (!typeCounts[t]) typeCounts[t] = { active: 0, soon: 0, late: 0, backlog: 0, total: 0 };
    typeCounts[t].total++;
    if (p.status === "בעבודה") typeCounts[t].active++;
    if (p.status === "בנק משימות") typeCounts[t].backlog++;
    const r = projectRisk(p);
    if (r === "late" || r === "stuck") typeCounts[t].late++;
    if (r === "soon") typeCounts[t].soon++;
  });
  const heatRows = Object.entries(typeCounts)
    .filter(([t]) => t !== "")
    .sort((a, b) => (b[1].late + b[1].soon) - (a[1].late + a[1].soon));

  const typeLabel = (t) => opts.emoji ? t : (TYPE_LABELS[t] || t);

  const Bucket = ({ title, sub, items, accent, dashed }) => (
    <div style={{
      border: `1.5px ${dashed ? "dashed" : "solid"} var(--ink)`,
      borderRadius: 8,
      background: "var(--paper)",
      boxShadow: "3px 3px 0 var(--ink)",
      padding: "14px 16px",
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700 }}>{title}</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 700, color: accent, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
          {items.length}
        </div>
      </div>
      <div style={{ fontFamily: "var(--font-hand)", fontSize: 11, opacity: 0.65, marginTop: -4 }}>{sub}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" }}>
        {items.length === 0 && <div style={{ fontFamily: "var(--font-hand)", fontSize: 12, opacity: 0.45, padding: "8px 0" }}>— נקי —</div>}
        {items.slice(0, 12).map((p, i) => {
          const ddDelta = p.deadline ? Math.round((p.deadline - now) / DAY) : null;
          const endDelta = p.deadline && p.end ? Math.round((p.end - p.deadline) / DAY) : null;
          const cleanName = opts.emoji ? p.name : (stripEmoji(p.name) || p.name);
          return (
            <div key={i} style={{
              borderTop: i === 0 ? "1px dashed var(--ink-soft)" : "1px dashed var(--ink-soft)",
              paddingTop: 6,
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "var(--font-hand)", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.3 }}>
                  {cleanName}
                </div>
                <div style={{ fontFamily: "var(--font-hand)", fontSize: 10.5, opacity: 0.6, marginTop: 1 }}>
                  {typeLabel(p.type)} · ד״ל {fmtDate(p.deadline)}
                </div>
              </div>
              <div style={{ textAlign: "center", minWidth: 50 }}>
                {endDelta !== null && endDelta > 0 ? (
                  <>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, color: accent, lineHeight: 1 }}>
                      +{endDelta}
                    </div>
                    <div style={{ fontFamily: "var(--font-hand)", fontSize: 9, opacity: 0.6 }}>ימי איחור</div>
                  </>
                ) : ddDelta !== null && ddDelta < 0 ? (
                  <>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, color: accent, lineHeight: 1 }}>
                      −{Math.abs(ddDelta)}
                    </div>
                    <div style={{ fontFamily: "var(--font-hand)", fontSize: 9, opacity: 0.6 }}>עברו</div>
                  </>
                ) : ddDelta !== null ? (
                  <>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, lineHeight: 1 }}>
                      {ddDelta}
                    </div>
                    <div style={{ fontFamily: "var(--font-hand)", fontSize: 9, opacity: 0.6 }}>ימים</div>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
        {items.length > 12 && (
          <div style={{ fontFamily: "var(--font-hand)", fontSize: 11, opacity: 0.5, textAlign: "center", paddingTop: 4 }}>
            +{items.length - 12} נוספים
          </div>
        )}
      </div>
    </div>
  );

  const maxHeat = Math.max(1, ...heatRows.map(([, v]) => v.late + v.soon + v.active));

  return (
    <div className="dir-c" style={{ display: "grid", gap: 20 }}>
      {/* Hero */}
      <header style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20, alignItems: "stretch" }}>
        <div style={{
          border: "2px solid var(--ink)",
          borderRadius: 10,
          padding: "22px 26px",
          background: "var(--accent-soft)",
          boxShadow: "4px 4px 0 var(--ink)",
          position: "relative",
        }}>
          <div style={{ fontFamily: "var(--font-hand)", fontSize: 13, opacity: 0.75, textTransform: "uppercase", letterSpacing: 1 }}>
            ◇ מצב בוקר ◇ 14 במאי 2026
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 6 }}>
            <div style={{
              fontFamily: "var(--font-display)", fontSize: 96, lineHeight: 0.9, fontWeight: 700,
              color: "var(--accent)",
              fontVariantNumeric: "tabular-nums",
            }}>
              {totalRisk}
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, lineHeight: 1.1 }}>
              פרויקטים<br/>שדורשים<br/>החלטה היום.
            </div>
          </div>
          <HandUnderline color="var(--ink)" width="60%" />
          <div style={{ fontFamily: "var(--font-hand)", fontSize: 13, marginTop: 12, opacity: 0.8 }}>
            {totalAttention} סך הכל פתוחים לתשומת לב.<br/>
            <span style={{ opacity: 0.65 }}>איחור, תקיעות, ודד־ליינים בשבועיים הקרובים.</span>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateRows: "repeat(3, 1fr)", gap: 10 }}>
          <SummaryRow label="באיחור" count={buckets.late.length} accent="var(--accent)" hint="עברו דד־ליין או צופים להחמיץ" />
          <SummaryRow label="תקועים" count={buckets.stuck.length} accent="var(--accent)" hint="בנק־משימות שעבר הדד־ליין שלהם" dashed />
          <SummaryRow label="ממתינים להחלטה" count={buckets.starting.length} accent="var(--accent2)" hint="מאושרים לביצוע — צריך להתחיל" />
        </div>
      </header>

      {/* Buckets */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
        <Bucket title="באיחור" sub="עברו דד־ליין · בעבודה" items={buckets.late} accent="var(--accent)" />
        <Bucket title="תקועים" sub="בנק־משימות · דד־ליין עבר" items={buckets.stuck} accent="var(--accent)" dashed />
        <Bucket title="השבוע" sub="בעבודה · דד־ליין בשבוע" items={buckets.soon} accent="var(--ink)" />
        <Bucket title="להתחיל" sub="מאושר לביצוע · בשבועיים" items={buckets.starting} accent="var(--accent2)" />
      </div>

      {/* Heatmap */}
      <section>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 10 }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, margin: 0, fontWeight: 700 }}>
            עומס לפי סוג
          </h2>
          <span style={{ fontFamily: "var(--font-hand)", fontSize: 12, opacity: 0.6 }}>איפה מצטברים סיכונים</span>
          <span style={{ flex: 1, height: 1, background: "var(--ink)", opacity: 0.2 }} />
        </div>
        <div style={{
          border: "1.5px solid var(--ink)", borderRadius: 8, background: "var(--paper)",
          boxShadow: "2px 3px 0 var(--ink)", overflow: "hidden",
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 80px 80px 80px", borderBottom: "1.5px solid var(--ink)" }}>
            {["סוג","עומס נוכחי","באיחור","השבוע","ממתין"].map((h, i) => (
              <div key={i} style={{ padding: "8px 12px", fontFamily: "var(--font-hand)", fontSize: 11, fontWeight: 600, opacity: 0.75, textAlign: i === 0 ? "right" : "center", borderInlineStart: i === 0 ? "none" : "1px dashed var(--ink-soft)" }}>{h}</div>
            ))}
          </div>
          {heatRows.map(([type, v], i) => {
            const heat = v.late + v.soon + v.active;
            const intensity = heat / maxHeat;
            return (
              <div key={type} style={{ display: "grid", gridTemplateColumns: "200px 1fr 80px 80px 80px", borderBottom: i < heatRows.length - 1 ? "1px dashed var(--ink-soft)" : "none", alignItems: "center" }}>
                <div style={{ padding: "8px 12px", fontFamily: "var(--font-hand)", fontSize: 12.5, fontWeight: 600 }}>{typeLabel(type)}</div>
                <div style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, height: 14, border: "1.2px solid var(--ink)", borderRadius: 3, display: "flex", direction: "ltr", overflow: "hidden" }}>
                    <div style={{ width: (v.late / Math.max(1, heat)) * 100 * intensity + "%", background: "var(--accent)" }} />
                    <div style={{ width: (v.soon / Math.max(1, heat)) * 100 * intensity + "%", background: "var(--accent)", opacity: 0.45 }} />
                    <div style={{ width: ((v.active - v.late - v.soon) / Math.max(1, heat)) * 100 * intensity + "%", background: "var(--ink)", opacity: 0.7 }} />
                  </div>
                  <span style={{ fontFamily: "var(--font-hand)", fontSize: 11, opacity: 0.6, minWidth: 40 }}>{v.total} סה״כ</span>
                </div>
                <CellNum n={v.late} hot />
                <CellNum n={v.soon} />
                <CellNum n={v.backlog} muted />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function SummaryRow({ label, count, accent, hint, dashed }) {
  return (
    <div style={{
      border: `1.5px ${dashed ? "dashed" : "solid"} var(--ink)`,
      borderRadius: 8,
      padding: "10px 16px",
      background: "var(--paper)",
      boxShadow: "2px 3px 0 var(--ink)",
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
    }}>
      <div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700 }}>{label}</div>
        <div style={{ fontFamily: "var(--font-hand)", fontSize: 11, opacity: 0.6, marginTop: 2 }}>{hint}</div>
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 38, fontWeight: 700, color: accent, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
        {count}
      </div>
    </div>
  );
}

function CellNum({ n, hot, muted }) {
  return (
    <div style={{
      padding: "8px 12px", textAlign: "center", borderInlineStart: "1px dashed var(--ink-soft)",
      fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700,
      color: n === 0 ? "rgba(0,0,0,0.25)" : hot ? "var(--accent)" : muted ? "var(--ink)" : "var(--ink)",
      opacity: muted ? 0.6 : 1,
      fontVariantNumeric: "tabular-nums",
    }}>
      {n || "—"}
    </div>
  );
}

window.DirectionC = DirectionC;
