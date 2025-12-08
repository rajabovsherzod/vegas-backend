import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users } from "./schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL topilmadi!");
}

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);

async function main() {
  console.log("🌱 Seeding boshlandi...");

  const username = "admin";
  const password = "password123";

  const existingUser = await db.select().from(users).where(eq(users.username, username));

  if (existingUser.length > 0) {
    console.log("⚠️  Admin foydalanuvchisi allaqachon mavjud. O'tkazib yuborilmoqda.");
    process.exit(0);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await db.insert(users).values({
    fullName: "Super Owner",
    username: username,
    password: hashedPassword,
    role: "owner",
    fixSalary: "0",
    workStartTime: "09:00:00",
    isActive: true,
  });

  console.log("✅ Super Owner muvaffaqiyatli yaratildi!");
  console.log(`👉 Login: ${username}`);
  console.log(`👉 Parol: ${password}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seedingda xatolik:", err);
  process.exit(1);
});