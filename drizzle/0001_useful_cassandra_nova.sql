CREATE TYPE "public"."order_status" AS ENUM('draft', 'completed', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('owner', 'admin', 'seller');--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"date" date NOT NULL,
	"check_in" timestamp,
	"check_out" timestamp,
	"late_minutes" integer DEFAULT 0,
	"status" varchar(20) DEFAULT 'present'
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"username" varchar(50) NOT NULL,
	"password" varchar(255) NOT NULL,
	"role" "role" DEFAULT 'seller' NOT NULL,
	"card_id" varchar(100),
	"fix_salary" numeric(15, 2) DEFAULT '0',
	"bonus_percent" numeric(5, 2) DEFAULT '0',
	"fine_per_hour" numeric(15, 2) DEFAULT '0',
	"work_start_time" time DEFAULT '09:00:00',
	"is_active" boolean DEFAULT true,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_card_id_unique" UNIQUE("card_id")
);
--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'draft'::"public"."order_status";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE "public"."order_status" USING "status"::"public"."order_status";--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "seller_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cashier_id" integer;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_cashier_id_users_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;