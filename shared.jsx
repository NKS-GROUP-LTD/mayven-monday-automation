// Shared helpers, status/type configs, sketchy UI primitives
// Exposes everything onto window so other Babel scripts can access.

const STATUS_CONFIG = {
  "הסתיימה":      { label: "הסתיימה",      key: "done"    },
  "בעבודה":       { label: "בעבודה",       key: "active"  },
  "בנק משימות":   { label: "בנק משימות",   key: "backlog" },
  "מאושר לביצוע": { label: "מאושר לביצוע", key: "approved"},
  "מבוטלת":       { label: "מבוטלת",       key: "cancel"  },
};

// Order used by funnel / pipeline (right-to-left flow for RTL):
// backlog → approved → active → done, with cancelled separate
const PIPELINE_ORDER = ["בנק משימות","מאושר לביצוע","בעבודה","הסתיימה","מבוטלת"];

// Project type → short Hebrew label (used when emoji turned off)
const TYPE_LABELS = {
  "📦 New Product": "מוצר חדש",
  "📦 New Product- Gummies": "גאמיז",
  "👩‍💻 Website Dev": "פיתוח אתר",
  "🎀 Wellness Club👑": "Wellness Club",
  "📊A/B Tests": "A/B Tests",
  "🌀Changing Projects🔄": "פרויקטי שינוי",
  "🚀Product Launch": "השקות",
  "✨ Department": "מחלקות",
  "🧬 Subscription": "מנויים",
  "⚡ Promotion 15%": "מבצעי 15%",
  "🎁 PR Box": "PR Box",
  "🛍️ Accessories": "אקססוריז",
  "": "ללא קטגוריה"
};

function stripEmoji(s) {
  if (!s) return s;
  // Match most emoji ranges + ZWJ + variation selectors
  return s
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F1FF}\u{1F200}-\u{1F2FF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}]/gu, "")
    .replace(/[\u200D\uFE0F]/g, "")
    .trim();
}

function fmtDate(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("he-IL", { day:"2-digit", month:"2-digit" });
}
function fmtDateYr(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("he-IL", { day:"2-digit", month:"2-digit", year:"2-digit" });
}

function durationDays(start, end) {
  if (!start || !end) return null;
  return Math.round(Math.abs(end - start) / 86400000);
}

function isOnTime(p) {
  if (!p.deadline || !p.end) return null;
  return p.end <= p.deadline;
}

const NOW = new Date("2026-05-14T11:00:00Z").getTime();
const WEEK = 7 * 86400000;
const DAY = 86400000;

// Aggregate raw rows → unique projects (by name+type)
function aggregateProjects(rows) {
  const map = {};
  rows.forEach(r => {
    const key = r.name + "|" + r.type;
    if (!map[key]) map[key] = { ...r, totalItems: 0 };
    map[key].totalItems += r.items || 1;
    if (r.start && (!map[key].start || r.start < map[key].start)) map[key].start = r.start;
    if (r.end && (!map[key].end || r.end > map[key].end)) map[key].end = r.end;
    if (!map[key].deadline && r.deadline) map[key].deadline = r.deadline;
  });
  return Object.values(map);
}

const PROJECTS = aggregateProjects(window.RAW_DATA);

// ─── Sketchy UI primitives ───────────────────────────────────────

// Hand-drawn looking rectangle border via SVG. Sits absolutely behind children.
function SketchBox({ children, style, rotate = 0, accent = "currentColor", strokeWidth = 1.6, dashed = false, fill = "transparent", className = "", as = "div", ...rest }) {
  const Tag = as;
  return (
    <Tag className={"sk-box " + className} style={{ position: "relative", display: "block", ...style }} {...rest}>
      <svg className="sk-box-svg" preserveAspectRatio="none" viewBox="0 0 100 100" style={{
        position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none",
        transform: `rotate(${rotate}deg)`,
      }}>
        <path
          d={sketchyRectPath(100, 100, 2)}
          fill={fill}
          stroke={accent}
          strokeWidth={strokeWidth * 0.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={dashed ? "1.5 1.5" : undefined}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div style={{ position: "relative" }}>{children}</div>
    </Tag>
  );
}

// Build a slightly imperfect rounded-rect path
function sketchyRectPath(w, h, jitter = 1) {
  const j = () => (Math.random() - 0.5) * jitter;
  // We seed-randomise once per call so re-renders aren't too jumpy — use a stable seed by hashing input
  // Simpler: produce two passes with slight offset
  const p1 = `M ${1+j()} ${4+j()} Q ${1+j()} ${1+j()} ${4+j()} ${1+j()} L ${w-4+j()} ${1+j()} Q ${w-1+j()} ${1+j()} ${w-1+j()} ${4+j()} L ${w-1+j()} ${h-4+j()} Q ${w-1+j()} ${h-1+j()} ${w-4+j()} ${h-1+j()} L ${4+j()} ${h-1+j()} Q ${1+j()} ${h-1+j()} ${1+j()} ${h-4+j()} Z`;
  return p1;
}

// Stable seeded sketchy rect (uses name for seed so re-renders are stable)
function seededRand(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  return () => {
    h = (h * 1664525 + 1013904223) | 0;
    return ((h >>> 0) / 4294967296);
  };
}

function SketchTag({ children, color = "var(--ink)", bg, dashed = false, style, ...rest }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px",
      border: `1.4px ${dashed ? "dashed" : "solid"} ${color}`,
      borderRadius: 999,
      background: bg || "transparent",
      color,
      fontFamily: "var(--font-hand)",
      fontSize: 12,
      fontWeight: 500,
      lineHeight: 1.2,
      whiteSpace: "nowrap",
      ...style,
    }} {...rest}>
      {children}
    </span>
  );
}

