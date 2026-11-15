"use client";

/**
 * Tombol cetak laporan. Memakai dialog cetak browser sehingga pengguna bisa
 * langsung memilih printer A4 atau "Save as PDF".
 */
export default function PrintButton() {
  return (
    <button type="button" className="report-btn" onClick={() => window.print()} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
      <span aria-hidden="true">🖨️</span>
      <span>Cetak / Simpan PDF</span>
    </button>
  );
}
