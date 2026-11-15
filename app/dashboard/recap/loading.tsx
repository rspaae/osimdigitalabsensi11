export default function RecapLoading() {
  return (
    <main className="settings-page ui-skeleton-page" aria-busy="true" aria-label="Memuat rekap harian">
      {/* Header Skeleton */}
      <header className="settings-page-header">
        <div className="ui-skeleton ui-skeleton-text is-short" style={{ width: "130px" }} />
        <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "12px 0 8px" }}>
          <div className="ui-skeleton ui-skeleton-title" style={{ width: "260px", height: "32px", marginBottom: 0 }} />
          <div className="ui-skeleton ui-skeleton-pill" style={{ width: "90px" }} />
        </div>
        <div className="ui-skeleton ui-skeleton-text" style={{ width: "75%" }} />
      </header>

      <div className="settings-page-body">
        {/* Metric Cards Skeleton */}
        <div className="ui-stats-grid" style={{ marginBottom: "20px" }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="ui-skeleton-card" style={{ height: "105px" }}>
              <div className="ui-skeleton ui-skeleton-text is-short" style={{ width: "80px" }} />
              <div className="ui-skeleton" style={{ height: "32px", width: "60px", margin: "10px 0 6px" }} />
              <div className="ui-skeleton ui-skeleton-text is-short" style={{ width: "120px", marginBottom: 0 }} />
            </div>
          ))}
        </div>

        {/* Date Filter Card Skeleton */}
        <div className="member-list-card" style={{ padding: "18px 20px", marginBottom: "20px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
            <div className="ui-skeleton" style={{ height: "38px", width: "160px", borderRadius: "8px" }} />
            <div className="ui-skeleton" style={{ height: "38px", width: "160px", borderRadius: "8px" }} />
            <div className="ui-skeleton ui-skeleton-pill" style={{ width: "90px", height: "38px" }} />
          </div>
        </div>

        {/* Recap Accordions Skeleton */}
        <div style={{ display: "grid", gap: "14px" }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="member-list-card" style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div className="ui-skeleton ui-skeleton-title" style={{ width: "160px", height: "20px", marginBottom: 0 }} />
                  <div className="ui-skeleton ui-skeleton-pill" style={{ width: "75px" }} />
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <div className="ui-skeleton ui-skeleton-pill" style={{ width: "60px" }} />
                  <div className="ui-skeleton ui-skeleton-pill" style={{ width: "60px" }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
