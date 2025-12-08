ALTER TYPE "public"."role" ADD VALUE 'cashier' BEFORE 'seller';--> statement-breakpoint
CREATE TABLE "stock_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"old_stock" numeric(10, 2),
	"new_stock" numeric(10, 2),
	"new_price" numeric(15, 2),
	"added_by" integer,
	"note" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "is_printed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_history" ADD CONSTRAINT "stock_history_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_history" ADD CONSTRAINT "stock_history_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_is_printed_idx" ON "orders" USING btree ("is_printed");