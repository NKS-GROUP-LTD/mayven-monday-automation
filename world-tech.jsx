// World: Tech & dev — Website Dev, A/B Tests, Subscription.
// Adds: Priority filter, Tech sub-type column, Requesting dept column.

function WorldTech({ projects: allProjects, filters }) {
  const projects = allProjects.filter(p => p.world === "tech");
  const [subFilter, setSubFilter] = React.useState("all");
  const [prioFilter, setPrioFilter] = React.useState("all");
  const [reqFilter, setReqFilter] = React.useState("all");

  // KPIs
  const active = projects.filter(p => p.status === "בעבודה");
  const highPrio = projects.filter(p => p.priority === "High" && p.status !== "הסתיימה" && p.status !== "מבוטלת");
  const red = projects.filter(p => p.health === "red");
  const abTests = projects.filter(p => p.type === "📊A/B Tests");
  const abActive = abTests.filter(p => p.status === "בעבודה");

  // Sub-type breakdown (active + backlog only — what's the load)
  const subTypeStats = TECH_SUBTYPES.map(st => {
    const all = projects.filter(p => p.techSubType === st && p.status !== "הסתיימה" && p.status !== "מבוטלת");
    return {
      key: st,
      label: TECH_SUBTYPE_HE[st],
      total: all.length,
      red:    all.filter(p => p.health === "red").length,
      yellow: all.filter(p => p.health === "yellow").length,
      active: all.filter(p => p.status === "בעבודה").length,
    };
  }).filter(s => s.total > 0).sort((a, b) => b.total - a.total);

  // Requesting dept breakdown
  const reqDeptStats = REQUESTING_DEPTS.map(rd => {
    const all = projects.filter(p => p.requestingDept === rd && p.status !== "הסתיימה" && p.status !== "מבוטלת");
    return {
      key: rd,
      total: all.length,
      active: all.filter(p => p.status === "בעבודה").length,
      red: all.filter(p => p.health === "red").length,
    };
  }).filter(s => s.total > 0).sort((a, b) => b.total - a.total);

  // Filtered list
  const list = projects
    .filter(p => subFilter === "all" || p.techSubType === subFilter)
    .filter(p => prioFilter === "all" || p.priority === prioFilter)
    .filter(p => reqFilter === "all" || p.requestingDept === reqFilter)
    .sort((a, b) => {
      // Active first, then by health: red > yellow > green, then by deadline
      const aActive = a.status === "בעבודה" ? 0 : a.status === "מאושר לביצוע" ? 1 : 2;
      const bActive = b.status === "בעבודה" ? 0 : b.status === "מאושר לביצוע" ? 1 : 2;
      if (aActive !== bActive) return aActive - bActive;
      const hr = { red: 0, yellow: 1, green: 2, done: 3, cancel: 4 };
      if (hr[a.health] !== hr[b.health]) return hr[a.health] - hr[b.health];
      return (a.deadline || Infinity) - (b.deadline || Infinity);
    });

  return (
    <div className="page" data-screen-label="02 Tech & Dev">
      <PageHeader
        title="פיתוחים טכנולוגיים"
        sub={`${projects.length} פרויקטים · פיתוח אתר, מנויים, A/B testing`}
      />

      {/* KPI strip */}
      <div className="kpi-strip">
        <KPI label="פעילים" value={active.length} sub={`מתוך ${projects.length} סה״כ`} />
        <KPI label="High Priority" value={highPrio.length} sub="פתוחים" accent="warning" />
        <KPI label="באיחור" value={red.length} accent="danger" sub="חוצים דד־ליין" icon={ICONS.alertTriangle} />
        <KPI label="A/B Tests" value={abActive.length} sub={`${abTests.length} סה״כ · ${abActive.length} רצים`} />
      </div>

      {/* Sub-type + Requesting dept breakdown */}
      <div className="row-1-1">
        <Card title="לפי סוג פיתוח" sub="עומס פעיל לפי תחום טכני" >
          <div className="bt-list">
            {subTypeStats.map(s => (
              <button
                key={s.key}
                className={"bt-row " + (subFilter === s.key ? "bt-row-active" : "")}
                onClick={() => setSubFilter(subFilter === s.key ? "all" : s.key)}
              >
                <div className="bt-label">{s.label}</div>
                <div className="bt-bar">
                  <div className="bt-bar-fill" style={{ width: (s.total / Math.max(1, ...subTypeStats.map(x => x.total)) * 100) + "%" }}>
                    <span className="bt-bar-num"><span className="ltr-inline">{s.active}</span></span>
                  </div>
                </div>
                <div className="bt-counts">
                  {s.red > 0 && <span className="bt-red"><span className="ltr-inline">{s.red}</span></span>}
                  {s.yellow > 0 && <span className="bt-yellow"><span className="ltr-inline">{s.yellow}</span></span>}
                  <span className="bt-total"><span className="ltr-inline">{s.total}</span></span>
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card title="מי מבקש פיתוחים" sub="לפי מחלקה מבקשת">
          <div className="bt-list">
            {reqDeptStats.map(s => (
              <button
                key={s.key}
                className={"bt-row " + (reqFilter === s.key ? "bt-row-active" : "")}
                onClick={() => setReqFilter(reqFilter === s.key ? "all" : s.key)}
              >
                <div className="bt-label">{s.key}</div>
                <div className="bt-bar">
                  <div className="bt-bar-fill" style={{ width: (s.total / Math.max(1, ...reqDeptStats.map(x => x.total)) * 100) + "%" }}>
                    <span className="bt-bar-num"><span className="ltr-inline">{s.active}</span></span>
                  </div>
                </div>
                <div className="bt-counts">
                  {s.red > 0 && <span className="bt-red"><span className="ltr-inline">{s.red}</span></span>}
                  <span className="bt-total"><span className="ltr-inline">{s.total}</span></span>
                </div>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Filter chips */}
      <div className="chip-bar">
        <div className="chip-group">
          <span className="chip-label">פילטר:</span>
          {[
            { key: "all", he: "כל הפרויקטים" },
            { key: "High", he: "High Priority" },
            { key: "Medium", he: "Medium" },
            { key: "Low", he: "Low" },
          ].map(c => (
            <button key={c.key} className={"chip " + (prioFilter === c.key ? "chip-active" : "")}
              onClick={() => setPrioFilter(c.key)}>
              {c.he}
            </button>
          ))}
        </div>
        <div className="chip-meta">{list.length} פרויקטים מתוך {projects.length}</div>
      </div>

      {/* Main table */}
      <Card padding="0" title={null}>
        <div className="dtw-table-wrap">
          <table className="dtw-table">
            <thead>
              <tr>
                <th>פרויקט</th>
                <th>סוג פיתוח</th>
                <th>מבקש</th>
                <th>אחראי</th>
                <th>פריוריטי</th>
                <th>סטטוס</th>
                <th>דד־ליין</th>
                <th>משך</th>
                <th>בריאות</th>
                <th>תיאור</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && (
                <tr><td colSpan={10}><EmptyState title="אין פרויקטים בפילטר הזה." /></td></tr>
              )}
              {list.slice(0, 50).map((p, i) => {
                const dur = durationDays(p.start, p.end);
                return (
                  <tr key={i}>
                    <td className="dtw-name">{stripEmoji(p.name) || p.name}</td>
                    <td className="muted">{TECH_SUBTYPE_HE[p.techSubType] || p.techSubType}</td>
                    <td className="muted">{p.requestingDept}</td>
                    <td className="muted">{p.owner}</td>
                    <td><PriorityPill priority={p.priority} /></td>
                    <td><StatusBadge status={p.status} /></td>
                    <td><span className="ltr-inline mono">{fmtDateYr(p.deadline)}</span></td>
                    <td className="muted"><span className="ltr-inline">{dur != null ? dur + " י׳" : "—"}</span></td>
                    <td><HealthPill health={p.health} size="sm" /></td>
                    <td><TaskBriefLink url={p.taskBriefUrl} label="פתח" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {list.length > 50 && (
          <div className="table-foot">מציג 50 ראשונים מתוך {list.length}</div>
        )}
      </Card>
    </div>
  );
}

window.WorldTech = WorldTech;
