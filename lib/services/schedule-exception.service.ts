import { prisma } from "@/lib/db/prisma";
import { parseDateOnlyToUtc } from "@/lib/utils/timezone";
import { expandDateRange } from "@/lib/utils/schedule-exception";
import type { CreateScheduleExceptionInput } from "@/lib/validators/schedule-exception.schema";
import { NotFoundError, BusinessRuleError } from "./errors";

export interface ScheduleExceptionView {
  id: string;
  date: string;
  activity_id: string | null;
  activity_name: string | null;
  activity_code: string | null;
  reason: string;
  created_at: string;
}

function toView(row: {
  id: string;
  date: Date;
  activity_id: string | null;
  reason: string;
  created_at: Date;
  activity: { name: string; code: string } | null;
}): ScheduleExceptionView {
  return {
    id: row.id,
    date: row.date.toISOString().slice(0, 10),
    activity_id: row.activity_id,
    activity_name: row.activity?.name ?? null,
    activity_code: row.activity?.code ?? null,
    reason: row.reason,
    created_at: row.created_at.toISOString(),
  };
}

/** Daftar pengecualian jadwal (libur) dengan filter rentang tanggal opsional. */
export async function listScheduleExceptions(options?: {
  from?: string;
  to?: string;
}): Promise<ScheduleExceptionView[]> {
  const from = options?.from ? parseDateOnlyToUtc(options.from) : undefined;
  const to = options?.to ? parseDateOnlyToUtc(options.to) : undefined;

  const rows = await prisma.scheduleException.findMany({
    where:
      from || to
        ? {
            date: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : undefined,
    orderBy: [{ date: "asc" }, { created_at: "asc" }],
    include: { activity: { select: { name: true, code: true } } },
  });

  return rows.map(toView);
}

/**
 * Membuat pengecualian untuk satu tanggal atau rentang tanggal.
 * Idempoten: tanggal+kegiatan yang sudah ada hanya diperbarui alasannya.
 */
export async function createScheduleExceptions(
  input: CreateScheduleExceptionInput,
  actingUserId: string
): Promise<{ created: number; updated: number; items: ScheduleExceptionView[] }> {
  const dates = expandDateRange(input.date, input.end_date ?? input.date);

  if (input.activity_id) {
    const activity = await prisma.activity.findUnique({
      where: { id: input.activity_id },
      select: { id: true, name: true },
    });
    if (!activity) {
      throw new NotFoundError(`Kegiatan dengan ID '${input.activity_id}' tidak ditemukan.`);
    }
  }

  let created = 0;
  let updated = 0;
  const ids: string[] = [];

  for (const dateStr of dates) {
    const date = parseDateOnlyToUtc(dateStr);
    const activityId = input.activity_id ?? null;

    const existing = await prisma.scheduleException.findFirst({
      where: { date, activity_id: activityId },
      select: { id: true, reason: true },
    });

    if (existing) {
      await prisma.scheduleException.update({
        where: { id: existing.id },
        data: { reason: input.reason, created_by: actingUserId },
      });
      await prisma.auditLog.create({
        data: {
          user_id: actingUserId,
          action: "UPDATE",
          entity_type: "ScheduleException",
          entity_id: existing.id,
          old_values: { date: dateStr, activity_id: activityId, reason: existing.reason },
          new_values: { date: dateStr, activity_id: activityId, reason: input.reason },
          reason: `Perbarui libur jadwal: ${input.reason}`,
        },
      });
      updated += 1;
      ids.push(existing.id);
    } else {
      const row = await prisma.scheduleException.create({
        data: {
          date,
          activity_id: activityId,
          reason: input.reason,
          created_by: actingUserId,
        },
        select: { id: true },
      });
      await prisma.auditLog.create({
        data: {
          user_id: actingUserId,
          action: "CREATE",
          entity_type: "ScheduleException",
          entity_id: row.id,
          new_values: { date: dateStr, activity_id: activityId, reason: input.reason },
          reason: `Tandai libur jadwal: ${input.reason}`,
        },
      });
      created += 1;
      ids.push(row.id);
    }
  }

  const items = await prisma.scheduleException.findMany({
    where: { id: { in: ids } },
    include: { activity: { select: { name: true, code: true } } },
    orderBy: { date: "asc" },
  });

  return { created, updated, items: items.map(toView) };
}

/** Menghapus satu pengecualian (jadwal kembali normal pada tanggal tersebut). */
export async function deleteScheduleException(
  id: string,
  actingUserId: string
): Promise<void> {
  const existing = await prisma.scheduleException.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError(`Pengecualian jadwal dengan ID '${id}' tidak ditemukan.`);
  }

  await prisma.scheduleException.delete({ where: { id } });
  await prisma.auditLog.create({
    data: {
      user_id: actingUserId,
      action: "DELETE",
      entity_type: "ScheduleException",
      entity_id: id,
      old_values: {
        date: existing.date.toISOString().slice(0, 10),
        activity_id: existing.activity_id,
        reason: existing.reason,
      },
      reason: `Hapus pengecualian libur: ${existing.reason}`,
    },
  });
}

/** Pengecualian yang berlaku pada satu tanggal (dipakai scan & dashboard). */
export async function getScheduleExceptionsForDate(
  date: Date
): Promise<Array<{ activity_id: string | null; reason: string }>> {
  return prisma.scheduleException.findMany({
    where: { date },
    select: { activity_id: true, reason: true },
  });
}

/** Melempar error bila kegiatan pada tanggal tertentu sedang diliburkan. */
export async function assertScheduleNotCancelled(
  date: Date,
  activityId: string,
  activityName: string
): Promise<void> {
  const exceptions = await prisma.scheduleException.findMany({
    where: {
      date,
      OR: [{ activity_id: null }, { activity_id: activityId }],
    },
    select: { reason: true },
    take: 1,
  });

  if (exceptions.length > 0) {
    throw new BusinessRuleError(
      `Kegiatan ${activityName} diliburkan pada tanggal ini: ${exceptions[0].reason}`,
      "ACTIVITY_CANCELLED"
    );
  }
}
