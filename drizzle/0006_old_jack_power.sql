CREATE TABLE "refund_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"refund_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"price" numeric(15, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"total_amount" numeric(18, 2) NOT NULL,
	"reason" text,
	"refunded_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'draft'::text;--> statement-breakpoint
DROP TYPE "public"."order_status";--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('draft', 'completed', 'cancelled', 'fully_refunded', 'partially_refunded');--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'draft'::"public"."order_status";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE "public"."order_status" USING "status"::"public"."order_status";--> statement-breakpoint
DROP INDEX "categories_name_idx";--> statement-breakpoint
DROP INDEX "categories_is_active_idx";--> statement-breakpoint
DROP INDEX "error_logs_level_idx";--> statement-breakpoint
DROP INDEX "error_logs_created_at_idx";--> statement-breakpoint
DROP INDEX "error_logs_user_id_idx";--> statement-breakpoint
DROP INDEX "orders_cashier_idx";--> statement-breakpoint
DROP INDEX "orders_created_at_idx";--> statement-breakpoint
DROP INDEX "orders_status_created_idx";--> statement-breakpoint
DROP INDEX "orders_type_idx";--> statement-breakpoint
DROP INDEX "orders_payment_method_idx";--> statement-breakpoint
DROP INDEX "orders_is_printed_idx";--> statement-breakpoint
DROP INDEX "products_category_idx";--> statement-breakpoint
DROP INDEX "products_is_active_idx";--> statement-breakpoint
DROP INDEX "products_currency_idx";--> statement-breakpoint
DROP INDEX "users_is_active_idx";--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "original_price" numeric(15, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "discount_price" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "discount_start" timestamp;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "discount_end" timestamp;--> statement-breakpoint
ALTER TABLE "refund_items" ADD CONSTRAINT "refund_items_refund_id_refunds_id_fk" FOREIGN KEY ("refund_id") REFERENCES "public"."refunds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund_items" ADD CONSTRAINT "refund_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_refunded_by_users_id_fk" FOREIGN KEY ("refunded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" DROP COLUMN "original_currency";