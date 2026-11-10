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

  return (
    <main className="settings-page">
      <header className="settings-page-header">
        <nav className="settings-breadcrumb" aria-label="Navigasi halaman">
          <Link href="/dashboard" className="breadcrumb-link">Dashboard</Link>
          <span className="breadcrumb-sep" aria-hidden="true">/</span>
          <span className="breadcrumb-current">Data Anggota</span>
        </nav>

        <div className="settings-page-title-row">
          <h1 className="settings-page-title">Pendaftaran Anggota</h1>
          <span className="settings-role-badge">SUPERADMIN</span>
        </div>
        <p className="settings-page-desc">
          Daftarkan anggota dengan nama dan organisasi. UID RFID dapat dicatat
          sekarang atau ditambahkan setelah kartu tersedia; NIS dan kelas opsional.
        </p>
      </header>

      <div className="settings-page-body member-page-body">
        <MemberRegistrationForm />

        <section className="member-list-card" aria-labelledby="member-list-title">
          <div className="member-list-heading">
            <div>
              <h2 id="member-list-title" className="cycle-section-title">Anggota Terdaftar</h2>
              <p className="cycle-form-description">
                Menampilkan {result.members.length} dari {result.pagination.total} anggota.
              </p>
            </div>
          </div>

          {result.members.length === 0 ? (
            <p className="member-empty-state">Belum ada anggota terdaftar.</p>
          ) : (
            <div className="member-table-wrap">
              <table className="member-table">
                <thead>
                  <tr>
                    <th scope="col">Nama</th>
                    <th scope="col">Organisasi</th>
                    <th scope="col">RFID</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.members.map((member) => (
                    <tr key={member.id}>
                      <td>{member.full_name}</td>
                      <td>{member.organization_type}</td>
                      <td>
                        <MemberRfidEditor
                          memberId={member.id}
                          currentUid={member.rfid_uid}
                          memberName={member.full_name}
                        />
                      </td>
                      <td>{member.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
