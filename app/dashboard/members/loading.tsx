export default function MembersLoading() {
  return (
    <main className="settings-page ui-skeleton-page" aria-busy="true" aria-label="Memuat data anggota">
      {/* Header Skeleton */}
      <header className="settings-page-header">
        <div className="ui-skeleton ui-skeleton-text is-short" style={{ width: "120px" }} />
        <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "12px 0 8px" }}>
          <div className="ui-skeleton ui-skeleton-title" style={{ width: "220px", height: "32px", marginBottom: 0 }} />
          <div className="ui-skeleton ui-skeleton-pill" style={{ width: "110px" }} />
        </div>
        <div className="ui-skeleton ui-skeleton-text" style={{ width: "70%" }} />
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

        {/* Member Table Skeleton */}
        <div className="member-list-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="ui-skeleton ui-skeleton-title" style={{ width: "180px", height: "20px", marginBottom: 0 }} />
            <div className="ui-skeleton ui-skeleton-pill" style={{ width: "120px" }} />
          </div>
          <div style={{ display: "grid" }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="ui-skeleton-table-row">
                <div className="ui-skeleton ui-skeleton-circle" style={{ width: "34px", height: "34px" }} />
                <div style={{ flex: 2 }}>
                  <div className="ui-skeleton ui-skeleton-text" style={{ width: "65%" }} />
                  <div className="ui-skeleton ui-skeleton-text is-short" style={{ width: "35%", marginBottom: 0 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="ui-skeleton ui-skeleton-pill" style={{ width: "70px" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="ui-skeleton" style={{ height: "24px", width: "100px", borderRadius: "6px" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
