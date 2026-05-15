// World: New Product — Edibles, Gummies, PR Boxes, Samples, Accessories.
// Key adds: Planned vs Actual (Baseline) placeholder, sub-type tabs, next launches.

function WorldProduct({ projects: allProjects, filters }) {
  const projects = allProjects.filter(p => p.world === "product");
  const [subFilter, setSubFilter] = React.useState("all");

  // Sub-types present
  const subTypes = ["Edible", "Gummies", "PR Box", "Sample", "Accessories"];

  // KPIs
  const active = projects.filter(p => p.status === "בעבודה");
  const launching = projects.filter(p => {
    if (!p.deadline) return false;
    return p.deadline >= NOW && p.deadline <= NOW + 30 * DAY && p.status !== "הסתיימה" && p.status !== "מבוטלת";
  }).sort((a, b) => a.deadline - b.deadline);
  const red = projects.filter(p => p.health === "red");

  // Filtered list
  const list = projects.filter(p => subFilter === "all" || p.productSubType === subFilter);

  // Build sub-type tab data
  const subTabs = ["all", ...subTypes].map(st => ({
    key: st,
    label: st === "all" ? "הכל" : st,
    count: st === "all" ? projects.length : projects.filter(p => p.productSubType === st).length,
  })).filter(t => t.count > 0 || t.key === "all");

  // Sort: active+upcoming first, then health
  const sorted = [...list].sort((a, b) => {
    const aActive = a.status === "בעבודה" ? 0 : a.status === "מאושר לביצוע" ? 1 : a.status === "בנק משימות" ? 2 : 3;
    const bActive = b.status === "בעבודה" ? 0 : b.status === "מאושר לביצוע" ? 1 : b.status === "בנק משימות" ? 2 : 3;
    if (aActive !== bActive) return aActive - bActive;
    return (a.deadline || Infinity) - (b.deadline || Infinity);
  });

  return (
    <div className="page" data-screen-label="03 New Product">
      <PageHeader
        title="מוצר חדש"
        sub={`${projects.length} פרויקטים · השקות, סמפלים, PR Box, אקססוריז`}
      />

      {/* KPI strip */}
      <div className="kpi-strip">
        <KPI label="פעילים" value={active.length} sub={`מתוך ${projects.length}`} />
        <KPI label="ב־30 ימים הבאים" value={launching.length} sub="צפויים לעלות" />
        <KPI label="באיחור" value={red.length} accent="danger" icon={ICONS.alertTriangle} />
        <KPI label="סוגי מוצר" value={subTabs.length - 1} sub="קטגוריות פעילות" />
      </div>

      {/* Hero: Next launches */}
      <Card title="ההשקות הבאות" sub="פרויקטים שדד־הליין שלהם בחודש הקרוב" action={<a className="card-action" href="#schedule">לוח השקות מלא ←</a>}>
        <NextLaunches items={launching.slice(0, 6)} />
      </Card>

      {/* Baseline placeholder notice */}
      <BaselineNotice />

      {/* Sub-type tabs */}
      <div className="tabs-strip">
        {subTabs.map(t => (
          <button
            key={t.key}
            className={"tab-strip-item " + (subFilter === t.key ? "tab-strip-active" : "")}
            onClick={() => setSubFilter(t.key)}
          >
            <span>{t.label}</span>
            <span className="tab-strip-count"><span className="ltr-inline">{t.count}</span></span>
          </button>
        ))}
      </div>

      {/* Main table with Planned vs Actual */}
      <Card padding="0" title={null}>
        <div className="dtw-table-wrap">
          <table className="dtw-table">
            <thead>
              <tr>
                <th>פרויקט</th>
                <th>סוג</th>
                <th>קטגוריה</th>
                <th>אחראי</th>
                <th className="baseline-col" title="טור Planned יתמלא כשעמודת Baseline תיווצר במאנדיי">Planned <span className="placeholder-tag">placeholder</span></th>
                <th>בפועל</th>
                <th>סטטוס</th>
                <th>בריאות</th>
                <th>תיאור</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr><td colSpan={9}><EmptyState title="אין פרויקטים בקטגוריה הזו." /></td></tr>
              )}
              {sorted.slice(0, 60).map((p, i) => {
                const variance = (p.plannedEnd && p.actualEnd) ? Math.round((p.actualEnd - p.plannedEnd) / DAY) : null;
                return (
                  <tr key={i}>
                    <td className="dtw-name">{stripEmoji(p.name) || p.name}</td>
                    <td className="muted">{TYPE_LABELS[p.type] || p.type}</td>
                    <td><span className="cat-pill">{p.productSubType}</span></td>
                    <td className="muted">{p.owner}</td>
                    <td className="baseline-col">
                      <div className="planned-cell">
                        <span className="ltr-inline mono">{fmtDateYr(p.plannedStart)} → {fmtDateYr(p.plannedEnd)}</span>
                      </div>
                    </td>
                    <td>
                      <div className="actual-cell">
                        <span className="ltr-inline mono">{fmtDateYr(p.actualStart)} → {fmtDateYr(p.actualEnd)}</span>
                        {variance !== null && variance !== 0 && (
                          <span className={"variance " + (variance > 0 ? "variance-neg" : "variance-pos")}>
                            {variance > 0 ? "+" : ""}{variance}י׳
                          </span>
                        )}
                      </div>
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

function BaselineNotice() {
  return (
    <div className="baseline-notice">
      <div className="baseline-notice-icon">{ICONS.alertCircle}</div>
      <div>
        <div className="baseline-notice-title">טור Planned (Baseline) — placeholder</div>
        <div className="baseline-notice-body">
          ברגע שתוסיפו עמודות <strong>Planned Start</strong> ו־<strong>Planned End</strong> במאנדיי, הן יוצגו כאן ויתחשבו בחישוב הסטיות (variance) מול הביצוע בפועל. כרגע הערכים מועתקים מ־Start ו־Deadline הקיימים — לא ה־baseline האמיתי.
        </div>
      </div>
    </div>
  );
}

function NextLaunches({ items }) {
  if (!items.length) return <EmptyState title="אין השקות בחודש הקרוב." />;
  return (
    <div className="nl-grid">
      {items.map((p, i) => {
        const daysLeft = Math.round((p.deadline - NOW) / DAY);
        const urgent = daysLeft <= 7;
        return (
          <div key={i} className={"nl-card " + (urgent ? "nl-card-urgent" : "")}>
            <div className="nl-head">
              <span className="cat-pill">{p.productSubType}</span>
              <HealthPill health={p.health} size="sm" />
            </div>
            <div className="nl-name">{stripEmoji(p.name) || p.name}</div>
            <div className="nl-meta">{p.owner} · {p.team}</div>
            <div className="nl-foot">
              <div className="nl-countdown">
                <div className="nl-days"><span className="ltr-inline">{daysLeft}</span></div>
                <div className="nl-days-label">ימים</div>
              </div>
              <div className="nl-date">
                <span className="ltr-inline mono">{fmtDateYr(p.deadline)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

window.WorldProduct = WorldProduct;
