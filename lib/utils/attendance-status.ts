/**
 * Label, gaya, dan urutan tampil status absensi.
 * Dipakai bersama oleh halaman ringkasan, rekap, dan koreksi agar konsisten.
 */

export const ATTENDANCE_STATUS_LABEL: Record<string, string> = {
  HADIR: "Hadir",
  TERLAMBAT: "Terlambat",
  IZIN: "Izin",
  SAKIT: "Sakit",
  ALPA: "Alpa",
  DI_LUAR_JADWAL: "Di luar jam",
};

export const ATTENDANCE_STATUS_STYLE: Record<string, string> = {
  HADIR: "hadir",
  TERLAMBAT: "terlambat",
  IZIN: "izin",
  SAKIT: "sakit",
  ALPA: "alpa",
  DI_LUAR_JADWAL: "luar",
};

/** Urutan tampil: yang sudah tercatat lebih dulu, yang belum scan di bawah. */
export const ATTENDANCE_STATUS_ORDER: Record<string, number> = {
  HADIR: 0,
  DI_LUAR_JADWAL: 1,
  IZIN: 2,
  SAKIT: 2,
  TERLAMBAT: 3,
  ALPA: 4,
};

export const ATTENDANCE_STATUS_OPTIONS = [
  { value: "HADIR", label: "Hadir" },
  { value: "TERLAMBAT", label: "Terlambat" },
  { value: "IZIN", label: "Izin" },
  { value: "SAKIT", label: "Sakit" },
  { value: "ALPA", label: "Alpa" },
  { value: "DI_LUAR_JADWAL", label: "Di luar jam" },
] as const;
