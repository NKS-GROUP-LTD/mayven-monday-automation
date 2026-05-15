// Enriched data layer with mocked fields (until real Monday columns are added).
// Fields added per project:
//   owner, team, priority (tech only), techSubType (tech only),
//   requestingDept (tech only), productSubType (product only),
//   taskBriefUrl, health (computed), worldKey

// Israeli given-name + initial pool (sounds plausible to the user)
const OWNERS = [
  "שיר ל.", "אראל ג.", "מיכל כ.", "קובי ל.", "דניאל ש.",
  "נועה ב.", "יעל א.", "אורי מ.", "גלית ר.", "תמר ק.",
  "עידן ה.", "לירון פ.",
];

// Type → world mapping (which page does each project belong to?)
const TYPE_TO_WORLD = {
  "📦 New Product":           "product",
  "📦 New Product- Gummies":  "product",
  "🎁 PR Box":                "product",
  "🛍️ Accessories":           "product",
  "👩‍💻 Website Dev":          "tech",
  "📊A/B Tests":              "tech",
  "🧬 Subscription":          "tech",
  "🎀 Wellness Club👑":       "campaigns",
  "🌀Changing Projects🔄":    "campaigns",
  "⚡ Promotion 15%":         "campaigns",
  "🚀Product Launch":         "launches",
  "✨ Department":            "departments",
  "":                         "other",
};

const WORLDS = [
  { key: "overview",    he: "סקירה כללית",      en: "Overview",     icon: "dashboard" },
  { key: "roadmap",     he: "מפת דרכים",        en: "Roadmap",      icon: "calendar" },
  { key: "tech",        he: "פיתוחים טכנולוגיים", en: "Tech & dev",   icon: "code" },
  { key: "product",     he: "מוצר חדש",         en: "New product",  icon: "box" },
  { key: "launches",    he: "השקות",            en: "Launches",     icon: "rocket" },
  { key: "campaigns",   he: "קמפיינים",         en: "Campaigns",    icon: "megaphone" },
  { key: "departments", he: "מחלקות",           en: "Departments",  icon: "users" },
];

const TEAM_FOR_TYPE = {
  "👩‍💻 Website Dev":   "צוות פיתוח",
  "📊A/B Tests":      "צוות פיתוח",
  "🧬 Subscription":  "צוות פיתוח",
  "📦 New Product":   "צוות מוצר",
  "📦 New Product- Gummies": "צוות מוצר",
  "🎁 PR Box":        "צוות מוצר",
  "🛍️ Accessories":   "צוות מוצר",
  "🚀Product Launch": "צוות מוצר",
  "🎀 Wellness Club👑": "צוות שיווק",
  "🌀Changing Projects🔄": "צוות שיווק",
  "⚡ Promotion 15%": "צוות שיווק",
  "✨ Department":    "הנהלה",
  "":                 "הנהלה",
};

const TECH_SUBTYPES = [
  "Checkout & Cart",
  "PDP",
  "Account & Loyalty",
  "Subscriptions",
  "Marketing site",
  "Integrations",
  "Infrastructure",
];
const TECH_SUBTYPE_HE = {
  "Checkout & Cart":   "צ׳קאאוט וסל",
  "PDP":               "עמוד מוצר",
  "Account & Loyalty": "אזור אישי",
  "Subscriptions":     "מנויים",
  "Marketing site":    "עמודי שיווק",
  "Integrations":      "אינטגרציות",
  "Infrastructure":    "תשתית",
};

const REQUESTING_DEPTS = ["שיווק", "מוצר", "שירות לקוחות", "פיננסים", "לוגיסטיקה"];

const PRODUCT_SUBTYPES = {
  "📦 New Product- Gummies": "Gummies",
  "🎁 PR Box":               "PR Box",
  "🛍️ Accessories":          "Accessories",
};
function productSubFromName(name) {
  if (/sample/i.test(name)) return "Sample";
  if (/pr.?box/i.test(name)) return "PR Box";
  if (/edible/i.test(name)) return "Edible";
  if (/gummies/i.test(name)) return "Gummies";
  if (/accessor/i.test(name)) return "Accessories";
  return "Edible";
}

// Deterministic seeded picker
function pickFrom(arr, seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  return arr[Math.abs(h) % arr.length];
}

// Health computation
function computeHealth(p) {
  const status = STATUS_CONFIG[p.status]?.key;
  if (status === "done")    return "done";
  if (status === "cancel")  return "cancel";
  if (!p.deadline) return "green";
  const slack = (p.deadline - NOW) / DAY;     // days until deadline
  const slip  = p.end ? (p.end - p.deadline) / DAY : 0;
  if (status === "active") {
    if (slack < 0 || slip > 0) return "red";
    if (slack < 2) return "yellow";
    return "green";
  }
  // backlog / approved
  if (slack < 0) return "red";
  if (slack < 7) return "yellow";
  return "green";
}

// Domain enriched project
const ENRICHED = PROJECTS.map(p => {
  const world = TYPE_TO_WORLD[p.type] || "other";
  const team = TEAM_FOR_TYPE[p.type] || "הנהלה";
  const owner = pickFrom(OWNERS, p.name + "|owner");
  const taskBriefUrl = `https://docs.google.com/document/d/mock-${Math.abs(hash(p.name))}/edit`;
  const out = { ...p, world, team, owner, taskBriefUrl, health: computeHealth(p) };
  if (world === "tech") {
    out.priority = pickFrom(["High","Medium","Low","Medium","Medium"], p.name + "|prio");
    out.techSubType = pickFrom(TECH_SUBTYPES, p.name + "|st");
    out.requestingDept = pickFrom(REQUESTING_DEPTS, p.name + "|rd");
  }
  if (world === "product") {
    out.productSubType = PRODUCT_SUBTYPES[p.type] || productSubFromName(p.name);
    // Baseline placeholder — when real data exists, replace with planned dates
    out.plannedStart = p.start;
    out.plannedEnd   = p.deadline || p.end;
    out.actualStart  = p.start;
    out.actualEnd    = p.end;
  }
  return out;
});

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
}

// Convenience views
function byWorld(world) {
  return ENRICHED.filter(p => p.world === world);
}

// All distinct teams (from enriched data)
const ALL_TEAMS = [...new Set(ENRICHED.map(p => p.team))].sort();

Object.assign(window, {
  ENRICHED, WORLDS, byWorld, ALL_TEAMS,
  TYPE_TO_WORLD, TEAM_FOR_TYPE,
  TECH_SUBTYPES, TECH_SUBTYPE_HE, REQUESTING_DEPTS, PRODUCT_SUBTYPES,
  computeHealth, hash,
});