// Highlighter-style background behind text
function Highlight({ children, color = "var(--accent-soft)", style }) {
  return (
    <span style={{
      background: `linear-gradient(180deg, transparent 55%, ${color} 55%, ${color} 92%, transparent 92%)`,
      padding: "0 2px",
      ...style,
    }}>{children}</span>
  );
}

// Stat tile with a sketchy frame
function StatTile({ label, value, sub, accent, big = false, dashed = false }) {
  return (
    <div className="sk-stat" style={{
      border: `1.5px ${dashed ? "dashed" : "solid"} var(--ink)`,
      borderRadius: 6,
      padding: big ? "18px 18px 14px" : "12px 14px 10px",
      background: "var(--paper)",
      boxShadow: "2px 3px 0 var(--ink)",
      position: "relative",
    }}>
      <div style={{ fontFamily: "var(--font-hand)", fontSize: 12, opacity: 0.7, marginBottom: 4 }}>{label}</div>
      <div style={{
        fontFamily: "var(--font-display)",
        fontSize: big ? 56 : 32,
        lineHeight: 1,
        fontWeight: 700,
        color: accent || "var(--ink)",
        fontVariantNumeric: "tabular-nums",
      }}>{value}</div>
      {sub && <div style={{ fontFamily: "var(--font-hand)", fontSize: 11, opacity: 0.65, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

// Hand-drawn arrow (for funnel separators, callouts)
function SketchArrow({ direction = "left", size = 32, color = "var(--ink)" }) {
  // RTL flow → "left" means RTL forward (toward right side of screen in RTL? actually pointing leftward visually)
  const rotate = direction === "left" ? 0 : direction === "right" ? 180 : direction === "down" ? -90 : 90;
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 50 30" style={{ transform: `rotate(${rotate}deg)`, overflow: "visible" }}>
      <path d="M 48 15 Q 30 13, 4 15" stroke={color} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path d="M 12 8 Q 5 14, 4 15 Q 5 16, 12 22" stroke={color} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Hand-drawn underline for headings
function HandUnderline({ color = "var(--accent)", width = "100%", style }) {
  return (
    <svg style={{ display: "block", width, height: 6, marginTop: -2, ...style }} viewBox="0 0 200 6" preserveAspectRatio="none">
      <path d="M 2 4 Q 50 1, 100 3 T 198 3" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// Status → sketchy color tag
function StatusTag({ status, dashed }) {
  const colorMap = {
    "done":     "var(--ink)",
    "active":   "var(--accent)",
    "backlog":  "var(--ink)",
    "approved": "var(--accent2)",
    "cancel":   "var(--ink)",
  };
  const key = STATUS_CONFIG[status]?.key || "done";
  const isMuted = key === "done" || key === "cancel" || key === "backlog";
  return (
    <SketchTag
      color={colorMap[key]}
      dashed={key === "cancel" || dashed}
      style={isMuted ? { opacity: 0.7 } : {}}
    >
      {key === "cancel" && <span style={{ textDecoration: "line-through", opacity: 0.8 }}>{status}</span>}
      {key !== "cancel" && status}
    </SketchTag>
  );
}

// — micro chart: sketchy horizontal bar chart
function SketchBar({ value, max, color = "var(--accent)", height = 10, label }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div style={{ position: "relative", height, background: "transparent", border: "1.2px solid var(--ink)", borderRadius: 3 }}>
      <div style={{
        position: "absolute", top: 0, bottom: 0, right: 0, // RTL: fill from right
        width: pct + "%",
        background: color,
        borderRadius: 2,
      }} />
    </div>
  );
}

// Expose
Object.assign(window, {
  STATUS_CONFIG, PIPELINE_ORDER, TYPE_LABELS, stripEmoji,
  fmtDate, fmtDateYr, durationDays, isOnTime, NOW, WEEK, DAY,
  PROJECTS,
  SketchBox, SketchTag, Highlight, StatTile, SketchArrow, HandUnderline, StatusTag, SketchBar,
  seededRand,
});
