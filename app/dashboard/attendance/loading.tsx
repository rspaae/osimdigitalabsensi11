export default function AttendanceLoading() {
  return (
    <main className="settings-page ui-skeleton-page" aria-busy="true" aria-label="Memuat rekap presensi">
      {/* Header Skeleton */}
      <header className="settings-page-header">
        <div className="ui-skeleton ui-skeleton-text is-short" style={{ width: "140px" }} />
        <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "12px 0 8px" }}>
          <div className="ui-skeleton ui-skeleton-title" style={{ width: "240px", height: "32px", marginBottom: 0 }} />
          <div className="ui-skeleton ui-skeleton-pill" style={{ width: "110px" }} />
        </div>
        <div className="ui-skeleton ui-skeleton-text" style={{ width: "80%" }} />
      </header>

      <div className="settings-page-body">
        {/* Metric Cards Skeleton */}
        <div className="ui-stats-grid" style={{ marginBottom: "20px" }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="ui-skeleton-card" style={{ height: "105px" }}>
              <div className="ui-skeleton ui-skeleton-text is-short" style={{ width: "80px" }} />
              <div className="ui-skeleton" style={{ height: "32px", width: "50px", margin: "10px 0 6px" }} />
              <div className="ui-skeleton ui-skeleton-text is-short" style={{ width: "110px", marginBottom: 0 }} />
            </div>
          ))}
        </div>

        {/* Filters Toolbar Skeleton */}
        <div className="member-list-card" style={{ padding: "16px 20px", marginBottom: "20px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", justifyContent: "space-between", alignItems: "center" }}>
            <div className="ui-skeleton" style={{ height: "38px", width: "280px", borderRadius: "8px" }} />
            <div style={{ display: "flex", gap: "8px" }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="ui-skeleton ui-skeleton-pill" style={{ width: "80px", height: "34px" }} />
              ))}
            </div>
          </div>
        </div>

        {/* Table Skeleton */}
        <div className="member-list-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9" }}>
            <div className="ui-skeleton ui-skeleton-title" style={{ width: "200px", height: "20px", marginBottom: 0 }} />
          </div>
          <div style={{ display: "grid" }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="ui-skeleton-table-row">
                <div className="ui-skeleton ui-skeleton-circle" style={{ width: "34px", height: "34px" }} />
                <div style={{ flex: 2 }}>
                  <div className="ui-skeleton ui-skeleton-text" style={{ width: "70%" }} />
                  <div className="ui-skeleton ui-skeleton-text is-short" style={{ width: "40%", marginBottom: 0 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="ui-skeleton ui-skeleton-pill" style={{ width: "85px" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="ui-skeleton ui-skeleton-text is-short" style={{ width: "60px", marginBottom: 0 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
