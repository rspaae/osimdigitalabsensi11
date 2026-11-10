import { PrismaClient } from "@prisma/client";

async function inspectDatabase() {
  const prisma = new PrismaClient({
    log: ["error"],
  });

  try {
    console.log("=== RAILWAY POSTGRESQL READ-ONLY INSPECTION ===");

    // 1. Database name & version
    const dbInfo = await prisma.$queryRaw<
      Array<{ db_name: string; pg_version: string }>
    >`SELECT current_database() as db_name, version() as pg_version;`;
    
    console.log("\n--- 1. DATABASE & SERVER INFO ---");
    console.log(`Database Name : ${dbInfo[0]?.db_name}`);
    console.log(`Version       : ${dbInfo[0]?.pg_version.split("\n")[0]}`);

    // 2. Existing Schemas
    const schemas = await prisma.$queryRaw<
      Array<{ schema_name: string }>
    >`SELECT schema_name FROM information_schema.schemata ORDER BY schema_name;`;
    console.log("\n--- 2. EXISTING SCHEMAS ---");
    console.log(schemas.map((s) => s.schema_name).join(", "));

    // 3. Existing Tables in 'public'
    const publicTables = await prisma.$queryRaw<
      Array<{ table_name: string; table_type: string }>
    >`
      SELECT table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    console.log("\n--- 3. PUBLIC TABLES ---");
    if (publicTables.length === 0) {
      console.log("No tables found in 'public' schema.");
    } else {
      for (const t of publicTables) {
        console.log(`- ${t.table_name} (${t.table_type})`);
      }
    }

    // 4. Migration Metadata (_prisma_migrations)
    const hasMigrationTable = publicTables.some(
      (t) => t.table_name === "_prisma_migrations"
    );
    console.log("\n--- 4. PRISMA MIGRATIONS HISTORY ---");
    if (hasMigrationTable) {
      const migrations = await prisma.$queryRaw<
        Array<{
          id: string;
          migration_name: string;
          finished_at: Date | null;
          applied_steps_count: number;
        }>
      >`SELECT id, migration_name, finished_at, applied_steps_count FROM _prisma_migrations ORDER BY started_at;`;
      console.log(`Found ${migrations.length} migration record(s):`);
      for (const m of migrations) {
        console.log(
          `- ${m.migration_name} (Applied steps: ${m.applied_steps_count}, Finished: ${m.finished_at})`
        );
      }
    } else {
      console.log("_prisma_migrations table DOES NOT EXIST.");
    }

    // 5. Existing Enums and Custom Types in 'public'
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
    console.log("\n--- 5. CUSTOM ENUMS & TYPES (PUBLIC SCHEMA) ---");
    if (enums.length === 0) {
      console.log("No custom enums or types found in 'public' schema.");
    } else {
      for (const e of enums) {
        console.log(`- ${e.enum_name}: [${e.enum_values}]`);
      }
    }

    // 6. Installed Extensions
    const extensions = await prisma.$queryRaw<
      Array<{ extname: string; extversion: string }>
    >`SELECT extname, extversion FROM pg_extension ORDER BY extname;`;
    console.log("\n--- 6. INSTALLED EXTENSIONS ---");
    for (const ext of extensions) {
      console.log(`- ${ext.extname} (v${ext.extversion})`);
    }

    // Summary
    console.log("\n--- SUMMARY ---");
    console.log(
      `Database Status: Connected. Public schema has ${publicTables.length} tables, ${enums.length} enums.`
    );
    console.log(`Is Database Empty: ${publicTables.length === 0 ? "YES" : "NO"}`);
  } catch (error) {
    console.error("Inspection Error:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

inspectDatabase();
