CREATE TABLE "ai_drafts" (
	"id" serial PRIMARY KEY NOT NULL,
	"case_id" text,
	"feature" text NOT NULL,
	"user_id" text NOT NULL,
	"content" text NOT NULL,
	"status" text DEFAULT 'Draft' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"live" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "allegations" (
	"id" serial PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"seq" serial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"user_id" text,
	"action" text NOT NULL,
	"case_id" text,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"prev_hash" text NOT NULL,
	"hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cases" (
	"id" text PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"type" text NOT NULL,
	"category" text NOT NULL,
	"subtype" text,
	"title" text NOT NULL,
	"narrative" text NOT NULL,
	"status" text NOT NULL,
	"stage" text NOT NULL,
	"sensitivity" text NOT NULL,
	"department" text NOT NULL,
	"assignee_id" text,
	"source" text NOT NULL,
	"anonymous" boolean DEFAULT false NOT NULL,
	"incident_date" date,
	"created_at" timestamp with time zone NOT NULL,
	"due_date" date,
	"closed_at" timestamp with time zone,
	"outcome" text,
	"hold_reason" text,
	"legal_hold" boolean DEFAULT false NOT NULL,
	"paid_leave_start" date,
	"paid_leave_end" date,
	"external_filings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"linked_case_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"overlap_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rtw" jsonb,
	CONSTRAINT "cases_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"medical" boolean DEFAULT false NOT NULL,
	"content" text,
	"uploaded_by" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"title" text NOT NULL,
	"department" text NOT NULL,
	"supervisor_id" text,
	"location" text NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"hire_date" date NOT NULL,
	"bargaining_unit" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intakes" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"form" text NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"anonymous" boolean DEFAULT false NOT NULL,
	"follow_up_code" text,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'New' NOT NULL,
	"case_id" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"party_name" text NOT NULL,
	"party_role" text NOT NULL,
	"scheduled_at" timestamp with time zone,
	"status" text NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"visibility" text DEFAULT 'Internal' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"text" text NOT NULL,
	"href" text,
	"read" boolean DEFAULT false NOT NULL,
	"channel" text DEFAULT 'In-app' NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parties" (
	"id" serial PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"role" text NOT NULL,
	"employee_id" text,
	"name" text NOT NULL,
	"anonymous" boolean DEFAULT false NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"version" integer NOT NULL,
	"body" text NOT NULL,
	"author_id" text NOT NULL,
	"ai_assisted" boolean DEFAULT false NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"comments" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"title" text NOT NULL,
	"assignee_id" text,
	"due_date" date,
	"done" boolean DEFAULT false NOT NULL,
	"recurring" text,
	"auto" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"title" text NOT NULL,
	"role" text NOT NULL,
	"employee_id" text,
	"departments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"initials" text NOT NULL
);
