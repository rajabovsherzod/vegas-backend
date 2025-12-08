import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import ApiError from "@/utils/ApiError";
import logger from "@/utils/logger";
import bcrypt from "bcrypt";
import { getIO } from "@/socket"; 
import { CreateUserInput, UpdateUserInput } from "./validation";

export const userService = {
  // 1. GET ALL (O'chirilmaganlarni olish)
  getAll: async () => {
    const data = await db.query.users.findMany({
      where: eq(users.isDeleted, false),
      orderBy: desc(users.createdAt),
      columns: {
        password: false, // Parolni qaytarmaymiz
      }
    });
    return data;
  },

  // 2. CREATE (Yangi xodim yaratish)
  create: async (payload: CreateUserInput) => {
    // 1. Login band emasmi?
    const existingUser = await db.query.users.findFirst({
      where: eq(users.username, payload.username),
    });
    
    if (existingUser) {
      throw new ApiError(409, "Bu login allaqachon band!");
    }

    // 2. Parolni shifrlash
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(payload.password, saltRounds);

    // 3. Bazaga yozish
    const [newUser] = await db.insert(users).values({
      ...payload,
      password: hashedPassword,
      // TypeScript uchun rolni aniqlashtiramiz (schema dagi enumga moslab)
      role: payload.role as "admin" | "cashier" | "seller", 
    }).returning({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    });

    logger.info(`Yangi xodim yaratildi: ${newUser.username} (${newUser.role})`);
    
    return newUser;
  },

  // 3. UPDATE
  update: async (id: number, payload: UpdateUserInput) => {
    let updateData: any = { ...payload };
    
    // Agar parol o'zgarsa, qayta shifrlaymiz
    if (payload.password) {
      const saltRounds = 10;
      updateData.password = await bcrypt.hash(payload.password, saltRounds);
    }

    const [updatedUser] = await db
      .update(users)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        role: users.role,
        isActive: users.isActive,
      });

    if (!updatedUser) throw new ApiError(404, "Xodim topilmadi");

    // 🔥 SOCKET: Agar bloklansa (isActive=false), tizimdan chiqarib yuboramiz
    if (payload.isActive === false) {
        try {
            getIO().emit("user_status_change", {
                userId: id,
                status: "blocked",
                message: "Sizning akkauntingiz bloklandi."
            });
        } catch (e) { logger.error(e); }
    }

    return updatedUser;
  },

  // 4. DELETE (Soft Delete)
  delete: async (id: number) => {
    const [deleted] = await db
      .update(users)
      .set({ 
        isDeleted: true,
        isActive: false, // Login qila olmasligi uchun
        updatedAt: new Date()
      })
      .where(eq(users.id, id))
      .returning({ id: users.id, username: users.username });

    if (!deleted) throw new ApiError(404, "Xodim topilmadi");

    // 🔥 SOCKET: O'chirilganda ham chiqarib yuboramiz
    try {
        getIO().emit("user_status_change", {
            userId: id,
            status: "deleted",
            message: "Akkaunt o'chirildi."
        });
    } catch (e) { logger.error(e); }

    return deleted;
  },
  
  // 5. GET BY ID
  getById: async (id: number) => {
      const user = await db.query.users.findFirst({
          where: eq(users.id, id),
          columns: { password: false }
      });
      if (!user) throw new ApiError(404, "Xodim topilmadi");
      return user;
  }
};