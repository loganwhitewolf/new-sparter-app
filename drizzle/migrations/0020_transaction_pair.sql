CREATE TABLE "transaction_pair" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_a_id" text NOT NULL,
	"transaction_b_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transaction_pair_a_unique" UNIQUE("transaction_a_id"),
	CONSTRAINT "transaction_pair_b_unique" UNIQUE("transaction_b_id")
);
--> statement-breakpoint
ALTER TABLE "transaction_pair" ADD CONSTRAINT "transaction_pair_transaction_a_id_transaction_id_fk" FOREIGN KEY ("transaction_a_id") REFERENCES "public"."transaction"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_pair" ADD CONSTRAINT "transaction_pair_transaction_b_id_transaction_id_fk" FOREIGN KEY ("transaction_b_id") REFERENCES "public"."transaction"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transaction_pair_a_idx" ON "transaction_pair" USING btree ("transaction_a_id");--> statement-breakpoint
CREATE INDEX "transaction_pair_b_idx" ON "transaction_pair" USING btree ("transaction_b_id");