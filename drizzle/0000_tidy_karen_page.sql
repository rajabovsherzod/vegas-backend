CREATE TYPE "public"."currency" AS ENUM('UZS', 'USD');--> statement-breakpoint
CREATE TYPE "public"."order_type" AS ENUM('retail', 'wholesale');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'card', 'transfer', 'debt');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"price" numeric(15, 2) NOT NULL,
	"original_currency" "currency",
	"total_price" numeric(18, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"total_amount" numeric(18, 2) NOT NULL,
	"discount_amount" numeric(18, 2) DEFAULT '0',
	"final_amount" numeric(18, 2) NOT NULL,
	"currency" "currency" DEFAULT 'UZS' NOT NULL,
	"exchange_rate" numeric(10, 2) DEFAULT '1',
	"type" "order_type" DEFAULT 'retail',
	"status" varchar(20) DEFAULT 'completed',
	"payment_method" "payment_method" DEFAULT 'cash',
	"partner_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"phone" varchar(50),
	"address" text,
	"balance" numeric(18, 2) DEFAULT '0',
	"currency" "currency" DEFAULT 'UZS',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "price_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"old_price" numeric(15, 2) NOT NULL,
	"new_price" numeric(15, 2) NOT NULL,
	"currency" "currency" NOT NULL,
	"changed_at" timestamp DEFAULT now(),
	"changed_by" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"barcode" varchar(100),
	"category_id" integer,
	"price" numeric(15, 2) NOT NULL,
	"original_price" numeric(15, 2),
	"currency" "currency" DEFAULT 'UZS' NOT NULL,
	"stock" numeric(10, 2) DEFAULT '0',
	"unit" varchar(20) DEFAULT 'dona',
	"image" text,
	"is_active" boolean DEFAULT true,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "products_barcode_unique" UNIQUE("barcode")
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;