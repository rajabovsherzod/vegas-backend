import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config();

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client, { schema });

async function seedCategories() {
  console.log("🚀 Kategoriyalar seed boshlandi...\n");

  // JSON o'qish
  const jsonPath = path.join(__dirname, "categories.json");
  const categories: string[] = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

  console.log(`📁 ${categories.length} ta kategoriya topildi\n`);

  let inserted = 0;

  for (const name of categories) {
    await db.insert(schema.categories).values({
      name,
      isActive: true,
      isDeleted: false,
    });
    console.log(`✅ ${name}`);
    inserted++;
  }

  console.log(`\n🎉 Tayyor! ${inserted} ta kategoriya qo'shildi`);
  
  await client.end();
  process.exit(0);
}

seedCategories().catch((err) => {
  console.error("❌ Xatolik:", err);
  process.exit(1);
});
