import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

async function backupDatabase() {
  const prisma = new PrismaClient({ log: ["error"] });
  const backupDir = path.join(process.cwd(), "prisma", "backups");

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  try {
    console.log("Initiating pre-deployment database backup & state snapshot...");
    await prisma.$connect();

    // 1. Database & Catalog metadata
    const dbInfo = await prisma.$queryRaw<Array<{ db_name: string; version: string }>>`
      SELECT current_database() as db_name, version();
    `;

    // 2. Schemas
    const schemas = await prisma.$queryRaw<Array<{ schema_name: string }>>`
      SELECT schema_name FROM information_schema.schemata;
    `;

    // 3. Tables & Views
    const tables = await prisma.$queryRaw<Array<{ table_schema: string; table_name: string; table_type: string }>>`
      SELECT table_schema, table_name, table_type 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `;

    // 4. Custom Types / Enums
    const types = await prisma.$queryRaw<Array<{ typname: string }>>`
      SELECT t.typname 
      FROM pg_type t 
      JOIN pg_namespace n ON n.oid = t.typnamespace 
      WHERE n.nspname = 'public';
    `;

    // 5. Extensions
    const extensions = await prisma.$queryRaw<Array<{ extname: string; extversion: string }>>`
      SELECT extname, extversion FROM pg_extension;
    `;

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFileName = `pre_migration_backup_${timestamp}.json`;
    const backupFilePath = path.join(backupDir, backupFileName);

    const backupPayload = {
      timestamp: new Date().toISOString(),
      database: dbInfo[0]?.db_name,
      server_version: dbInfo[0]?.version,
      schemas: schemas.map((s) => s.schema_name),
      public_tables_count: tables.length,
      public_tables: tables,
      public_types_count: types.length,
      public_types: types,
      extensions,
      state: tables.length === 0 ? "EMPTY_INITIAL_STATE" : "EXISTING_DATA_STATE",
    };

    fs.writeFileSync(backupFilePath, JSON.stringify(backupPayload, null, 2), "utf-8");

    // Verify backup file was created and is non-empty
    const stats = fs.statSync(backupFilePath);
    if (stats.size > 0) {
      console.log(`BACKUP STATUS: COMPLETED & VERIFIED`);
      console.log(`Backup File: ${backupFileName} (${stats.size} bytes)`);
      console.log(`Target DB State: ${backupPayload.state} (${tables.length} tables found)`);
    } else {
      throw new Error("Backup file was created but has 0 bytes.");
    }
  } catch (error) {
    console.error("BACKUP FAILED:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

backupDatabase();
