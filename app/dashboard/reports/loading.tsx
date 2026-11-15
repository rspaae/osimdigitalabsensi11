export default function ReportsLoading() {
  return (
    <main className="report-page ui-skeleton-page" aria-busy="true" aria-label="Memuat laporan">
      <header className="settings-page-header report-intro">
        <div className="ui-skeleton ui-skeleton-text is-short" style={{ width: "130px" }} />
        <div className="ui-skeleton ui-skeleton-title" style={{ width: "240px", height: "32px", margin: "12px 0 8px" }} />
        <div className="ui-skeleton ui-skeleton-text" style={{ width: "80%" }} />
      </header>

      {/* Screen Metric Cards Skeleton */}
      <div className="ui-stats-grid" style={{ marginBottom: "24px" }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="ui-skeleton-card" style={{ height: "105px" }}>
            <div className="ui-skeleton ui-skeleton-text is-short" style={{ width: "90px" }} />
            <div className="ui-skeleton" style={{ height: "32px", width: "60px", margin: "10px 0 6px" }} />
            <div className="ui-skeleton ui-skeleton-text is-short" style={{ width: "120px", marginBottom: 0 }} />
          </div>
        ))}
      </div>

      {/* Report Sheet Skeleton */}
      <section className="report-sheet" style={{ padding: "28px" }}>
        <div style={{ textAlign: "center", marginBottom: "24px", display: "grid", justifyItems: "center", gap: "8px" }}>
          <div className="ui-skeleton ui-skeleton-text is-short" style={{ width: "200px" }} />
          <div className="ui-skeleton ui-skeleton-title" style={{ width: "300px", height: "26px" }} />
          <div className="ui-skeleton ui-skeleton-text is-medium" style={{ width: "350px" }} />
        </div>
        <div style={{ display: "grid", gap: "10px" }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="ui-skeleton" style={{ height: "36px", width: "100%", borderRadius: "4px" }} />
          ))}
        </div>
      </section>
    </main>
  );
}
