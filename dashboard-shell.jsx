// Shell components — Mayven-OS-inspired sidebar + topbar + frame
// Procuria style: RTL Hebrew, dusty rose accent, dark sidebar #1a1d23,
// neutral content area, 1px-border cards without shadow.

const ICONS = {
  dashboard: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" /></svg>,
  code: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>,
  box: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>,
  rocket: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" /></svg>,
  megaphone: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></svg>,
  users: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  calendar: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
  search: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>,
  filter: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>,
  check: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></svg>,
  clock: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  alertCircle: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>,
  alertTriangle: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
  xCircle: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" /></svg>,
  minus: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M8 12h8" /></svg>,
  externalLink: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>,
  fileText: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>,
  arrowDown: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></svg>,
  chevronDown: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
};

// Logo: sketchy paper square with ink-bordered M
function BrandMark({ size = 36 }) {
  return (
    <div style={{
      width: size, height: size,
      borderRadius: 6,
      background: "var(--paper)",
      border: "1.5px solid var(--ink)",
      boxShadow: "2px 2px 0 var(--ink)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "var(--accent)", fontWeight: 700,
      fontSize: size * 0.6,
      flexShrink: 0,
      fontFamily: "var(--font-display)"
    }}>M</div>);

}

function Sidebar({ active, onNav, projectCounts }) {
  return (
    <aside className="sb">
      <div className="sb-brand">
        <BrandMark size={32} />
        <div>
          <div className="sb-brand-name">Mayven</div>
          <div className="sb-brand-sub">Executive Dashboard</div>
        </div>
      </div>
      <div className="sb-divider" />
      <nav className="sb-nav">
        {WORLDS.map((w) => {
          const isActive = w.key === active;
          const count = projectCounts[w.key];
          return (
            <button
              key={w.key}
              className={"sb-item " + (isActive ? "sb-item-active" : "")}
              onClick={() => onNav(w.key)}>
              
              {isActive && <span className="sb-item-bar" />}
              <span className="sb-item-icon">{ICONS[w.icon]}</span>
              <span className="sb-item-label">{w.he}</span>
              {count != null && <span className="sb-item-badge">{count}</span>}
            </button>);

        })}
      </nav>
      <div className="sb-divider" />
      <div className="sb-footer">
        <div className="sb-avatar">מ.כ</div>
        <div>
          <div className="sb-user-name">מיכל כ.</div>
          <div className="sb-user-role">מנכ״ל</div>
        </div>
      </div>
    </aside>);

}

