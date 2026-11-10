import { prisma } from "@/lib/db/prisma";
import { Prisma, MemberStatus } from "@prisma/client";
import {
  CreateMemberInput,
  UpdateMemberInput,
  MemberQueryInput,
} from "@/lib/validators/member.schema";
import {
  NotFoundError,
  ConflictError,
} from "./errors";
import { normalizeRfidUid } from "@/lib/utils/rfid";

export async function getMembers(query: MemberQueryInput) {
  const {
    page = 1,
    limit = 10,
    search,
    class_grade,
    organization_type,
    status,
    sort_by = "created_at",
    sort_order = "desc",
  } = query;

  const skip = (page - 1) * limit;

  // Build where filter
  const where: Prisma.MemberWhereInput = {};

  if (status) {
    where.status = status;
  }

  if (organization_type) {
    where.organization_type = organization_type;
  }

  if (class_grade) {
    where.class_grade = {
      contains: class_grade,
      mode: "insensitive",
    };
  }

  if (search && search.trim() !== "") {
    const term = search.trim();
    where.OR = [
      { nis: { contains: term, mode: "insensitive" } },
      { nisn: { contains: term, mode: "insensitive" } },
      { full_name: { contains: term, mode: "insensitive" } },
    ];
  }

  // Count total & fetch items
  const [total, members] = await Promise.all([
    prisma.member.count({ where }),
    prisma.member.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sort_by]: sort_order },
      include: {
        positions: {
          where: { is_active: true },
          include: {
            position: { select: { id: true, name: true, level: true } },
            sekbid: { select: { id: true, number: true, name: true } },
            commission: { select: { id: true, code: true, name: true } },
          },
        },
        _count: {
          select: {
            attendances: true,
            violations: true,
          },
        },
      },
    }),
  ]);

  const total_pages = Math.ceil(total / limit);

  return {
    members,
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

export async function getMemberById(id: string) {
  const member = await prisma.member.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          admin_scope: true,
          is_active: true,
        },
      },
      positions: {
        orderBy: [{ is_active: "desc" }, { created_at: "desc" }],
        include: {
          position: true,
          sekbid: true,
          commission: true,
        },
      },
      attendances: {
        take: 10,
        orderBy: { scan_time: "desc" },
        include: {
          schedule: {
            select: {
              id: true,
              date: true,
              activity: { select: { id: true, name: true, code: true } },
            },
          },
        },
      },
      violations: {
        take: 10,
        orderBy: { date: "desc" },
      },
      _count: {
        select: {
          attendances: true,
          violations: true,
          positions: true,
        },
      },
    },
  });

  if (!member) {
    throw new NotFoundError(`Anggota dengan ID '${id}' tidak ditemukan.`);
  }

  return member;
}

export async function createMember(input: CreateMemberInput) {
  // 1. Cek duplikasi NIS
  if (input.nis) {
    const existingNis = await prisma.member.findUnique({
      where: { nis: input.nis },
    });
    if (existingNis) {
      throw new ConflictError(`NIS '${input.nis}' sudah terdaftar pada anggota lain.`);
    }
  }

  // 2. Cek duplikasi RFID UID jika diberikan
  const normalizedRfid = input.rfid_uid ? normalizeRfidUid(input.rfid_uid) : null;
  if (normalizedRfid) {
    const existingRfid = await prisma.member.findUnique({
      where: { rfid_uid: normalizedRfid },
    });
    if (existingRfid) {
      throw new ConflictError(
        `RFID UID '${normalizedRfid}' sudah digunakan oleh anggota lain (${existingRfid.full_name}).`
      );
    }
  }

  return prisma.member.create({
    data: {
      nis: input.nis ?? null,
      nisn: input.nisn,
      full_name: input.full_name,
      class_grade: input.class_grade ?? null,
      organization_type: input.organization_type,
      rfid_uid: normalizedRfid,
      photo_url: input.photo_url,
      status: input.status,
    },
  });
}

export async function updateMember(id: string, input: UpdateMemberInput) {
  const existing = await prisma.member.findUnique({
    where: { id },
  });
  if (!existing) {
    throw new NotFoundError(`Anggota dengan ID '${id}' tidak ditemukan.`);
  }

  // Cek keunikan NIS jika diubah
  if (input.nis && input.nis !== existing.nis) {
    const duplicateNis = await prisma.member.findUnique({
      where: { nis: input.nis },
    });
    if (duplicateNis) {
      throw new ConflictError(`NIS '${input.nis}' sudah terdaftar pada anggota lain.`);
    }
  }

  // Cek keunikan RFID UID jika diubah
  const normalizedRfid = input.rfid_uid ? normalizeRfidUid(input.rfid_uid) : input.rfid_uid;
  if (normalizedRfid && normalizedRfid !== existing.rfid_uid) {
    const duplicateRfid = await prisma.member.findUnique({
      where: { rfid_uid: normalizedRfid },
    });
    if (duplicateRfid) {
      throw new ConflictError(
        `RFID UID '${normalizedRfid}' sudah digunakan oleh anggota lain (${duplicateRfid.full_name}).`
      );
    }
  }

  return prisma.member.update({
    where: { id },
    data: {
      ...input,
      ...(input.rfid_uid !== undefined && { rfid_uid: normalizedRfid }),
    },
  });
}

export async function deleteMember(id: string) {
  const existing = await prisma.member.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          attendances: true,
          violations: true,
          positions: true,
        },
      },
    },
  });

  if (!existing) {
    throw new NotFoundError(`Anggota dengan ID '${id}' tidak ditemukan.`);
  }

  // Aturan bisnis: Jangan pernah menghapus anggota yang memiliki riwayat absensi atau pelanggaran.
  // Lakukan soft-deactivation (status = INACTIVE).
  if (existing._count.attendances > 0 || existing._count.violations > 0) {
    const updated = await prisma.$transaction(async (tx) => {
      // Nonaktifkan seluruh posisi aktif
      await tx.memberPosition.updateMany({
        where: { member_id: id, is_active: true },
        data: { is_active: false },
      });

      return tx.member.update({
        where: { id },
        data: { status: MemberStatus.INACTIVE },
      });
    });

    return {
      deleted: false,
      softDeactivated: true,
      message:
        "Anggota memiliki riwayat absensi atau pelanggaran. Anggota dinonaktifkan (status INACTIVE) untuk menjaga integritas data riwayat historis.",
      member: updated,
    };
  }

  // Jika anggota belum memiliki riwayat absensi dan pelanggaran sama sekali, boleh dihapus secara permanen
  await prisma.$transaction(async (tx) => {
    await tx.memberPosition.deleteMany({
      where: { member_id: id },
    });
    await tx.member.delete({
      where: { id },
    });
  });

  return {
    deleted: true,
    softDeactivated: false,
    message: "Data anggota dan penugasan berhasil dihapus secara permanen.",
  };
}
