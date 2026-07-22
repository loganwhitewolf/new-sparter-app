CREATE TABLE "expense_group" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"sub_category_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_group_membership" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"expense_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expense_group_membership_group_expense_unique" UNIQUE("group_id","expense_id"),
	CONSTRAINT "expense_group_membership_expense_unique" UNIQUE("expense_id")
);
--> statement-breakpoint
ALTER TABLE "expense_group" ADD CONSTRAINT "expense_group_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_group" ADD CONSTRAINT "expense_group_sub_category_id_sub_category_id_fk" FOREIGN KEY ("sub_category_id") REFERENCES "public"."sub_category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_group_membership" ADD CONSTRAINT "expense_group_membership_group_id_expense_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."expense_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_group_membership" ADD CONSTRAINT "expense_group_membership_expense_id_expense_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expense"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expense_group_userId_idx" ON "expense_group" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "expense_group_subCategoryId_idx" ON "expense_group" USING btree ("sub_category_id");--> statement-breakpoint
CREATE INDEX "expense_group_membership_groupId_idx" ON "expense_group_membership" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "expense_group_membership_expenseId_idx" ON "expense_group_membership" USING btree ("expense_id");