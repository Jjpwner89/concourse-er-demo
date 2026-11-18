ALTER TABLE "documents" ADD COLUMN "mime" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "size" integer;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "data" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "sent_to" text;