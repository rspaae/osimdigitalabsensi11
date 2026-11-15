export default function DashboardLoading() {
  return (
    <main className="dh-root ui-skeleton-page" aria-busy="true" aria-label="Memuat dashboard">
      {/* Hero Skeleton */}
      <section className="dh-hero" style={{ minHeight: "180px", opacity: 0.9 }}>
        <div className="dh-hero-copy">
          <div className="ui-skeleton ui-skeleton-text is-short" style={{ height: "14px", width: "160px", background: "rgba(255,255,255,0.2)" }} />
          <div className="ui-skeleton ui-skeleton-title" style={{ height: "32px", width: "280px", background: "rgba(255,255,255,0.25)", margin: "10px 0" }} />
          <div className="ui-skeleton ui-skeleton-text" style={{ height: "16px", width: "380px", background: "rgba(255,255,255,0.2)" }} />
          <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
            <div className="ui-skeleton ui-skeleton-pill" style={{ background: "rgba(255,255,255,0.2)" }} />
            <div className="ui-skeleton ui-skeleton-pill" style={{ background: "rgba(255,255,255,0.2)" }} />
            <div className="ui-skeleton ui-skeleton-pill" style={{ background: "rgba(255,255,255,0.2)" }} />
          </div>
        </div>
      </section>

      {/* Metrics Row Skeleton */}
      <section className="dh-metrics" style={{ marginTop: "24px" }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="ui-skeleton-card" style={{ height: "120px" }}>
            <div className="ui-skeleton ui-skeleton-text is-short" style={{ width: "90px" }} />
            <div className="ui-skeleton" style={{ height: "36px", width: "70px", margin: "12px 0 8px" }} />
            <div className="ui-skeleton ui-skeleton-text" style={{ width: "130px" }} />
          </div>
        ))}
      </section>

      {/* Main Panels Skeleton */}
      <div className="dh-grid" style={{ marginTop: "24px" }}>
        <div className="dh-col">
          <section className="dh-panel" style={{ padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
              <div className="ui-skeleton ui-skeleton-title" style={{ width: "180px", height: "24px" }} />
              <div className="ui-skeleton ui-skeleton-pill" style={{ width: "100px" }} />
            </div>
            <div style={{ display: "grid", gap: "12px" }}>
              {[1, 2].map((i) => (
                <div key={i} className="ui-skeleton-card" style={{ height: "90px" }}>
                  <div className="ui-skeleton ui-skeleton-text is-medium" />
                  <div className="ui-skeleton ui-skeleton-text is-short" />
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="dh-col">
          <section className="dh-panel" style={{ padding: "20px" }}>
            <div className="ui-skeleton ui-skeleton-title" style={{ width: "160px", height: "24px", marginBottom: "16px" }} />
            <div style={{ display: "grid", gap: "10px" }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 0" }}>
                  <div className="ui-skeleton ui-skeleton-circle" style={{ width: "36px", height: "36px" }} />
                  <div style={{ flex: 1 }}>
                    <div className="ui-skeleton ui-skeleton-text" style={{ width: "60%" }} />
                    <div className="ui-skeleton ui-skeleton-text is-short" style={{ width: "40%", marginBottom: 0 }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
