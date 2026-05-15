// World: Overview — sketchy paper aesthetic
// Per spec:
//   Hero: # active projects this quarter (deadline within current quarter)
//   KPI cards: % on-time, % red, % at-risk — all out of "in work" projects
//   Pipeline: מצב הפרויקטים (status funnel)
//   דורש תשומת לב (was: red projects)
//   דד־ליינים השבוע
//   עמידה בזמנים (monthly trend)

function WorldOverview({ projects, filters }) {
  const now = NOW;

  // Current quarter
  const nowDate = new Date(now);
  const qIdx = Math.floor(nowDate.getMonth() / 3);
  const qStart = new Date(nowDate.getFullYear(), qIdx * 3, 1).getTime();
  const qEnd   = new Date(nowDate.getFullYear(), qIdx * 3 + 3, 1).getTime();

  // "In work" = status not "done" and not "cancelled"
  const inWork = projects.filter(p => p.status !== "הסתיימה" && p.status !== "מבוטלת");
  const inWorkCount = inWork.length;

  // Active in this quarter — projects whose deadline falls in current quarter, status not done
  const activeThisQuarter = projects.filter(p => {
    if (!p.deadline) return false;
    if (p.status === "מבוטלת") return false;
    return p.deadline >= qStart && p.deadline < qEnd;
  });

  // % on-time = green / inWork count
  const greenCount  = inWork.filter(p => p.health === "green").length;
  const yellowCount = inWork.filter(p => p.health === "yellow").length;
  const redCount    = inWork.filter(p => p.health === "red").length;

  const pct = (n) => inWorkCount ? Math.round(n / inWorkCount * 100) : 0;
  const onTimePct = pct(greenCount);
  const redPct    = pct(redCount);
  const yellowPct = pct(yellowCount);

  // Status pipeline (counts per status, all projects)
  const pipelineCounts = PIPELINE_ORDER.map(s => ({
    status: s,
    count: projects.filter(p => p.status === s).length,
    items: projects.filter(p => p.status === s).reduce((sum, p) => sum + (p.totalItems || 1), 0),
  }));
  const maxPipeline = Math.max(...pipelineCounts.map(p => p.count), 1);

  // Red projects = "דורש תשומת לב"
  const red = inWork.filter(p => p.health === "red").sort((a, b) => (a.deadline || 0) - (b.deadline || 0));

  // This week deadlines
  const weekEnd = now + 7 * DAY;
  const dueThisWeek = projects.filter(p => {
    if (p.status === "הסתיימה" || p.status === "מבוטלת" || !p.deadline) return false;
    return p.deadline >= now - 1 * DAY && p.deadline <= weekEnd;
  }).sort((a, b) => a.deadline - b.deadline);

  // Monthly on-time trend (last 6 months of completed projects)
  const done = projects.filter(p => p.status === "הסתיימה");
  const monthlyTrend = (() => {
    const buckets = {};
    const monthKeys = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now); d.setMonth(d.getMonth() - i); d.setDate(1);
      const key = d.getFullYear() + "-" + (d.getMonth() + 1).toString().padStart(2, "0");
      monthKeys.push({ key, label: d.toLocaleDateString("he-IL", { month: "short" }), ts: d.getTime() });
      buckets[key] = { total: 0, onTime: 0 };
    }
    done.forEach(p => {
      if (!p.end) return;
      const d = new Date(p.end);
      const key = d.getFullYear() + "-" + (d.getMonth() + 1).toString().padStart(2, "0");
      if (buckets[key]) {
        buckets[key].total++;
        if (isOnTime(p) === true) buckets[key].onTime++;
      }
    });
    return monthKeys.map(m => ({ ...m, ...buckets[m.key], pct: buckets[m.key].total ? Math.round(buckets[m.key].onTime / buckets[m.key].total * 100) : null }));
  })();

  return (
    <div className="page" data-screen-label="01 Overview">
      <PageHeader
        title="סקירה כללית"
        sub={`עדכון בוקר · יום חמישי, 14 במאי 2026 · ${projects.length} פרויקטים סה״כ`}
      />

      {/* Hero: active in current quarter */}
      <div className="hero-stat">
        <div className="hero-stat-left">
          <div className="hero-stat-value">{activeThisQuarter.length}</div>
          <div className="hero-stat-body">
            <div className="hero-stat-label">פרויקטים פעילים ברבעון הנוכחי</div>
            <div className="hero-stat-sub">Q{qIdx + 1} {nowDate.getFullYear()} · עם דד־ליין בין אפריל ליוני</div>
          </div>
        </div>
        <div className="hero-stat-right">
          ◇ נכון ל־14 במאי ◇
        </div>
      </div>

      {/* 3 KPI cards — percentages out of in-work */}
      <div className="kpi-strip kpi-strip-3">
        <KPI
          label="עומדים בזמן"
          value={onTimePct + "%"}
          sub={`${greenCount} מתוך ${inWorkCount} בעבודה`}
          accent="success"
        />
        <KPI
          label="באיחור"
          value={redPct + "%"}
          sub={`${redCount} מתוך ${inWorkCount} בעבודה`}
          accent="danger"
          icon={ICONS.alertTriangle}
          dashed
        />
        <KPI
          label="בסיכון"
          value={yellowPct + "%"}
          sub={`${yellowCount} מתוך ${inWorkCount} · פחות מ־48 ש׳ לדד־ליין`}
          accent="warning"
          icon={ICONS.clock}
        />
      </div>

      {/* Status pipeline */}
      <Card title="מצב הפרויקטים" sub="לפי שלב בתהליך · ממתין → אישור → בעבודה → סיום">
        <div className="chart-wrap">
          <StatusPipeline counts={pipelineCounts} max={maxPipeline} />
        </div>
      </Card>

      {/* Row: דורש תשומת לב + דד־ליינים השבוע */}
      <div className="row-2-1">
        <Card title="דד־ליינים השבוע" sub={`${dueThisWeek.length} פרויקטים בשבעת הימים הקרובים`}>
          <DueThisWeek items={dueThisWeek.slice(0, 10)} />
        </Card>

        <Card title="דורש תשומת לב" sub={`${red.length} פרויקטים אדומים`}
              action={<a className="card-action" href="#red">לכולם ←</a>}>
          <AttentionList items={red.slice(0, 6)} />
        </Card>
      </div>

      {/* Monthly trend */}
      <Card title="עמידה בזמנים — חצי שנה" sub="אחוז פרויקטים שעמדו בדד־ליין, לפי חודש סיום">
        <div className="chart-wrap">
          <MonthlyTrend data={monthlyTrend} />
        </div>
      </Card>
    </div>
  );
}

