// App shell — tab control over four wireframe directions + Tweaks panel.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "direction": "A",
  "density": "comfy",
  "showEmoji": true,
  "hideCancelled": false,
  "groupBy": "type",
  "palette": "warm",
  "dark": false
}/*EDITMODE-END*/;

const PALETTES = {
  warm:   { paper: "#f8f5ee", ink: "#1a1d23", inkSoft: "rgba(26,29,35,0.18)", accent: "#D05A72", accent2: "#2D9E74", accentSoft: "#F4D8E1", accent2Soft: "#CDEEDF" },
  blue:   { paper: "#f5f7fb", ink: "#1a2030", inkSoft: "rgba(26,32,48,0.18)", accent: "#E25B5B", accent2: "#4872B8", accentSoft: "#FBD7D7", accent2Soft: "#D2DFF1" },
  forest: { paper: "#f6f3e9", ink: "#22281f", inkSoft: "rgba(34,40,31,0.18)", accent: "#C26B3C", accent2: "#3A7A4E", accentSoft: "#F4DCC8", accent2Soft: "#CFE3D6" },
  mono:   { paper: "#ffffff", ink: "#111111", inkSoft: "rgba(0,0,0,0.18)", accent: "#444444", accent2: "#888888", accentSoft: "rgba(0,0,0,0.10)", accent2Soft: "rgba(0,0,0,0.06)" },
};
const PALETTE_SWATCHES = {
  warm:   ["#f8f5ee","#1a1d23","#D05A72","#2D9E74"],
  blue:   ["#f5f7fb","#1a2030","#E25B5B","#4872B8"],
  forest: ["#f6f3e9","#22281f","#C26B3C","#3A7A4E"],
  mono:   ["#ffffff","#111111","#444444","#888888"],
};
const DARK = { paper: "#1a1d23", ink: "#f0e7d3", inkSoft: "rgba(240,231,211,0.22)", accent: "#E8848F", accent2: "#7DD3A8", accentSoft: "rgba(232,132,143,0.25)", accent2Soft: "rgba(125,211,168,0.22)" };

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Apply palette as CSS vars
  React.useEffect(() => {
    const p = t.dark ? DARK : (PALETTES[t.palette] || PALETTES.warm);
    const r = document.documentElement;
    r.style.setProperty("--paper", p.paper);
    r.style.setProperty("--ink", p.ink);
    r.style.setProperty("--ink-soft", p.inkSoft);
    r.style.setProperty("--accent", p.accent);
    r.style.setProperty("--accent2", p.accent2);
    r.style.setProperty("--accent-soft", p.accentSoft);
    r.style.setProperty("--accent2-soft", p.accent2Soft);
  }, [t.palette, t.dark]);

  React.useEffect(() => {
    document.documentElement.dataset.density = t.density;
  }, [t.density]);

  // Filter cancelled per toggle (applied dataset-wide so all directions agree)
  const projects = React.useMemo(() => {
    return t.hideCancelled ? PROJECTS.filter(p => p.status !== "מבוטלת") : PROJECTS;
  }, [t.hideCancelled]);

  const opts = {
    emoji: t.showEmoji,
    hideCancelled: t.hideCancelled,
    groupBy: t.groupBy,
  };

  const directions = [
    { id: "A", he: "לוח מצב הנהלה",   en: "Executive board" },
    { id: "B", he: "מפת דרכים",        en: "Quarter roadmap" },
    { id: "C", he: "טריאז׳ סיכונים",   en: "Risk-first triage" },
    { id: "D", he: "תדרוך עיתונאי",    en: "Editorial briefing" },
  ];

  const ActiveComp = window["Direction" + t.direction] || (() => null);

  return (
    <div className="app-shell">
      {/* Tabs */}
      <nav className="tabs" aria-label="Wireframe directions">
        <div className="tabs-inner">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">
              <svg width="36" height="36" viewBox="0 0 36 36">
                <path d="M 4 8 Q 4 4, 8 4 L 28 4 Q 32 4, 32 8 L 32 28 Q 32 32, 28 32 L 8 32 Q 4 32, 4 28 Z" fill="none" stroke="var(--ink)" strokeWidth="1.5" />
                <path d="M 9 24 L 13 12 L 18 20 L 23 12 L 27 24" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <div className="brand-name">Mayven Executive · wireframes</div>
              <div className="brand-sub">4 directions · low-fi · compare side by side</div>
            </div>
          </div>
          <div className="tab-list" role="tablist">
            {directions.map(d => {
              const active = d.id === t.direction;
              return (
                <button
                  key={d.id}
                  role="tab"
                  aria-selected={active}
                  className={"tab " + (active ? "tab-active" : "")}
                  onClick={() => setTweak("direction", d.id)}
                >
                  <span className="tab-id">{d.id}</span>
                  <span className="tab-label">
                    <span className="tab-he">{d.he}</span>
                    <span className="tab-en">{d.en}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Stage */}
      <main className="stage" key={t.direction}>
        <ActiveComp projects={projects} opts={opts} />
      </main>

      {/* Tweaks panel — host-managed open state */}
      <TweaksPanel>
        <TweakSection label="Direction">
          <TweakRadio
            label="Wireframe"
            value={t.direction}
            options={["A","B","C","D"]}
            onChange={(v) => setTweak("direction", v)}
          />
        </TweakSection>
        <TweakSection label="Display">
          <TweakRadio
            label="Density"
            value={t.density}
            options={["compact","comfy"]}
            onChange={(v) => setTweak("density", v)}
          />
          <TweakToggle label="Show emoji in type labels" value={t.showEmoji} onChange={(v) => setTweak("showEmoji", v)} />
          <TweakToggle label="Hide cancelled projects"   value={t.hideCancelled} onChange={(v) => setTweak("hideCancelled", v)} />
          <TweakSelect
            label="Group by"
            value={t.groupBy}
            options={["type","status","department"]}
            onChange={(v) => setTweak("groupBy", v)}
          />
        </TweakSection>
        <TweakSection label="Palette">
          <TweakColor
            label="Paper & ink"
            value={PALETTE_SWATCHES[t.palette]}
            options={Object.values(PALETTE_SWATCHES)}
            onChange={(arr) => {
              const found = Object.entries(PALETTE_SWATCHES).find(([, v]) => v.join() === arr.join());
              if (found) setTweak("palette", found[0]);
            }}
          />
          <TweakToggle label="Dark mode" value={t.dark} onChange={(v) => setTweak("dark", v)} />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
