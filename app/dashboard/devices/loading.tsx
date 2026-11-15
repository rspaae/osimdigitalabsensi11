export default function DevicesLoading() {
  return (
    <main className="settings-page ui-skeleton-page" aria-busy="true" aria-label="Memuat perangkat IoT">
      <header className="settings-page-header">
        <div className="ui-skeleton ui-skeleton-text is-short" style={{ width: "130px" }} />
        <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "12px 0 8px" }}>
          <div className="ui-skeleton ui-skeleton-title" style={{ width: "200px", height: "32px", marginBottom: 0 }} />
          <div className="ui-skeleton ui-skeleton-pill" style={{ width: "110px" }} />
        </div>
        <div className="ui-skeleton ui-skeleton-text" style={{ width: "70%" }} />
      </header>

      <div className="settings-page-body">
        {/* Metric Cards Skeleton */}
        <div className="ui-stats-grid" style={{ marginBottom: "24px" }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="ui-skeleton-card" style={{ height: "105px" }}>
              <div className="ui-skeleton ui-skeleton-text is-short" style={{ width: "90px" }} />
              <div className="ui-skeleton" style={{ height: "32px", width: "40px", margin: "10px 0 6px" }} />
              <div className="ui-skeleton ui-skeleton-text is-short" style={{ width: "110px", marginBottom: 0 }} />
            </div>
          ))}
        </div>

        {/* Device Registration Form Skeleton */}
        <div className="member-form-card" style={{ height: "180px", marginBottom: "20px" }}>
          <div className="ui-skeleton ui-skeleton-title" style={{ width: "180px", height: "22px" }} />
          <div className="ui-skeleton ui-skeleton-text" style={{ width: "50%", marginBottom: "20px" }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }}>
            <div className="ui-skeleton" style={{ height: "42px", borderRadius: "8px" }} />
            <div className="ui-skeleton" style={{ height: "42px", borderRadius: "8px" }} />
            <div className="ui-skeleton" style={{ height: "42px", borderRadius: "8px" }} />
          </div>
        </div>

        {/* Device Monitor Skeleton */}
        <div className="member-list-card" style={{ padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <div className="ui-skeleton ui-skeleton-title" style={{ width: "160px", height: "20px" }} />
              <div className="ui-skeleton ui-skeleton-text is-short" style={{ width: "240px", marginBottom: 0 }} />
            </div>
            <div className="ui-skeleton ui-skeleton-pill" style={{ width: "100px" }} />
          </div>
          <div style={{ display: "grid", gap: "10px" }}>
            {[1, 2].map((i) => (
              <div key={i} className="ui-skeleton-table-row">
                <div className="ui-skeleton ui-skeleton-circle" style={{ width: "32px", height: "32px" }} />
                <div style={{ flex: 2 }}>
                  <div className="ui-skeleton ui-skeleton-text" style={{ width: "50%" }} />
                  <div className="ui-skeleton ui-skeleton-text is-short" style={{ width: "30%", marginBottom: 0 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="ui-skeleton ui-skeleton-pill" style={{ width: "90px" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