function TopBar({ worldHe, worldEn, filters, onFilterChange, allTeams, allTypes }) {
  return (
    <header className="tb">
      <div className="tb-title">
        <span className="tb-pre">Mayven · Executive</span>
        <span className="tb-sep">·</span>
        <span className="tb-curr">{worldHe}</span>
        <span className="tb-en">{worldEn}</span>
      </div>
      <div className="tb-actions">
        <div className="tb-search">
          {ICONS.search}
          <span className="tb-search-ph">חפש פרויקט</span>
        </div>
        <select className="tb-select" value={filters.team} onChange={(e) => onFilterChange({ team: e.target.value })}>
          <option value="all">כל הצוותים</option>
          {allTeams.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="tb-select" value={filters.type} onChange={(e) => onFilterChange({ type: e.target.value })}>
          <option value="all">כל הסוגים</option>
          {allTypes.map((t) => <option key={t} value={t}>{TYPE_LABELS[t] || t || "ללא"}</option>)}
        </select>
        <div className="tb-date">
          <span style={{ opacity: 0.6 }}>נכון ל־</span>
          <span className="ltr-inline">14/05/2026</span>
        </div>
      </div>
    </header>);

}

// Card — Mayven OS card primitive
function Card({ children, padding = "16px 20px", style, title, sub, action }) {
  return (
    <div className="ms-card" style={{ padding: title ? 0 : padding, ...style }}>
      {title &&
      <div className="ms-card-head">
          <div>
            <div className="ms-card-title">{title}</div>
            {sub && <div className="ms-card-sub">{sub}</div>}
          </div>
          {action}
        </div>
      }
      <div className={title ? "ms-card-body" : undefined} style={title ? { padding } : undefined}>
        {children}
      </div>
    </div>);

}

// Health pill — color + Lucide icon (status states rule: color + shape, never color alone)
function HealthPill({ health, size = "md" }) {
  const map = {
    green: { bg: "var(--rose-50)", fg: "var(--mint-700)", label: "ירוק", icon: ICONS.check, bgOverride: "#DCFCE7" },
    yellow: { bg: "#FEF3C7", fg: "#B45309", label: "צהוב", icon: ICONS.clock },
    red: { bg: "#FEE2E2", fg: "#B91C1C", label: "אדום", icon: ICONS.alertTriangle },
    done: { bg: "#F3F4F6", fg: "#374151", label: "הסתיים", icon: ICONS.check },
    cancel: { bg: "#F3F4F6", fg: "#9CA3AF", label: "בוטל", icon: ICONS.minus }
  };
  const c = map[health] || map.done;
  const bg = c.bgOverride || c.bg;
  return (
    <span className="health-pill" data-size={size} style={{ background: bg, color: c.fg }}>
      <span className="health-pill-icon">{c.icon}</span>
      <span className="health-pill-label">{c.label}</span>
    </span>);

}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status];
  const key = cfg?.key;
  const map = {
    done: { bg: "#DCFCE7", fg: "#15803D", icon: ICONS.check },
    active: { bg: "#DBEAFE", fg: "#1D4ED8", icon: ICONS.clock },
    backlog: { bg: "#F3F4F6", fg: "#374151", icon: ICONS.minus },
    approved: { bg: "#EDE9FE", fg: "#6D28D9", icon: ICONS.check },
    cancel: { bg: "#F3F4F6", fg: "#9CA3AF", icon: ICONS.xCircle }
  };
  const c = map[key] || map.backlog;
  return (
    <span className="status-badge" style={{ background: c.bg, color: c.fg }}>
      {c.icon}
      <span>{status}</span>
    </span>);

}

function PriorityPill({ priority }) {
  const map = {
    "High": { bg: "#FEE2E2", fg: "#B91C1C", dot: "#B91C1C" },
    "Medium": { bg: "#FEF3C7", fg: "#B45309", dot: "#B45309" },
    "Low": { bg: "#F3F4F6", fg: "#374151", dot: "#9CA3AF" }
  };
  const c = map[priority] || map.Low;
  const label = priority === "High" ? "גבוהה" : priority === "Medium" ? "בינונית" : "נמוכה";
  return (
    <span className="status-badge" style={{ background: c.bg, color: c.fg }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot }} />
      <span>{label}</span>
    </span>);

}

function MiniSparkBars({ values, max, color = "var(--rose-500)", width = 80, height = 22 }) {
  const m = max || Math.max(1, ...values);
  return (
    <svg width={width} height={height} style={{ display: "block", direction: "ltr" }}>
      {values.map((v, i) => {
        const bw = width / values.length - 2;
        const bh = v / m * (height - 2);
        return (
          <rect key={i} x={i * (bw + 2)} y={height - bh} width={bw} height={bh}
          fill={color} opacity={0.75} rx="1" />);

      })}
    </svg>);

}

function PageHeader({ title, sub, action }) {
  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        {sub && <div className="page-sub">{sub}</div>}
      </div>
      <div>{action}</div>
    </div>);

}

// Task brief link — clickable external doc
function TaskBriefLink({ url, label = "תיאור" }) {
  return (
    <a className="brief-link" href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
      {ICONS.fileText}
      <span>{label}</span>
      {ICONS.externalLink}
    </a>);

}

// Empty state
function EmptyState({ title, sub }) {
  return (
    <div className="empty">
      <div className="empty-title">{title}</div>
      {sub && <div className="empty-sub">{sub}</div>}
    </div>);

}

Object.assign(window, {
  ICONS, BrandMark, Sidebar, TopBar, Card, HealthPill, StatusBadge, PriorityPill,
  MiniSparkBars, PageHeader, TaskBriefLink, EmptyState
});