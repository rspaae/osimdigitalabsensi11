export default function SubstitutionsLoading() {
  return (
    <main className="settings-page ui-skeleton-page" aria-busy="true" aria-label="Memuat tukar piket">
      <header className="settings-page-header">
        <div className="ui-skeleton ui-skeleton-text is-short" style={{ width: "130px" }} />
        <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "12px 0 8px" }}>
          <div className="ui-skeleton ui-skeleton-title" style={{ width: "280px", height: "32px", marginBottom: 0 }} />
          <div className="ui-skeleton ui-skeleton-pill" style={{ width: "100px" }} />
        </div>
        <div className="ui-skeleton ui-skeleton-text" style={{ width: "80%" }} />
      </header>

      <div className="settings-page-body">
        {/* Banner Skeleton */}
        <div className="roster-automation-banner" style={{ minHeight: "80px", opacity: 0.85 }}>
          <div className="ui-skeleton ui-skeleton-text" style={{ width: "40%", height: "18px" }} />
          <div className="ui-skeleton ui-skeleton-text is-medium" />
        </div>

        {/* Form Skeleton */}
        <div className="member-form-card" style={{ height: "200px", marginBottom: "24px" }}>
          <div className="ui-skeleton ui-skeleton-title" style={{ width: "200px", height: "20px" }} />
          <div className="ui-skeleton ui-skeleton-text" style={{ width: "50%", marginBottom: "16px" }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div className="ui-skeleton" style={{ height: "42px", borderRadius: "8px" }} />
            <div className="ui-skeleton" style={{ height: "42px", borderRadius: "8px" }} />
          </div>
        </div>

        {/* Table Card Skeleton */}
        <div className="member-list-card" style={{ padding: "20px" }}>
          <div className="ui-stats-grid" style={{ marginBottom: "20px" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="ui-skeleton-card" style={{ height: "100px" }}>
                <div className="ui-skeleton ui-skeleton-text is-short" style={{ width: "80px" }} />
                <div className="ui-skeleton" style={{ height: "28px", width: "40px", margin: "8px 0" }} />
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gap: "10px" }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="ui-skeleton-table-row">
                <div className="ui-skeleton ui-skeleton-text is-short" style={{ width: "30px", marginBottom: 0 }} />
                <div className="ui-skeleton ui-skeleton-text" style={{ width: "120px", marginBottom: 0 }} />
                <div className="ui-skeleton ui-skeleton-text" style={{ width: "180px", marginBottom: 0 }} />
                <div className="ui-skeleton ui-skeleton-pill" style={{ width: "80px" }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
