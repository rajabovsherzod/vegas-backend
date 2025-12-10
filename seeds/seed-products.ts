import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config();

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client, { schema });

interface ProductData {
  name: string;
  barcode: string | null;
  category: string;
  unit: string;
  sellingPriceUzs: number;
  sellingPriceUsd: number;
  incomingPriceUzs: number;
  incomingPriceUsd: number;
  stock: number;
}

async function seedProducts() {
  console.log("🚀 Mahsulotlar seed boshlandi...\n");

  // 1. JSON o'qish
  const jsonPath = path.join(__dirname, "products.json");
  const products: ProductData[] = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  console.log(`📦 ${products.length} ta mahsulot topildi\n`);

  // 2. Kategoriyalarni olish (name -> id)
  const allCategories = await db.query.categories.findMany();
  const categoryMap = new Map<string, number>();
  allCategories.forEach((cat) => {
    categoryMap.set(cat.name.toLowerCase(), cat.id);
  });
  console.log(`📁 ${categoryMap.size} ta kategoriya bazada\n`);

  // 3. Ishlatilgan barkodlar (duplicate bo'lsa null qilish uchun)
  const usedBarcodes = new Set<string>();

  // 4. Birma-bir qo'shish
  let inserted = 0;
  let skipped = 0;
  let nulledBarcodes = 0;

  for (let i = 0; i < products.length; i++) {
    const p = products[i];

    // Kategoriya ID
    const categoryId = categoryMap.get(p.category.toLowerCase());
    if (!categoryId) {
      skipped++;
      continue;
    }

    // Barkod - duplicate bo'lsa null qilish
    let barcode = p.barcode;
    if (barcode) {
      if (usedBarcodes.has(barcode)) {
        barcode = null; // Duplicate - null qilamiz
        nulledBarcodes++;
      } else {
        usedBarcodes.add(barcode);
      }
    }

    try {
      await db.insert(schema.products).values({
        name: p.name,
        barcode: barcode,
        categoryId,
        incomingPriceUzs: String(p.incomingPriceUzs || 0),
        incomingPriceUsd: String(p.incomingPriceUsd || 0),
        sellingPriceUzs: String(p.sellingPriceUzs || 0),
        sellingPriceUsd: String(p.sellingPriceUsd || 0),
        stock: String(p.stock || 0),
        unit: p.unit,
        currency: "UZS" as const,
        isActive: true,
        isDeleted: false,
      });
      inserted++;

      if (inserted % 500 === 0) {
        console.log(`📦 ${inserted} qo'shildi...`);
      }
    } catch (err: any) {
      console.log(`❌ Xato: ${p.name} - ${err.message}`);
      skipped++;
    }
  }

  console.log("\n🎉 Import tugadi!");
  console.log(`✅ Qo'shildi: ${inserted}`);
  console.log(`⚠️  Kategoriya yo'q: ${skipped}`);
  console.log(`🔄 Barkod null qilindi: ${nulledBarcodes}`);

  await client.end();
  process.exit(0);
}

seedProducts().catch((err) => {
  console.error("❌ Xatolik:", err);
  process.exit(1);
});
