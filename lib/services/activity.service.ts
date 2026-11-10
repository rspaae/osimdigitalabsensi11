import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import {
  CreateActivityInput,
  UpdateActivityInput,
  ActivityQueryInput,
} from "@/lib/validators/activity.schema";
import {
  NotFoundError,
  ConflictError,
  BusinessRuleError,
} from "./errors";

export async function getActivities(query: ActivityQueryInput) {
  const {
    page = 1,
    limit = 10,
    search,
    type,
    is_active,
    sort_by = "created_at",
    sort_order = "desc",
  } = query;

  const skip = (page - 1) * limit;
  const where: Prisma.ActivityWhereInput = {};

  if (type) {
    where.type = type;
  }

  if (is_active !== undefined) {
    where.is_active = is_active;
  }

  if (search && search.trim() !== "") {
    const term = search.trim();
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { code: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
    ];
  }

  const [total, activities] = await Promise.all([
    prisma.activity.count({ where }),
    prisma.activity.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sort_by]: sort_order },
      include: {
        _count: {
          select: { schedules: true },
        },
      },
    }),
  ]);

  const total_pages = Math.ceil(total / limit);

  return {
    activities,
    pagination: {
      page,
      limit,
      total,
      total_pages,
      has_next_page: page < total_pages,
      has_prev_page: page > 1,
    },
  };
}

export async function getActivityById(id: string) {
  const activity = await prisma.activity.findUnique({
    where: { id },
    include: {
      schedules: {
        take: 10,
        orderBy: { date: "desc" },
        include: {
          device: { select: { id: true, device_code: true, name: true } },
          _count: { select: { attendances: true } },
        },
      },
      _count: {
        select: { schedules: true },
      },
    },
  });

  if (!activity) {
    throw new NotFoundError(`Kegiatan dengan ID '${id}' tidak ditemukan.`);
  }

  return activity;
}

export async function createActivity(input: CreateActivityInput) {
  // Cek keunikan kode kegiatan
  const existingCode = await prisma.activity.findUnique({
    where: { code: input.code },
  });
  if (existingCode) {
    throw new ConflictError(`Kegiatan dengan kode '${input.code}' sudah terdaftar.`);
  }

  // Cek duplikasi nama kegiatan
  const existingName = await prisma.activity.findFirst({
    where: { name: { equals: input.name, mode: "insensitive" } },
  });
  if (existingName) {
    throw new ConflictError(`Kegiatan dengan nama '${input.name}' sudah terdaftar.`);
  }

  return prisma.activity.create({
    data: input,
  });
}

export async function updateActivity(id: string, input: UpdateActivityInput) {
  const existing = await prisma.activity.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError(`Kegiatan dengan ID '${id}' tidak ditemukan.`);
  }

  if (input.code && input.code !== existing.code) {
    const duplicateCode = await prisma.activity.findUnique({
      where: { code: input.code },
    });
    if (duplicateCode) {
      throw new ConflictError(`Kegiatan dengan kode '${input.code}' sudah terdaftar.`);
    }
  }

  if (input.name && input.name.toLowerCase() !== existing.name.toLowerCase()) {
    const duplicateName = await prisma.activity.findFirst({
      where: { name: { equals: input.name, mode: "insensitive" } },
    });
    if (duplicateName && duplicateName.id !== id) {
      throw new ConflictError(`Kegiatan dengan nama '${input.name}' sudah terdaftar.`);
    }
  }

  return prisma.activity.update({
    where: { id },
    data: input,
  });
}

export async function deleteActivity(id: string) {
  const existing = await prisma.activity.findUnique({
    where: { id },
    include: {
      _count: {
        select: { schedules: true },
      },
    },
  });

  if (!existing) {
    throw new NotFoundError(`Kegiatan dengan ID '${id}' tidak ditemukan.`);
  }

  if (existing._count.schedules > 0) {
    throw new BusinessRuleError(
      `Kegiatan '${existing.name}' tidak dapat dihapus karena memiliki ${existing._count.schedules} riwayat jadwal sesi.`
    );
  }

  await prisma.activity.delete({ where: { id } });
  return {
    success: true,
    message: `Kegiatan '${existing.name}' berhasil dihapus.`,
  };
}
