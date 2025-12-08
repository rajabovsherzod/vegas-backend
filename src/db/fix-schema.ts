import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { categories, products } from "./schema";
import { sql } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL topilmadi!");
}

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);

async function main() {
  console.log("🔧 Schema fix boshlandi...");

  try {
    // Categories ni fix qilish
    await db.execute(sql`
      UPDATE categories 
      SET is_active = true, is_deleted = false 
      WHERE is_active IS NULL OR is_deleted IS NULL
    `);
    console.log("✅ Categories fixed!");

    // Products ni fix qilish (agar kerak bo'lsa)
    await db.execute(sql`
      UPDATE products 
      SET is_active = true, is_deleted = false 
      WHERE is_active IS NULL OR is_deleted IS NULL
    `);
    console.log("✅ Products fixed!");

    console.log("✅ Schema fix muvaffaqiyatli yakunlandi!");
  } catch (error) {
    console.error("❌ Xatolik:", error);
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Xatolik:", err);
  process.exit(1);
});







