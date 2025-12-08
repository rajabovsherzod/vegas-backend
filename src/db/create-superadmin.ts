/**
 * Create SuperAdmin Script
 * 
 * Faqat bitta superadmin (developer) yaratadi
 * 
 * Usage: npx tsx src/db/create-superadmin.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users } from "./schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import readline from "readline";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL topilmadi!");
}

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function createSuperAdmin() {
  console.log("🔧 =========================================");
  console.log("   SUPERADMIN (DEVELOPER) YARATISH");
  console.log("=========================================");
  console.log("");

  try {
    // Ma'lumotlarni so'rash
    const username = await question("Username (developer): ");
    if (!username || username.trim() === "") {
      console.error("❌ Username bo'sh bo'lishi mumkin emas!");
      process.exit(1);
    }

    const password = await question("Password (min 6 belgi): ");
    if (!password || password.length < 6) {
      console.error("❌ Parol kamida 6 belgi bo'lishi kerak!");
      process.exit(1);
    }

    const confirmPassword = await question("Password (qayta): ");
    if (password !== confirmPassword) {
      console.error("❌ Parollar mos kelmayapti!");
      process.exit(1);
    }

    const fullName = await question("Full Name (Developer): ") || "Developer";

    console.log("");
    console.log("⏳ SuperAdmin yaratilmoqda...");

    // Username allaqachon mavjudligini tekshirish
    const existingUser = await db.select().from(users).where(eq(users.username, username.trim()));

    if (existingUser.length > 0) {
      console.error(`❌ Username allaqachon mavjud: ${existingUser[0].username}`);
      process.exit(1);
    }

    // Developer rolida user mavjudligini tekshirish
    const existingDeveloper = await db.select().from(users).where(eq(users.role, "developer"));

    if (existingDeveloper.length > 0) {
      console.error("❌ Developer allaqachon mavjud!");
      console.error(`   Username: ${existingDeveloper[0].username}`);
      console.error(`   Full Name: ${existingDeveloper[0].fullName}`);
      console.error("");
      console.error("💡 Agar yangi developer yaratmoqchi bo'lsangiz, avval eskisini o'chiring yoki rolini o'zgartiring.");
      process.exit(1);
    }

    // Parolni hash qilish
    const hashedPassword = await bcrypt.hash(password, 10);

    // SuperAdmin yaratish
    const [newUser] = await db
      .insert(users)
      .values({
        fullName: fullName.trim(),
        username: username.trim(),
        password: hashedPassword,
        role: "developer",
        isActive: true,
        isDeleted: false,
        fixSalary: "0",
        workStartTime: "09:00:00",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    console.log("");
    console.log("✅ =========================================");
    console.log("   SUPERADMIN MUVAFFAQIYATLI YARATILDI!");
    console.log("=========================================");
    console.log("");
    console.log("📋 Ma'lumotlar:");
    console.log(`   Full Name: ${newUser.fullName}`);
    console.log(`   Username: ${newUser.username}`);
    console.log(`   Role: ${newUser.role}`);
    console.log(`   ID: ${newUser.id}`);
    console.log("");
    console.log("🔐 Login qilish:");
    console.log(`   URL: http://localhost:3000/auth/login`);
    console.log(`   Username: ${newUser.username}`);
    console.log(`   Password: ${password}`);
    console.log("");
    console.log("⚠️  Eslatma: Parolni yaxshi saqlang!");
    console.log("");

    process.exit(0);
  } catch (error: any) {
    console.error("");
    console.error("❌ Xatolik yuz berdi:");
    console.error(error.message);
    console.error("");
    process.exit(1);
  } finally {
    rl.close();
    await client.end();
  }
}

// Script ni ishga tushirish
createSuperAdmin();

