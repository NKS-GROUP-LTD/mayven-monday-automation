// World: Campaigns — Wellness Club, Changing Projects, Promotion 15%.
// Calendar-style view: monthly grid showing what campaigns are live each week.

function WorldCampaigns({ projects: allProjects, filters }) {
  const projects = allProjects.filter(p => p.world === "campaigns");
  const [typeFilter, setTypeFilter] = React.useState("all");

  const types = [
    { key: "all", he: "הכל" },
    { key: "🎀 Wellness Club👑", he: "Wellness Club" },
    { key: "🌀Changing Projects🔄", he: "פרויקטים משתנים" },
    { key: "⚡ Promotion 15%", he: "מבצעי 15%" },
  ];

  const active = projects.filter(p => p.status === "בעבודה");
  const upcoming = projects.filter(p => {
    if (!p.start || !p.end) return false;
    return p.start >= NOW && p.start <= NOW + 60 * DAY && p.status !== "מבוטלת";
  });
  const live = projects.filter(p => {
    if (!p.start || !p.end) return false;
    return p.start <= NOW && p.end >= NOW && p.status !== "מבוטלת" && p.status !== "הסתיימה";
  });

  const list = projects
    .filter(p => typeFilter === "all" || p.type === typeFilter)
    .filter(p => p.start)
    .sort((a, b) => a.start - b.start);

  // Calendar range: 2 months back to 3 months forward
  const calStart = new Date(NOW); calStart.setMonth(calStart.getMonth() - 2); calStart.setDate(1);
  const calEnd   = new Date(NOW); calEnd.setMonth(calEnd.getMonth() + 4); calEnd.setDate(0);
  const months = [];
  for (let d = new Date(calStart); d <= calEnd; d.setMonth(d.getMonth() + 1)) {
    months.push({ ts: new Date(d).getTime(), label: new Date(d).toLocaleDateString("he-IL", { month: "long", year: "2-digit" }) });
  }

  // For each campaign in list, find its month-slot
  function eventsByMonth(arr) {
    const byMonth = {};
    months.forEach(m => byMonth[m.ts] = []);
    arr.forEach(p => {
      const m = new Date(p.start); m.setDate(1); m.setHours(0,0,0,0);
      const key = m.getTime();
      if (byMonth[key]) byMonth[key].push(p);
    });
    return byMonth;
  }
  const calData = eventsByMonth(list);

  return (
    <div className="page" data-screen-label="04 Campaigns">
      <PageHeader
        title="קמפיינים"
        sub={`${projects.length} פרויקטים · Wellness Club, פרויקטים משתנים, מבצעי 15%`}
      />

      <div className="kpi-strip">
        <KPI label="חיים עכשיו" value={live.length} sub="באוויר" accent="success" />
        <KPI label="פעילים" value={active.length} sub="בהכנה" />
        <KPI label="ב־60 ימים הבאים" value={upcoming.length} sub="צפויים להתחיל" />
        <KPI label="סה״כ ברבעון" value={projects.length} sub="כל הקמפיינים" />
      </div>

      {/* Currently live */}
      {live.length > 0 && (
        <Card title="חיים עכשיו" sub="קמפיינים שבאוויר ברגע זה">
          <LiveCampaigns items={live} />
        </Card>
      )}

      {/* Type filter strip */}
      <div className="tabs-strip">
        {types.map(t => (
          <button key={t.key} className={"tab-strip-item " + (typeFilter === t.key ? "tab-strip-active" : "")}
            onClick={() => setTypeFilter(t.key)}>
            <span>{t.he}</span>
            <span className="tab-strip-count"><span className="ltr-inline">{t.key === "all" ? projects.length : projects.filter(p => p.type === t.key).length}</span></span>
          </button>
        ))}
      </div>

      {/* Calendar view */}
      <Card title="לוח שנה — קמפיינים" sub="חודשיים אחורה, שלושה קדימה. עוגן: היום">
        <CampaignsCalendar months={months} data={calData} />
      </Card>

      {/* Detailed list */}
      <Card padding="0" title={null}>
        <div className="dtw-table-wrap">
          <table className="dtw-table">
            <thead>
              <tr>
                <th>קמפיין</th>
                <th>סוג</th>
                <th>אחראי</th>
                <th>צוות</th>
                <th>חלון פעילות</th>
                <th>סטטוס</th>
                <th>בריאות</th>
                <th>תיאור</th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, 50).map((p, i) => {
                const cleanName = stripEmoji(p.name) || p.name;
                const dur = durationDays(p.start, p.end);
                return (
                  <tr key={i}>
                    <td className="dtw-name">{cleanName}</td>
                    <td className="muted">{TYPE_LABELS[p.type] || p.type}</td>
                    <td className="muted">{p.owner}</td>
                    <td className="muted">{p.team}</td>
                    <td>
                      <span className="ltr-inline mono">{fmtDateYr(p.start)}</span>
                      {dur > 0 && <> → <span className="ltr-inline mono">{fmtDateYr(p.end)}</span> <span className="dur-tag">{dur}י׳</span></>}
                    </td>
                    <td><StatusBadge status={p.status} /></td>
                    <td><HealthPill health={p.health} size="sm" /></td>
                    <td><TaskBriefLink url={p.taskBriefUrl} label="פתח" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function LiveCampaigns({ items }) {
  return (
    <div className="live-grid">
      {items.map((p, i) => {
        const total = (p.end - p.start) / DAY;
        const elapsed = (NOW - p.start) / DAY;
        const pct = total > 0 ? Math.min(100, (elapsed / total) * 100) : 0;
        return (
          <div key={i} className="live-card">
            <div className="live-pulse" />
            <div className="live-head">
              <span className="cat-pill">{TYPE_LABELS[p.type] || p.type}</span>
              <span className="live-label">באוויר</span>
            </div>
            <div className="live-name">{stripEmoji(p.name) || p.name}</div>
            <div className="live-progress">
              <div className="live-progress-fill" style={{ width: pct + "%" }} />
            </div>
            <div className="live-foot">
              <span><span className="ltr-inline mono">{fmtDate(p.start)}</span></span>
              <span className="live-meta">{Math.round(elapsed)}/{Math.round(total)} ימים</span>
              <span><span className="ltr-inline mono">{fmtDate(p.end)}</span></span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CampaignsCalendar({ months, data }) {
  return (
    <div className="cal-strip">
      {months.map(m => {
        const items = data[m.ts] || [];
        const isCurrent = (() => {
          const d = new Date(m.ts); const n = new Date(NOW);
          return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
        })();
        return (
          <div key={m.ts} className={"cal-month " + (isCurrent ? "cal-month-current" : "")}>
            <div className="cal-month-head">
              <span className="cal-month-label">{m.label}</span>
              {isCurrent && <span className="cal-now-tag">היום</span>}
              <span className="cal-count"><span className="ltr-inline">{items.length}</span></span>
            </div>
            <div className="cal-month-body">
              {items.length === 0 && <div className="cal-empty">—</div>}
              {items.map((p, i) => {
                const day = new Date(p.start).getDate();
                return (
                  <div key={i} className={"cal-evt cal-evt-" + STATUS_CONFIG[p.status]?.key}>
                    <span className="cal-day"><span className="ltr-inline">{day}</span></span>
                    <span className="cal-evt-name">{stripEmoji(p.name) || p.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

window.WorldCampaigns = WorldCampaigns;
