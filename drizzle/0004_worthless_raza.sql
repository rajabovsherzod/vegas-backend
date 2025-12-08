CREATE TYPE "public"."error_log_level" AS ENUM('error', 'warning', 'info');--> statement-breakpoint
ALTER TYPE "public"."role" ADD VALUE 'developer';--> statement-breakpoint
CREATE TABLE "error_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"message" text NOT NULL,
	"stack" text,
	"url" text NOT NULL,
	"user_agent" text NOT NULL,
	"level" "error_log_level" DEFAULT 'error' NOT NULL,
	"context" text,
	"ip" varchar(45),
	"user_id" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "error_logs" ADD CONSTRAINT "error_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "error_logs_level_idx" ON "error_logs" USING btree ("level");--> statement-breakpoint
CREATE INDEX "error_logs_created_at_idx" ON "error_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "error_logs_user_id_idx" ON "error_logs" USING btree ("user_id");