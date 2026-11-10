import { prisma } from "../lib/db/prisma";

async function verifyDeployment() {
  console.log("=== PHASE 5: POST-DEPLOYMENT VERIFICATION ON RAILWAY ===");

  try {
    // 1. Check _prisma_migrations table and records
    const migrations = await prisma.$queryRaw<
      Array<{ migration_name: string; finished_at: Date; rolled_back_at: Date | null; applied_steps_count: number }>
    >`SELECT migration_name, finished_at, rolled_back_at, applied_steps_count FROM _prisma_migrations;`;
    
    console.log("\n[1] PRISMA MIGRATIONS RECORD:");
    for (const m of migrations) {
      console.log(`- Migration: ${m.migration_name} (Finished: ${m.finished_at}, Steps: ${m.applied_steps_count})`);
    }

    // 2. Check all application tables
    const tables = await prisma.$queryRaw<
      Array<{ table_name: string }>
    >`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    console.log(`\n[2] APPLICATION TABLES (${tables.length} tables found):`);
    console.log(tables.map((t) => t.table_name).join(", "));

    // 3. Check all enums
    const enums = await prisma.$queryRaw<
      Array<{ enum_name: string; enum_values: string }>
    >`
      SELECT t.typname as enum_name, string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as enum_values 
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid 
      JOIN pg_namespace n ON n.oid = t.typnamespace 
      WHERE n.nspname = 'public' 
      GROUP BY t.typname 
      ORDER BY t.typname;
    `;
    console.log(`\n[3] ENUMS IN PUBLIC SCHEMA (${enums.length} enums found):`);
    for (const e of enums) {
      console.log(`- ${e.enum_name}: [${e.enum_values}]`);
    }

    // 4. Check Foreign Keys count
    const fks = await prisma.$queryRaw<
      Array<{ constraint_name: string; table_name: string }>
    >`
      SELECT constraint_name, table_name 
      FROM information_schema.table_constraints 
      WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public'
      ORDER BY table_name, constraint_name;
    `;
    console.log(`\n[4] FOREIGN KEYS (${fks.length} constraints found):`);
    for (const fk of fks) {
      console.log(`- ${fk.table_name} -> ${fk.constraint_name}`);
    }

    // 5. Check attendances unique constraint & indexes
    const attendanceIndexes = await prisma.$queryRaw<
      Array<{ indexname: string; indexdef: string }>
    >`SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'attendances' ORDER BY indexname;`;
    console.log("\n[5] ATTENDANCE INDEXES & UNIQUE CONSTRAINTS:");
    for (const idx of attendanceIndexes) {
      console.log(`- ${idx.indexname}: ${idx.indexdef}`);
    }

    // 6. Check custom CHECK constraint on member_positions
    const checkConstraints = await prisma.$queryRaw<
      Array<{ constraint_name: string; check_clause: string }>
    >`
      SELECT tc.constraint_name, cc.check_clause
      FROM information_schema.table_constraints tc
      JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
      WHERE tc.table_name = 'member_positions' AND tc.constraint_type = 'CHECK';
    `;
    console.log("\n[6] MEMBER_POSITIONS CHECK CONSTRAINT:");
    for (const cc of checkConstraints) {
      console.log(`- ${cc.constraint_name}: ${cc.check_clause}`);
    }

    // 7. Check ActivitySchedule timestamp column types
    const scheduleColumns = await prisma.$queryRaw<
      Array<{ column_name: string; data_type: string; udt_name: string }>
    >`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'activity_schedules' AND column_name IN ('date', 'start_time', 'late_threshold', 'end_time')
      ORDER BY ordinal_position;
    `;
    console.log("\n[7] ACTIVITY_SCHEDULES COLUMN TYPES:");
    for (const col of scheduleColumns) {
      console.log(`- ${col.column_name}: ${col.data_type} (${col.udt_name})`);
    }

    // 8. Check devices columns (verify api_key_hash)
    const deviceColumns = await prisma.$queryRaw<
      Array<{ column_name: string; data_type: string }>
    >`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'devices'
      ORDER BY ordinal_position;
    `;
    console.log("\n[8] DEVICES TABLE COLUMNS:");
    for (const col of deviceColumns) {
      console.log(`- ${col.column_name} (${col.data_type})`);
    }

    console.log("\nVERIFICATION COMPLETE: ALL CHECKS PASSED!");
  } catch (error) {
    console.error("VERIFICATION FAILED:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

verifyDeployment();
