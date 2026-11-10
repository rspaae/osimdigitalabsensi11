import { prisma } from "@/lib/db/prisma";
import { OrganizationType } from "@prisma/client";
import {
  CreateMemberPositionInput,
  UpdateMemberPositionInput,
  MemberPositionQueryInput,
} from "@/lib/validators/member-position.schema";
import {
  NotFoundError,
  ConflictError,
  BusinessRuleError,
} from "./errors";

export async function getMemberPositions(query: MemberPositionQueryInput) {
  const { member_id, position_id, sekbid_id, commission_id, period_year, is_active } = query;

  return prisma.memberPosition.findMany({
    where: {
      member_id,
      position_id,
      sekbid_id,
      commission_id,
      period_year,
      is_active,
    },
    orderBy: [
      { period_year: "desc" },
      { is_active: "desc" },
      { created_at: "desc" },
    ],
    include: {
      member: {
        select: {
          id: true,
          nis: true,
          full_name: true,
          class_grade: true,
          organization_type: true,
          status: true,
        },
      },
      position: true,
      sekbid: true,
      commission: true,
    },
  });
}

export async function getMemberPositionById(id: string) {
  const assignment = await prisma.memberPosition.findUnique({
    where: { id },
    include: {
      member: true,
      position: true,
      sekbid: true,
      commission: true,
    },
  });

  if (!assignment) {
    throw new NotFoundError(`Penugasan jabatan dengan ID '${id}' tidak ditemukan.`);
  }

  return assignment;
}

/**
 * Validasi ketat aturan ruang lingkup penugasan jabatan (Scope Matrix):
 * - OSIS assignment: Sekbid scope only (commission_id must be null). Member & Position must be OSIS or GENERAL.
 * - MPK assignment: Commission scope only (sekbid_id must be null). Member & Position must be MPK or GENERAL.
 * - GENERAL/BPH assignment: both scope IDs null.
 * - Tolak seluruh kombinasi tidak valid (misal: anggota MPK di jabatan OSIS, atau jabatan BPH memiliki Sekbid/Komisi).
 */
export function validateAssignmentScope(
  memberOrgType: OrganizationType,
  positionOrgType: OrganizationType,
  sekbidId: string | null | undefined,
  commissionId: string | null | undefined
) {
  // 1. Larangan mutlak simultaneous sekbid & commission
  if (sekbidId && commissionId) {
    throw new BusinessRuleError(
      "Penugasan jabatan tidak boleh menetapkan Sekbid dan Komisi secara bersamaan."
    );
  }

  // 2. GENERAL / BPH: Ruang lingkup Sekbid dan Komisi WAJIB keduanya null
  if (positionOrgType === OrganizationType.GENERAL) {
    if (sekbidId || commissionId) {
      throw new BusinessRuleError(
        "Penugasan jabatan GENERAL/BPH tidak boleh memiliki ruang lingkup Sekbid maupun Komisi (keduanya harus null)."
      );
    }
  }

  // 3. OSIS Assignment: Hanya Sekbid yang diizinkan, Komisi dilarang keras
  if (positionOrgType === OrganizationType.OSIS) {
    if (memberOrgType === OrganizationType.MPK) {
      throw new BusinessRuleError(
        "Anggota bertipe organisasi MPK tidak dapat ditugaskan pada jabatan OSIS."
      );
    }
    if (commissionId) {
      throw new BusinessRuleError(
        "Penugasan jabatan OSIS tidak boleh menetapkan Komisi MPK (hanya Sekbid yang diizinkan)."
      );
    }
  }

  // 4. MPK Assignment: Hanya Komisi yang diizinkan, Sekbid dilarang keras
  if (positionOrgType === OrganizationType.MPK) {
    if (memberOrgType === OrganizationType.OSIS) {
      throw new BusinessRuleError(
        "Anggota bertipe organisasi OSIS tidak dapat ditugaskan pada jabatan MPK."
      );
    }
    if (sekbidId) {
      throw new BusinessRuleError(
        "Penugasan jabatan MPK tidak boleh menetapkan Sekbid OSIS (hanya Komisi yang diizinkan)."
      );
    }
  }

  // 5. Validasi tipe anggota terhadap unit
  if (memberOrgType === OrganizationType.OSIS && commissionId) {
    throw new BusinessRuleError(
      "Anggota bertipe organisasi OSIS tidak dapat memiliki ruang lingkup Komisi MPK."
    );
  }
  if (memberOrgType === OrganizationType.MPK && sekbidId) {
    throw new BusinessRuleError(
      "Anggota bertipe organisasi MPK tidak dapat memiliki ruang lingkup Sekbid OSIS."
    );
  }
}

