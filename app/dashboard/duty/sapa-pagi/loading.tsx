export default function SapaPagiLoading() {
  return (
    <main className="settings-page ui-skeleton-page" aria-busy="true" aria-label="Memuat jadwal piket">
      <header className="settings-page-header">
        <div className="ui-skeleton ui-skeleton-text is-short" style={{ width: "130px" }} />
        <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "12px 0 8px" }}>
          <div className="ui-skeleton ui-skeleton-title" style={{ width: "240px", height: "32px", marginBottom: 0 }} />
          <div className="ui-skeleton ui-skeleton-pill" style={{ width: "100px" }} />
        </div>
        <div className="ui-skeleton ui-skeleton-text" style={{ width: "70%" }} />
      </header>

      <div className="settings-page-body">
        {/* Week Switcher Skeleton */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "24px" }}>
          <div className="ui-skeleton" style={{ height: "46px", width: "320px", borderRadius: "12px" }} />
        </div>

        {/* Days Roster Grid Skeleton */}
        <div style={{ display: "grid", gap: "18px" }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="ui-duty-day-card" style={{ padding: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div className="ui-skeleton ui-skeleton-title" style={{ width: "140px", height: "22px", marginBottom: 0 }} />
                <div className="ui-skeleton ui-skeleton-pill" style={{ width: "80px" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px" }}>
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", background: "#f8fafc", borderRadius: "8px" }}>
                    <div className="ui-skeleton ui-skeleton-circle" style={{ width: "28px", height: "28px" }} />
                    <div className="ui-skeleton ui-skeleton-text" style={{ width: "110px", marginBottom: 0 }} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
