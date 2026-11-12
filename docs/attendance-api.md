# Attendance API Documentation

**Milestone 12 — Attendance Management Backend**  
**Base URL:** `/api/v1`

---

## Overview

The Attendance API manages attendance records for OSIS MPK SMKN 11 Bandung. It supports:
- **RFID scan** from ESP32 IoT devices (public endpoint, device API key auth)
- **Manual attendance** creation by authorized admins
- **Attendance correction** with mandatory audit trail
- **Schedule reconciliation** to generate ALPA records for absent members

### Authentication

| Method | Applies To |
|--------|-----------|
| Session Cookie (`osis_session` JWT) | All admin/user endpoints |
| `Authorization: Bearer <device_api_key>` | `/api/v1/attendance/scan` only |

### Error Codes

| HTTP Status | Meaning |
|-------------|---------|
| `400` | Validation failed (Zod) |
| `401` | Not authenticated |
| `403` | Insufficient permissions |
| `404` | Resource not found |
| `409` | Conflict / duplicate record |
| `422` | Business rule violation |
| `500` | Internal server error |

---

## Endpoints

---

### 1. RFID Scan (PUBLIC)

**`POST /api/v1/attendance/scan`**

Records attendance from an ESP32 RFID scanner. This endpoint is **public** (bypassed by middleware) and uses device-level API key authentication.

**Authentication:** `Authorization: Bearer <device_raw_api_key>`  
**Session Required:** ❌ No

