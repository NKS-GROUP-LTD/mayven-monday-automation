// Worlds: Launches + Departments (lighter pages)

function WorldLaunches({ projects: allProjects }) {
  const projects = allProjects.filter(p => p.world === "launches");

  const upcoming = projects.filter(p => {
    if (!p.deadline) return false;
    return p.deadline >= NOW && p.status !== "מבוטלת";
  }).sort((a, b) => a.deadline - b.deadline);

  const past = projects.filter(p => p.status === "הסתיימה").sort((a, b) => (b.end || 0) - (a.end || 0));
  const active = projects.filter(p => p.status === "בעבודה");

  return (
    <div className="page" data-screen-label="05 Launches">
      <PageHeader
        title="השקות"
        sub={`${projects.length} פרויקטים · השקות מוצר`}
      />

      <div className="kpi-strip">
        <KPI label="צפויים" value={upcoming.length} sub="לא ירדו לאוויר עדיין" />
        <KPI label="בעבודה" value={active.length} sub="כעת" />
        <KPI label="הסתיימו" value={past.length} sub="ברבעון" accent="success" />
        <KPI label="סה״כ" value={projects.length} />
      </div>

      {/* Upcoming with big countdown */}
      {upcoming.length > 0 && (
        <Card title="השקות צפויות" sub="ספירה לאחור לפי דד־ליין">
          <div className="launch-grid">
            {upcoming.slice(0, 4).map((p, i) => {
              const daysLeft = Math.round((p.deadline - NOW) / DAY);
              return (
                <div key={i} className="launch-card">
                  <div className="launch-head">
                    <HealthPill health={p.health} size="sm" />
                    <span className="launch-owner">{p.owner}</span>
                  </div>
                  <div className="launch-name">{stripEmoji(p.name) || p.name}</div>
                  <div className="launch-countdown">
                    <span className="launch-days"><span className="ltr-inline">{daysLeft}</span></span>
                    <span className="launch-days-label">ימים להשקה</span>
                  </div>
                  <div className="launch-date">
                    <span className="ltr-inline mono">{fmtDateYr(p.deadline)}</span>
                  </div>
                  <TaskBriefLink url={p.taskBriefUrl} label="תיאור" />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* All launches table */}
      <Card padding="0" title={null}>
        <div className="dtw-table-wrap">
          <table className="dtw-table">
            <thead>
              <tr>
                <th>השקה</th>
                <th>אחראי</th>
                <th>צוות</th>
                <th>תאריך מתוכנן</th>
                <th>בפועל</th>
                <th>סטטוס</th>
                <th>בריאות</th>
                <th>תיאור</th>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 && (
                <tr><td colSpan={8}><EmptyState title="אין השקות." /></td></tr>
              )}
              {projects.sort((a, b) => (b.deadline || 0) - (a.deadline || 0)).map((p, i) => (
                <tr key={i}>
                  <td className="dtw-name">{stripEmoji(p.name) || p.name}</td>
                  <td className="muted">{p.owner}</td>
                  <td className="muted">{p.team}</td>
                  <td><span className="ltr-inline mono">{fmtDateYr(p.deadline)}</span></td>
                  <td><span className="ltr-inline mono">{fmtDateYr(p.end)}</span></td>
                  <td><StatusBadge status={p.status} /></td>
                  <td><HealthPill health={p.health} size="sm" /></td>
                  <td><TaskBriefLink url={p.taskBriefUrl} label="פתח" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function WorldDepartments({ projects: allProjects }) {
  const projects = allProjects.filter(p => p.world === "departments");
  return (
    <div className="page" data-screen-label="06 Departments">
      <PageHeader
        title="מחלקות"
        sub={`${projects.length} פרויקטים · עבודה רוחבית מחלקתית`}
      />

      <div className="kpi-strip">
        <KPI label="פעילים" value={projects.filter(p => p.status === "בעבודה").length} />
        <KPI label="הסתיימו" value={projects.filter(p => p.status === "הסתיימה").length} accent="success" />
        <KPI label="ממתינים" value={projects.filter(p => p.status === "בנק משימות").length} />
        <KPI label="סה״כ" value={projects.length} />
      </div>

      <Card padding="0" title={null}>
        <div className="dtw-table-wrap">
          <table className="dtw-table">
            <thead>
              <tr>
                <th>פרויקט</th>
                <th>אחראי</th>
                <th>טווח</th>
                <th>סטטוס</th>
                <th>בריאות</th>
                <th>תיאור</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p, i) => (
                <tr key={i}>
                  <td className="dtw-name">{stripEmoji(p.name) || p.name}</td>
                  <td className="muted">{p.owner}</td>
                  <td><span className="ltr-inline mono">{fmtDate(p.start)} → {fmtDate(p.end)}</span></td>
                  <td><StatusBadge status={p.status} /></td>
                  <td><HealthPill health={p.health} size="sm" /></td>
                  <td><TaskBriefLink url={p.taskBriefUrl} label="פתח" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

Object.assign(window, { WorldLaunches, WorldDepartments });
