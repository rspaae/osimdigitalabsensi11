import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFreshUser } from "@/lib/auth/context";
import { getMembers } from "@/lib/services/member.service";
import { memberQuerySchema } from "@/lib/validators/member.schema";
import MemberRegistrationForm from "./MemberRegistrationForm";
import MemberRfidEditor from "./MemberRfidEditor";

export const instant = false;

export const metadata: Metadata = {
  title: "Data Anggota | OSIS MPK SMKN 11 BANDUNG",
};

export default async function MembersPage() {
  const user = await getFreshUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "SUPERADMIN") {
    redirect("/dashboard");
  }

  const query = memberQuerySchema.parse({ page: 1, limit: 100, sort_by: "full_name", sort_order: "asc" });
  const result = await getMembers(query);

  const totalActive = result.members.filter((m) => m.status === "ACTIVE").length;
  const totalRfid = result.members.filter((m) => m.rfid_uid !== null).length;
  const totalOsis = result.members.filter((m) => m.organization_type === "OSIS").length;
  const totalMpk = result.members.filter((m) => m.organization_type === "MPK").length;

  return (
    <main className="settings-page">
      <header className="settings-page-header">
        <nav className="settings-breadcrumb" aria-label="Navigasi halaman">
          <Link href="/dashboard" className="breadcrumb-link">Dashboard</Link>
          <span className="breadcrumb-sep" aria-hidden="true">/</span>
          <span className="breadcrumb-current">Data Anggota</span>
        </nav>

        <div className="settings-page-title-row">
          <h1 className="settings-page-title">Data &amp; Pendaftaran Anggota</h1>
          <span className="settings-role-badge">SUPERADMIN</span>
        </div>
        <p className="settings-page-desc">
          Kelola seluruh anggota OSIS dan MPK. Tambah anggota baru, atur UID kartu RFID, dan pantau status keanggotaan secara terpusat.
        </p>
      </header>

      <div className="settings-page-body member-page-body">
        {/* Stat cards */}
        <section className="ui-stats-grid" aria-label="Statistik Keanggotaan">
          <article className="ui-stat-card accent-mint">
            <div className="ui-stat-header">
              <span className="ui-stat-label">Anggota Aktif</span>
              <span className="ui-stat-icon-wrap" aria-hidden="true">👥</span>
            </div>
            <div className="ui-stat-value">{totalActive}</div>
            <div className="ui-stat-desc">dari {result.pagination.total} total terdaftar</div>
          </article>

          <article className="ui-stat-card accent-indigo">
            <div className="ui-stat-header">
              <span className="ui-stat-label">OSIS</span>
              <span className="ui-stat-icon-wrap" aria-hidden="true">🏛️</span>
            </div>
            <div className="ui-stat-value">{totalOsis}</div>
            <div className="ui-stat-desc">anggota organisasi OSIS</div>
          </article>

          <article className="ui-stat-card accent-rose">
            <div className="ui-stat-header">
              <span className="ui-stat-label">MPK</span>
              <span className="ui-stat-icon-wrap" aria-hidden="true">⚖️</span>
            </div>
            <div className="ui-stat-value">{totalMpk}</div>
            <div className="ui-stat-desc">anggota organisasi MPK</div>
          </article>

          <article className="ui-stat-card accent-sky">
            <div className="ui-stat-header">
              <span className="ui-stat-label">Punya Kartu RFID</span>
              <span className="ui-stat-icon-wrap" aria-hidden="true">📡</span>
            </div>
            <div className="ui-stat-value">{totalRfid}</div>
            <div className="ui-stat-desc">
              <div className="ui-recap-progress-bar" style={{ width: "100%", marginTop: 4 }}>
                <div
                  className="ui-recap-progress-fill"
                  style={{
                    width: `${result.pagination.total > 0 ? Math.round((totalRfid / result.pagination.total) * 100) : 0}%`,
                    background: "#0284c7",
                  }}
                />
              </div>
            </div>
          </article>
        </section>

        <MemberRegistrationForm />

        <section className="member-list-card" aria-labelledby="member-list-title">
          <div className="member-list-heading">
            <div>
              <h2 id="member-list-title" className="cycle-section-title">Daftar Anggota Terdaftar</h2>
              <p className="cycle-form-description">
                Menampilkan {result.members.length} dari {result.pagination.total} anggota.
              </p>
            </div>
          </div>

          {result.members.length === 0 ? (
            <div className="ui-empty-card">
              <div className="ui-empty-icon" aria-hidden="true">👥</div>
              <h3 className="ui-empty-title">Belum ada anggota terdaftar</h3>
              <p className="ui-empty-desc">
                Gunakan formulir di atas untuk mendaftarkan anggota OSIS atau MPK pertama ke sistem absensi.
              </p>
            </div>
          ) : (
            <div className="member-table-wrap">
              <table className="member-table table-stack">
                <thead>
                  <tr>
                    <th scope="col">Nama Anggota</th>
                    <th scope="col">Organisasi</th>
                    <th scope="col">Kelas / NIS</th>
                    <th scope="col">Kartu RFID</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.members.map((member) => {
                    const isMpk = member.organization_type === "MPK";
                    const initial = member.full_name.charAt(0).toUpperCase();
                    return (
                      <tr key={member.id}>
                        <td data-label="Nama">
                          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                            <span className={`ui-avatar ${isMpk ? "mpk" : ""}`} aria-hidden="true">
                              {initial}
                            </span>
                            <div>
                              <strong style={{ color: "#0f172a", fontSize: 13.5 }}>
                                {member.full_name}
                              </strong>
                            </div>
                          </div>
                        </td>
                        <td data-label="Organisasi">
                          <span className={isMpk ? "badge-org-mpk" : "badge-org-osis"}>
                            {member.organization_type}
                          </span>
                        </td>
                        <td data-label="Kelas / NIS">
                          <span style={{ fontWeight: 550, color: "#334155" }}>
                            {"class_grade" in member ? (member.class_grade as string | null) ?? "—" : "—"}
                          </span>
                          {"nis" in member && (member.nis as string | null) && (
                            <small style={{ display: "block", color: "#64748b", fontSize: 11 }}>
                              NIS: {member.nis as string}
                            </small>
                          )}
                        </td>
                        <td data-label="RFID">
                          <MemberRfidEditor
                            memberId={member.id}
                            currentUid={member.rfid_uid}
                            memberName={member.full_name}
                          />
                        </td>
                        <td data-label="Status">
                          <span
                            className={`ui-status-badge ${
                              member.status === "ACTIVE"
                                ? "hadir"
                                : member.status === "ALUMNI"
                                  ? "diluarjadwal"
                                  : "belum"
                            }`}
                          >
                            <span className="ui-status-dot" aria-hidden="true" />
                            {member.status === "ACTIVE" ? "Aktif" : member.status === "ALUMNI" ? "Alumni" : "Tidak Aktif"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