**Request Body:**
```json
{
  "device_code": "ESP32-GERBANG-01",
  "rfid_uid": "A1B2C3D4"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `device_code` | string | ✅ | Unique device identifier |
| `rfid_uid` | string | ✅ | RFID card UID |

**Success Response `200 OK`:**
```json
{
  "success": true,
  "message": "Absensi berhasil dicatat.",
  "data": {
    "attendance_id": "uuid",
    "member_name": "Budi Santoso",
    "member_id": "uuid",
    "status": "HADIR",
    "scan_time": "2026-11-08T23:30:00.000Z",
    "schedule_id": "uuid",
    "duty_schedule_id": "uuid",
    "is_substitution": false,
    "is_duplicate": false,
    "scan_count": 1,
    "upgraded": false,
    "activity_names": ["Sapa Pagi"]
  }
}
```

**Notes:**
- Waktu server (WIB) menentukan status — timestamp ESP32 **tidak pernah** dipercaya.
- Jadwal piket dipilih dari siklus 14 hari (`WEEK_1`/`WEEK_2`) + hari + jam saat ini.
- `HADIR` hanya jika anggota ada di roster/substitusi **dan** scan berada di dalam `start_time`..`cutoff_time_wib`.
- Scan di luar jendela tersebut (sebelum mulai, setelah cutoff, atau hari tanpa jadwal) **tetap dicatat** sebagai `DI_LUAR_JADWAL`. Scan tidak pernah ditolak hanya karena waktu.
- Bila hari itu tidak punya jadwal piket sama sekali, record ditempel ke kegiatan aktif pertama (`SAPA_PAGI`) dengan sesi rentang penuh hari.
- `ActivitySchedule` harian dibuat otomatis berstatus `OPEN` pada scan pertama; tutup sesi + rekonsiliasi ALPA dijalankan terpisah oleh pengurus.
- Scan berulang pada sesi yang sama **tidak** membuat record baru (`is_duplicate: true`, HTTP `200`, bukan `409`). Record yang sama diperbarui: `scan_count` bertambah dan `last_scan_at` diperbarui, sehingga tap berulang terlihat di rekap.
- Bila status masih `DI_LUAR_JADWAL` dan tap ulang terjadi **di dalam** `start_time`..`cutoff_time`, status dinaikkan otomatis menjadi `HADIR` dan `auto_upgraded_at` diisi. Status `IZIN`, `SAKIT`, `ALPA`, atau `HADIR` tidak pernah ditimpa oleh scan.
- `scan_time` selalu menyimpan waktu tap **pertama**; gunakan `last_scan_at` untuk tap terakhir.

**Error Responses:**

| Code | Condition |
|------|-----------|
| `400` | Missing/invalid `device_code` or `rfid_uid` |
| `401` | Missing `Authorization` header, or device not found / inactive / wrong API key |
| `404` | RFID UID not registered, or member is INACTIVE |
| `422` | `CYCLE_NOT_CONFIGURED`, `NO_ACTIVE_ACTIVITY`, atau `SCHEDULE_AMBIGUOUS` |

---

### 2. List Attendances

**`GET /api/v1/attendance`**

Paginated list of attendance records with optional filters.

**Authentication:** Session cookie  
**Permission Required:** `ATTENDANCE.READ`

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | `1` | Page number |
| `limit` | number | `10` | Records per page (max 100) |
| `schedule_id` | UUID | — | Filter by schedule |
| `activity_id` | UUID | — | Filter by activity |
| `member_id` | UUID | — | Filter by member |
| `status` | enum | — | `HADIR`, `TERLAMBAT`, `IZIN`, `SAKIT`, `ALPA` |
| `date` | YYYY-MM-DD | — | Filter by schedule date |
| `sort_by` | enum | `scan_time` | `scan_time`, `created_at`, `status` |
| `sort_order` | enum | `desc` | `asc`, `desc` |

**Success Response `200 OK`:**
```json
{
  "success": true,
  "attendances": [
    {
      "id": "uuid",
      "member_id": "uuid",
      "schedule_id": "uuid",
      "scan_time": "2026-11-08T23:30:00.000Z",
      "status": "HADIR",
      "method": "RFID",
      "notes": null,
      "created_at": "...",
      "updated_at": "...",
      "member": { "id": "uuid", "full_name": "Budi Santoso", "nis": "123456" },
      "schedule": {
        "id": "uuid",
        "date": "2026-11-08T00:00:00.000Z",
        "activity": { "id": "uuid", "name": "Sapa Pagi" }
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "total_pages": 5,
    "has_next_page": true,
    "has_prev_page": false
  }
}
```

---

### 3. Create Manual Attendance

**`POST /api/v1/attendance`**

Creates a manual attendance record. ALPA is **not allowed** — use reconciliation instead.

**Authentication:** Session cookie  
**Permission Required:** `ATTENDANCE.CREATE`

**Request Body:**
```json
{
  "member_id": "uuid",
  "schedule_id": "uuid",
  "status": "IZIN",
  "method": "MANUAL",
  "notes": "Izin karena sakit ringan"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `member_id` | UUID | ✅ | Member UUID |
| `schedule_id` | UUID | ✅ | Schedule session UUID |
| `status` | enum | ✅ | `HADIR`, `TERLAMBAT`, `IZIN`, `SAKIT` (not `ALPA`) |
| `method` | enum | ✅ | `RFID` or `MANUAL` |
| `notes` | string | ❌ | Optional note (max 500 chars) |

**Business Rules:**
- `HADIR` / `TERLAMBAT` → schedule must be `OPEN`
- `IZIN` / `SAKIT` → schedule must not be `DRAFT` (can be `OPEN` or `CLOSED`)
- `ALPA` → rejected; use `POST /api/v1/schedules/{id}/reconcile` instead
- Member must be active (not `INACTIVE`)

**Success Response `201 Created`:**
```json
{
  "success": true,
  "message": "Data absensi manual berhasil ditambahkan.",
  "data": { "id": "uuid", "status": "IZIN", "method": "MANUAL", ... }
}
```

**Error Responses:**

| Code | Condition |
|------|-----------|
| `400` | Validation error |
| `404` | Member or schedule not found |
| `409` | Member already has attendance for this session |
| `422` | ALPA attempted; or HADIR/TERLAMBAT on non-OPEN session; or IZIN/SAKIT on DRAFT |

---

### 4. Get Attendance Detail

**`GET /api/v1/attendance/:id`**

Returns detailed information for a single attendance record.

**Authentication:** Session cookie  
**Permission Required:** `ATTENDANCE.READ`

**Success Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "HADIR",
    "method": "RFID",
    "scan_time": "...",
    "notes": null,
    "member": { "id": "uuid", "full_name": "Budi Santoso", "nis": "123456" },
    "schedule": {
      "id": "uuid",
      "date": "...",
      "start_time": "...",
      "late_threshold": "...",
      "end_time": "...",
      "status": "CLOSED",
      "activity": { "id": "uuid", "name": "Sapa Pagi", "code": "SAPA_PAGI" }
    }
  }
}
```

**Error Responses:**

| Code | Condition |
|------|-----------|
| `404` | Attendance record not found |

---

### 5. Correct Attendance

**`PATCH /api/v1/attendance/:id`**

Corrects the status or notes of an existing attendance record. Creates an immutable AuditLog entry atomically.

> ⚠️ **No DELETE endpoint exists.** Attendance records are immutable — only corrections are allowed.

**Authentication:** Session cookie  
**Permission Required:** `HISTORY_CORRECTION.CORRECT`

**Request Body:**
```json
{
  "status": "IZIN",
  "notes": "Izin resmi dari orang tua",
  "reason": "Data sebelumnya salah diinput oleh admin piket"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | enum | ✅ | New status (`HADIR`, `TERLAMBAT`, `IZIN`, `SAKIT`, `ALPA`) |
| `notes` | string | ❌ | Updated notes (max 500 chars) |
| `reason` | string | ✅ | Correction reason (min 10 chars) |

**Success Response `200 OK`:**
```json
{
  "success": true,
  "message": "Data absensi berhasil dikoreksi.",
  "data": { "id": "uuid", "status": "IZIN", ... }
}
```

**Audit Trail:**  
Every correction creates an `AuditLog` record with:
- `action`: `CORRECT_ATTENDANCE`
- `entity_type`: `attendance`
- `old_values`: `{ status, notes }` before correction
- `new_values`: `{ status, notes }` after correction
- `reason`: provided reason text

**Error Responses:**

| Code | Condition |
|------|-----------|
| `400` | `reason` missing or < 10 chars |
| `403` | User lacks `HISTORY_CORRECTION.CORRECT` permission |
| `404` | Attendance record not found |

---

### 6. Get Schedule Attendance List

**`GET /api/v1/schedules/:id/attendance`**

Returns all attendance records for a specific schedule session, sorted by member name.

**Authentication:** Session cookie  
**Permission Required:** `SCHEDULES.READ`

**Success Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "schedule": {
      "id": "uuid",
      "date": "...",
      "status": "CLOSED",
      "activity": { "id": "uuid", "name": "Sapa Pagi" },
      "_count": { "attendances": 42 }
    },
    "attendances": [
      {
        "id": "uuid",
        "status": "HADIR",
        "method": "RFID",
        "scan_time": "...",
        "member": {
          "id": "uuid",
          "full_name": "Aisyah Ramadhani",
          "nis": "234567",
          "status": "ACTIVE"
        }
      }
    ]
  }
}
```

**Error Responses:**

| Code | Condition |
|------|-----------|
| `404` | Schedule not found |

---

### 7. Reconcile Schedule (Generate ALPA)

**`POST /api/v1/schedules/:id/reconcile`**

Generates `ALPA` attendance records for all active members who do not yet have an attendance record for the specified session. **Only works on `CLOSED` sessions.**

**Authentication:** Session cookie  
**Permission Required:** `SCHEDULES.MANAGE_SESSION`

**No request body required.**

**Business Rules:**
- Schedule must be `CLOSED` — `OPEN` and `DRAFT` sessions are rejected.
- Idempotent: running reconciliation twice creates 0 new records on the second run.
- Only members with `status !== INACTIVE` are considered.
- Members who already have any attendance record (HADIR, TERLAMBAT, IZIN, SAKIT, or even existing ALPA) are skipped.

**Success Response `200 OK`:**
```json
{
  "success": true,
  "message": "Rekonsiliasi selesai. 5 record ALPA dibuat, 37 anggota sudah memiliki data absensi.",
  "data": {
    "created": 5,
    "skipped": 37,
    "total_members": 42
  }
}
```

**Error Responses:**

| Code | Condition |
|------|-----------|
| `403` | User lacks `SCHEDULES.MANAGE_SESSION` permission |
| `404` | Schedule not found |
| `422` | Schedule is not `CLOSED` |

---

## RBAC Summary

| Role / Scope | ATTENDANCE.READ | ATTENDANCE.CREATE | HISTORY_CORRECTION.CORRECT | SCHEDULES.MANAGE_SESSION |
|---|:---:|:---:|:---:|:---:|
| SUPERADMIN | ✅ | ✅ | ✅ | ✅ |
| ADMIN GENERAL | ✅ | ✅ | ✅ | ✅ |
| ADMIN SECRETARY | ✅ | ✅ | ✅ | ✅ |
| ADMIN DISCIPLINE_4P | ✅ | ❌ | ❌ | ❌ |
| ADMIN TREASURER | ✅ | ✅ | ❌ | ✅ |
| VIEWER | ✅ | ❌ | ❌ | ❌ |

---

## AttendanceStatus Enum Values

| Value | Description |
|-------|-------------|
| `HADIR` | Present — scan at or before `late_threshold` |
| `TERLAMBAT` | Late — scan after `late_threshold` |
| `IZIN` | Excused absence with permission |
| `SAKIT` | Sick leave |
| `ALPA` | Unexcused absence — created only by reconciliation |

## AttendanceMethod Enum Values

| Value | Description |
|-------|-------------|
| `RFID` | Recorded via RFID scan from IoT device |
| `MANUAL` | Entered manually by admin |