function KPI({ label, value, sub, accent, trend, icon, dashed }) {
  const accentMap = {
    danger:  "var(--accent)",
    warning: "var(--status-yellow-fg)",
    success: "var(--accent2)",
  };
  return (
    <div className="kpi" data-dashed={dashed ? "true" : "false"}>
      <div className="kpi-label">
        {icon && <span className="kpi-icon" style={{ color: accentMap[accent] || "rgba(26,29,35,0.6)" }}>{icon}</span>}
        <span>{label}</span>
      </div>
      <div className="kpi-value" style={{ color: accentMap[accent] || "var(--ink)" }}>{value}</div>
      <div className="kpi-row">
        {sub && <span className="kpi-sub">{sub}</span>}
        {trend && <span className="kpi-trend">{trend}</span>}
      </div>
    </div>
  );
}

function StatusPipeline({ counts, max }) {
  return (
    <div className="pipeline">
      {counts.map(p => {
        const cfg = STATUS_CONFIG[p.status];
        const isCancel = cfg?.key === "cancel";
        const isActive = cfg?.key === "active";
        const w = max > 0 ? (p.count / max) * 100 : 0;
        return (
          <div key={p.status} className="pipeline-cell"
               data-cancel={isCancel ? "true" : "false"}
               data-active={isActive ? "true" : "false"}>
            <div className="pipeline-label">{cfg?.label || p.status}</div>
            <div className="pipeline-row">
              <div className="pipeline-num">{p.count}</div>
              <div className="pipeline-items">{p.items} משימות</div>
            </div>
            <div className="pipeline-bar">
              <div className="pipeline-bar-fill" style={{ width: w + "%" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AttentionList({ items }) {
  if (!items.length) return <EmptyState title="אין פרויקטים אדומים." sub="כולם בריאים." />;
  return (
    <div className="rp-list">
      {items.map((p, i) => {
        const overdue = p.deadline ? Math.round((Math.max(p.end || NOW, NOW) - p.deadline) / DAY) : 0;
        return (
          <div key={i} className="rp-row">
            <div className="rp-main">
              <div className="rp-name">{stripEmoji(p.name) || p.name}</div>
              <div className="rp-meta">
                <span>{TYPE_LABELS[p.type] || p.type}</span>
                <span className="rp-dot">·</span>
                <span>{p.owner}</span>
              </div>
            </div>
            <div className="rp-overdue">
              <span className="ltr-inline">+{overdue}</span>
              <span className="rp-overdue-label">ימי איחור</span>
            </div>
            <TaskBriefLink url={p.taskBriefUrl} />
          </div>
        );
      })}
    </div>
  );
}

function DueThisWeek({ items }) {
  if (!items.length) return <EmptyState title="אין דד־ליינים השבוע." />;
  return (
    <div className="dtw-table-wrap">
      <table className="dtw-table">
        <thead>
          <tr>
            <th>פרויקט</th>
            <th>סוג</th>
            <th>אחראי</th>
            <th>דד־ליין</th>
            <th>סטטוס</th>
            <th>בריאות</th>
            <th>תיאור</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p, i) => {
            const daysLeft = Math.round((p.deadline - NOW) / DAY);
            return (
              <tr key={i}>
                <td className="dtw-name">{stripEmoji(p.name) || p.name}</td>
                <td className="muted">{TYPE_LABELS[p.type] || p.type}</td>
                <td className="muted">{p.owner}</td>
                <td><span className="ltr-inline mono">{fmtDateYr(p.deadline)}</span> <span className="dl-rel">{daysLeft <= 0 ? `(${Math.abs(daysLeft)} י׳ איחור)` : `(בעוד ${daysLeft})`}</span></td>
                <td><StatusBadge status={p.status} /></td>
                <td><HealthPill health={p.health} size="sm" /></td>
                <td><TaskBriefLink url={p.taskBriefUrl} label="פתח" /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MonthlyTrend({ data }) {
  const W = 700, H = 200, PAD = { top: 18, right: 22, bottom: 32, left: 40 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const xs = data.map((_, i) => PAD.left + (i / (data.length - 1)) * innerW);
  const ys = data.map(d => PAD.top + innerH * (1 - (d.pct ?? 0) / 100));
  const path = data.map((d, i) => (i === 0 ? "M" : "L") + xs[i] + " " + ys[i]).join(" ");
  const area = path + ` L ${xs[xs.length-1]} ${PAD.top + innerH} L ${xs[0]} ${PAD.top + innerH} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: 220, direction: "ltr" }}>
      {/* gridlines */}
      {[0, 25, 50, 75, 100].map(g => {
        const y = PAD.top + innerH * (1 - g / 100);
        return (
          <g key={g}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y}
                  stroke="var(--ink-soft)"
                  strokeDasharray={g === 0 || g === 100 ? "0" : "3 3"} />
            <text x={PAD.left - 8} y={y + 3} textAnchor="end" fontSize="10" fontFamily="Heebo" fill="var(--ink)" opacity="0.6">{g}</text>
          </g>
        );
      })}
      {/* area + line */}
      <path d={area} fill="var(--accent-soft)" opacity="0.55" />
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* dots + labels */}
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={xs[i]} cy={ys[i]} r="4" fill="var(--paper)" stroke="var(--accent)" strokeWidth="2.2" />
          <text x={xs[i]} y={ys[i] - 12} textAnchor="middle" fontSize="11" fontFamily="Heebo" fontWeight="700" fill="var(--ink)">{d.pct == null ? "" : d.pct + "%"}</text>
          <text x={xs[i]} y={H - PAD.bottom + 18} textAnchor="middle" fontSize="11" fontFamily="Heebo" fill="var(--ink)" opacity="0.65">{d.label}</text>
        </g>
      ))}
    </svg>
  );
}

window.WorldOverview = WorldOverview;
