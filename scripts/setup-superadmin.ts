import readline from "node:readline";
import { setupInitialSuperadmin } from "../lib/auth/setup.service";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function runCliSetup() {
  console.log("=================================================");
  console.log("OSIS MPK SMKN 11 BANDUNG — INITIAL SUPERADMIN SETUP");
  console.log("=================================================\n");

  try {
    const setupSecret =
      process.env.INITIAL_SUPERADMIN_SECRET ||
      process.env.SETUP_SECRET ||
      (await askQuestion("Masukkan SETUP_SECRET: "));

    if (!setupSecret) {
      console.error("ERROR: SETUP_SECRET wajib diisi.");
      process.exit(1);
    }

    const username = await askQuestion("Masukkan Username Superadmin: ");
    const email = await askQuestion("Masukkan Email Superadmin: ");
    const password = await askQuestion("Masukkan Password (minimal 8 karakter): ");

    console.log("\nMemproses inisialisasi akun Superadmin...");

    const result = await setupInitialSuperadmin({
      username: username.trim(),
      email: email.trim(),
      password,
      setupSecret: setupSecret.trim(),
    });

    if (!result.success) {
      console.error(`\n❌ INSIALISASI GAGAL: ${result.error}`);
      process.exit(1);
    }

    console.log("\n✔ AKUN SUPERADMIN BERHASIL DIBUAT!");
    console.log(`- ID       : ${result.user?.id}`);
    console.log(`- Username : ${result.user?.username}`);
    console.log(`- Email    : ${result.user?.email}`);
    console.log(`- Role     : ${result.user?.role}`);
    console.log("\nSilakan gunakan akun ini untuk login pada antarmuka web /login.");
  } catch (err) {
    console.error("Terjadi kesalahan:", err);
    process.exit(1);
  } finally {
    rl.close();
  }
}

runCliSetup();
