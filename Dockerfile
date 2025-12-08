# --- 1-BOSQICH: Build ---
FROM node:20-alpine AS build
WORKDIR /app

# Pnpm o'rnatamiz
RUN npm install -g pnpm

# Fayllarni nusxalash
COPY package.json pnpm-lock.yaml ./

# Hamma kutubxonalarni o'rnatish (devDependencies ham kerak build uchun)
RUN pnpm install --frozen-lockfile

# Kodni to'liq nusxalash
COPY . .

# JavaScriptga o'girish (Build)
RUN pnpm run build

# --- 2-BOSQICH: Production ---
FROM node:20-alpine AS production
WORKDIR /app

RUN npm install -g pnpm
ENV NODE_ENV=production

# 1. Dependency fayllarni nusxalash
COPY package.json pnpm-lock.yaml ./

# 2. Faqat production kutubxonalarni o'rnatish
RUN pnpm install --prod --frozen-lockfile

# 🔥 MUHIM: Drizzle Kit ishlashi uchun uni alohida qo'shamiz
# (Chunki u odatda devDependency bo'ladi, lekin bizga prod konteyner ichida kerak)
RUN pnpm add -D drizzle-kit

# 3. Build bo'lgan fayllarni olish
COPY --from=build /app/dist ./dist

# 🔥 BETON FIX: Config va Migratsiya papkasini olib o'tamiz
COPY --from=build /app/drizzle.config.ts ./
# Agar senda migrations papkasi 'drizzle' deb nomlangan bo'lsa:
COPY --from=build /app/drizzle ./drizzle 

EXPOSE 5000

CMD ["node", "dist/server.js"]