export async function assignMemberPosition(input: CreateMemberPositionInput) {
  // 1. Validasi keberadaan Member
  const member = await prisma.member.findUnique({
    where: { id: input.member_id },
  });
  if (!member) {
    throw new NotFoundError(`Anggota dengan ID '${input.member_id}' tidak ditemukan.`);
  }

  // 2. Validasi keberadaan Position
  const position = await prisma.position.findUnique({
    where: { id: input.position_id },
  });
  if (!position) {
    throw new NotFoundError(`Jabatan dengan ID '${input.position_id}' tidak ditemukan.`);
  }

  // 3. Validasi aturan matriks organisasi secara ketat
  validateAssignmentScope(
    member.organization_type,
    position.organization_type,
    input.sekbid_id,
    input.commission_id
  );

  // 4. Validasi keberadaan Sekbid / Commission jika disediakan
  if (input.sekbid_id) {
    const sekbid = await prisma.sekbid.findUnique({
      where: { id: input.sekbid_id },
    });
    if (!sekbid) {
      throw new NotFoundError(`Sekbid dengan ID '${input.sekbid_id}' tidak ditemukan.`);
    }
  }

  if (input.commission_id) {
    const commission = await prisma.commission.findUnique({
      where: { id: input.commission_id },
    });
    if (!commission) {
      throw new NotFoundError(`Komisi dengan ID '${input.commission_id}' tidak ditemukan.`);
    }
  }

  // 5. Cek Unique Constraint: (member_id, position_id, period_year)
  const existing = await prisma.memberPosition.findUnique({
    where: {
      member_id_position_id_period_year: {
        member_id: input.member_id,
        position_id: input.position_id,
        period_year: input.period_year,
      },
    },
  });

  if (existing) {
    throw new ConflictError(
      `Anggota '${member.full_name}' sudah memiliki jabatan '${position.name}' pada periode ${input.period_year}.`
    );
  }

  // 6. Buat record penugasan
  return prisma.memberPosition.create({
    data: {
      member_id: input.member_id,
      position_id: input.position_id,
      sekbid_id: input.sekbid_id,
      commission_id: input.commission_id,
      period_year: input.period_year,
      is_active: input.is_active,
    },
    include: {
      member: {
        select: { id: true, full_name: true, nis: true, class_grade: true },
      },
      position: true,
      sekbid: true,
      commission: true,
    },
  });
}

export async function updateMemberPosition(
  id: string,
  input: UpdateMemberPositionInput
) {
  const current = await prisma.memberPosition.findUnique({
    where: { id },
    include: { position: true, member: true },
  });

  if (!current) {
    throw new NotFoundError(`Penugasan jabatan dengan ID '${id}' tidak ditemukan.`);
  }

  const newSekbidId =
    input.sekbid_id !== undefined ? input.sekbid_id : current.sekbid_id;
  const newCommissionId =
    input.commission_id !== undefined ? input.commission_id : current.commission_id;

  const targetPositionId = input.position_id ?? current.position_id;
  const targetPeriodYear = input.period_year ?? current.period_year;

  const targetPosition =
    input.position_id && input.position_id !== current.position_id
      ? await prisma.position.findUnique({ where: { id: input.position_id } })
      : current.position;

  if (!targetPosition) {
    throw new NotFoundError(`Jabatan dengan ID '${targetPositionId}' tidak ditemukan.`);
  }

  // Validasi Scope Matrix menyeluruh
  validateAssignmentScope(
    current.member.organization_type,
    targetPosition.organization_type,
    newSekbidId,
    newCommissionId
  );

  // Validasi Sekbid & Commission jika diubah
  if (input.sekbid_id) {
    const sekbid = await prisma.sekbid.findUnique({ where: { id: input.sekbid_id } });
    if (!sekbid) throw new NotFoundError(`Sekbid dengan ID '${input.sekbid_id}' tidak ditemukan.`);
  }

  if (input.commission_id) {
    const commission = await prisma.commission.findUnique({ where: { id: input.commission_id } });
    if (!commission) throw new NotFoundError(`Komisi dengan ID '${input.commission_id}' tidak ditemukan.`);
  }

  // Validasi Unique constraint jika position atau period diubah
  if (
    (input.position_id && input.position_id !== current.position_id) ||
    (input.period_year && input.period_year !== current.period_year)
  ) {
    const duplicate = await prisma.memberPosition.findUnique({
      where: {
        member_id_position_id_period_year: {
          member_id: current.member_id,
          position_id: targetPositionId,
          period_year: targetPeriodYear,
        },
      },
    });

    if (duplicate && duplicate.id !== id) {
      throw new ConflictError(
        `Anggota sudah memiliki penugasan untuk jabatan ini pada periode ${targetPeriodYear}.`
      );
    }
  }

  return prisma.memberPosition.update({
    where: { id },
    data: input,
    include: {
      member: {
        select: { id: true, full_name: true, nis: true, class_grade: true },
      },
      position: true,
      sekbid: true,
      commission: true,
    },
  });
}

export async function deactivateMemberPosition(id: string) {
  const existing = await prisma.memberPosition.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError(`Penugasan jabatan dengan ID '${id}' tidak ditemukan.`);
  }

  return prisma.memberPosition.update({
    where: { id },
    data: { is_active: false },
    include: {
      member: { select: { id: true, full_name: true } },
      position: true,
    },
  });
}

export async function deleteMemberPosition(id: string, soft = true) {
  const existing = await prisma.memberPosition.findUnique({
    where: { id },
    include: { member: true, position: true },
  });

  if (!existing) {
    throw new NotFoundError(`Penugasan jabatan dengan ID '${id}' tidak ditemukan.`);
  }

  // Aturan bisnis: Utamakan soft deactivation untuk menjaga riwayat historis pengurus
  if (soft) {
    const updated = await prisma.memberPosition.update({
      where: { id },
      data: { is_active: false },
    });
    return {
      deleted: false,
      softDeactivated: true,
      message: "Penugasan jabatan berhasil dinonaktifkan (riwayat historis tetap terjaga).",
      data: updated,
    };
  }

  await prisma.memberPosition.delete({ where: { id } });
  return {
    deleted: true,
    softDeactivated: false,
    message: "Data penugasan jabatan berhasil dihapus permanen.",
  };
}
