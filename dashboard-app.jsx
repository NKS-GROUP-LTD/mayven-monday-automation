// Main dashboard App — routes between worlds, manages global filters.

function DashboardApp() {
  const [active, setActive] = React.useState("overview");
  const [filters, setFilters] = React.useState({ team: "all", type: "all" });

  const onFilterChange = (patch) => setFilters(f => ({ ...f, ...patch }));

  // Apply global filters to enriched dataset
  const filteredProjects = React.useMemo(() => {
    return ENRICHED.filter(p => {
      if (filters.team !== "all" && p.team !== filters.team) return false;
      if (filters.type !== "all" && p.type !== filters.type) return false;
      return true;
    });
  }, [filters.team, filters.type]);

  // Per-world counts (excluding done & cancelled — what's actually pending attention)
  const projectCounts = React.useMemo(() => {
    const counts = {};
    WORLDS.forEach(w => counts[w.key] = 0);
    ENRICHED.forEach(p => {
      if (p.status === "הסתיימה" || p.status === "מבוטלת") return;
      counts[p.world] = (counts[p.world] || 0) + 1;
    });
    counts.overview = ENRICHED.filter(p => p.status !== "הסתיימה" && p.status !== "מבוטלת").length;
    counts.roadmap = null;  // Roadmap is a view, not a category — no badge
    return counts;
  }, []);

  // Types available in filter (only those with active projects)
  const allTypes = React.useMemo(() => {
    return [...new Set(ENRICHED.map(p => p.type))].sort();
  }, []);

  const worldDef = WORLDS.find(w => w.key === active) || WORLDS[0];

  // Render active world
  let WorldComp;
  if (active === "overview")    WorldComp = window.WorldOverview;
  else if (active === "roadmap")WorldComp = window.WorldRoadmap;
  else if (active === "tech")   WorldComp = window.WorldTech;
  else if (active === "product")WorldComp = window.WorldProduct;
  else if (active === "campaigns") WorldComp = window.WorldCampaigns;
  else if (active === "launches")  WorldComp = window.WorldLaunches;
  else if (active === "departments") WorldComp = window.WorldDepartments;

  return (
    <div className="ms-frame">
      <Sidebar active={active} onNav={setActive} projectCounts={projectCounts} />
      <div className="ms-main">
        <TopBar
          worldHe={worldDef.he}
          worldEn={worldDef.en}
          filters={filters}
          onFilterChange={onFilterChange}
          allTeams={ALL_TEAMS}
          allTypes={allTypes}
        />
        <div className="ms-content">
          {WorldComp ? <WorldComp projects={filteredProjects} filters={filters} /> : <div>—</div>}
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<DashboardApp />);
