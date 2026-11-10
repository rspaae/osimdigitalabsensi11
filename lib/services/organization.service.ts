import { prisma } from "@/lib/db/prisma";
import { OrganizationType } from "@prisma/client";
import {
  CreatePositionInput,
  UpdatePositionInput,
  CreateSekbidInput,
  UpdateSekbidInput,
  CreateCommissionInput,
  UpdateCommissionInput,
} from "@/lib/validators/organization.schema";
import {
  NotFoundError,
  ConflictError,
  BusinessRuleError,
} from "./errors";

// ==========================================
// POSITION SERVICES
// ==========================================

export async function getPositions(organizationType?: OrganizationType) {
  return prisma.position.findMany({
    where: organizationType ? { organization_type: organizationType } : undefined,
    orderBy: [{ level: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: { member_positions: true },
      },
    },
  });
}

export async function getPositionById(id: string) {
  const position = await prisma.position.findUnique({
    where: { id },
    include: {
      member_positions: {
        include: {
          member: {
            select: { id: true, full_name: true, nis: true, class_grade: true },
          },
          sekbid: { select: { id: true, number: true, name: true } },
          commission: { select: { id: true, code: true, name: true } },
        },
      },
      _count: {
        select: { member_positions: true },
      },
    },
  });

  if (!position) {
    throw new NotFoundError(`Jabatan dengan ID '${id}' tidak ditemukan.`);
  }

  return position;
}

export async function createPosition(input: CreatePositionInput) {
  const existing = await prisma.position.findUnique({
    where: { name: input.name },
  });
  if (existing) {
    throw new ConflictError(`Jabatan dengan nama '${input.name}' sudah ada.`);
  }

  return prisma.position.create({
    data: input,
  });
}

export async function updatePosition(id: string, input: UpdatePositionInput) {
  const existing = await prisma.position.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError(`Jabatan dengan ID '${id}' tidak ditemukan.`);
  }

  if (input.name && input.name !== existing.name) {
    const duplicate = await prisma.position.findUnique({
      where: { name: input.name },
    });
    if (duplicate) {
      throw new ConflictError(`Jabatan dengan nama '${input.name}' sudah ada.`);
    }
  }

  return prisma.position.update({
    where: { id },
    data: input,
  });
}

export async function deletePosition(id: string) {
  const existing = await prisma.position.findUnique({
    where: { id },
    include: {
      _count: {
        select: { member_positions: true },
      },
    },
  });

  if (!existing) {
    throw new NotFoundError(`Jabatan dengan ID '${id}' tidak ditemukan.`);
  }

  if (existing._count.member_positions > 0) {
    throw new BusinessRuleError(
      `Jabatan '${existing.name}' tidak dapat dihapus karena masih direferensikan oleh ${existing._count.member_positions} penugasan anggota.`
    );
  }

  await prisma.position.delete({ where: { id } });
  return { success: true, message: `Jabatan '${existing.name}' berhasil dihapus.` };
}

// ==========================================
// SEKBID SERVICES
// ==========================================

export async function getSekbids() {
  return prisma.sekbid.findMany({
    orderBy: { number: "asc" },
    include: {
      _count: {
        select: { member_positions: true },
      },
    },
  });
}

export async function getSekbidById(id: string) {
  const sekbid = await prisma.sekbid.findUnique({
    where: { id },
    include: {
      member_positions: {
        include: {
          member: {
            select: { id: true, full_name: true, nis: true, class_grade: true },
          },
          position: {
            select: { id: true, name: true, level: true },
          },
        },
      },
      _count: {
        select: { member_positions: true },
      },
    },
  });

  if (!sekbid) {
    throw new NotFoundError(`Sekbid dengan ID '${id}' tidak ditemukan.`);
  }

  return sekbid;
}

export async function createSekbid(input: CreateSekbidInput) {
  const existing = await prisma.sekbid.findUnique({
    where: { number: input.number },
  });
  if (existing) {
    throw new ConflictError(`Sekbid dengan nomor ${input.number} sudah ada.`);
  }

  return prisma.sekbid.create({
    data: input,
  });
}

export async function updateSekbid(id: string, input: UpdateSekbidInput) {
  const existing = await prisma.sekbid.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError(`Sekbid dengan ID '${id}' tidak ditemukan.`);
  }

  if (input.number !== undefined && input.number !== existing.number) {
    const duplicate = await prisma.sekbid.findUnique({
      where: { number: input.number },
    });
    if (duplicate) {
      throw new ConflictError(`Sekbid dengan nomor ${input.number} sudah ada.`);
    }
  }

  return prisma.sekbid.update({
    where: { id },
    data: input,
  });
}

export async function deleteSekbid(id: string) {
  const existing = await prisma.sekbid.findUnique({
    where: { id },
    include: {
      _count: {
        select: { member_positions: true },
      },
    },
  });

  if (!existing) {
    throw new NotFoundError(`Sekbid dengan ID '${id}' tidak ditemukan.`);
  }

  if (existing._count.member_positions > 0) {
    throw new BusinessRuleError(
      `Sekbid ${existing.number} (${existing.name}) tidak dapat dihapus karena masih direferensikan oleh ${existing._count.member_positions} penugasan anggota.`
    );
  }

  await prisma.sekbid.delete({ where: { id } });
  return { success: true, message: `Sekbid ${existing.number} berhasil dihapus.` };
}

// ==========================================
// COMMISSION SERVICES
// ==========================================

export async function getCommissions() {
  return prisma.commission.findMany({
    orderBy: { code: "asc" },
    include: {
      _count: {
        select: { member_positions: true },
      },
    },
  });
}

export async function getCommissionById(id: string) {
  const commission = await prisma.commission.findUnique({
    where: { id },
    include: {
      member_positions: {
        include: {
          member: {
            select: { id: true, full_name: true, nis: true, class_grade: true },
          },
          position: {
            select: { id: true, name: true, level: true },
          },
        },
      },
      _count: {
        select: { member_positions: true },
      },
    },
  });

  if (!commission) {
    throw new NotFoundError(`Komisi dengan ID '${id}' tidak ditemukan.`);
  }

  return commission;
}

export async function createCommission(input: CreateCommissionInput) {
  const existing = await prisma.commission.findUnique({
    where: { code: input.code },
  });
  if (existing) {
    throw new ConflictError(`Komisi dengan kode '${input.code}' sudah ada.`);
  }

  return prisma.commission.create({
    data: input,
  });
}

export async function updateCommission(id: string, input: UpdateCommissionInput) {
  const existing = await prisma.commission.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError(`Komisi dengan ID '${id}' tidak ditemukan.`);
  }

  if (input.code && input.code !== existing.code) {
    const duplicate = await prisma.commission.findUnique({
      where: { code: input.code },
    });
    if (duplicate) {
      throw new ConflictError(`Komisi dengan kode '${input.code}' sudah ada.`);
    }
  }

  return prisma.commission.update({
    where: { id },
    data: input,
  });
}

export async function deleteCommission(id: string) {
  const existing = await prisma.commission.findUnique({
    where: { id },
    include: {
      _count: {
        select: { member_positions: true },
      },
    },
  });

  if (!existing) {
    throw new NotFoundError(`Komisi dengan ID '${id}' tidak ditemukan.`);
  }

  if (existing._count.member_positions > 0) {
    throw new BusinessRuleError(
      `Komisi '${existing.code}' (${existing.name}) tidak dapat dihapus karena masih direferensikan oleh ${existing._count.member_positions} penugasan anggota.`
    );
  }

  await prisma.commission.delete({ where: { id } });
  return { success: true, message: `Komisi '${existing.code}' berhasil dihapus.` };
}
