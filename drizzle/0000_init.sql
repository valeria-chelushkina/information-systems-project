CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"performer_id" uuid NOT NULL,
	"performer_name" text NOT NULL,
	"venue_id" uuid NOT NULL,
	"venue_name" text NOT NULL,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"doors_at" timestamp with time zone,
	"duration_minutes" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"on_sale_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_status_check" CHECK ("events"."status" IN ('draft', 'scheduled', 'on_sale', 'sold_out', 'completed', 'cancelled')),
	CONSTRAINT "events_doors_before_start_check" CHECK ("events"."doors_at" IS NULL OR "events"."doors_at" < "events"."starts_at"),
	CONSTRAINT "events_duration_check" CHECK ("events"."duration_minutes" IS NULL OR "events"."duration_minutes" > 0)
);
--> statement-breakpoint
CREATE TABLE "price_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"price_cents" integer NOT NULL,
	"total_qty" integer NOT NULL,
	"available_qty" integer NOT NULL,
	"sold_qty" integer DEFAULT 0 NOT NULL,
	"held_qty" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "price_tiers_event_name_key" UNIQUE("event_id","name"),
	CONSTRAINT "price_tiers_price_cents_check" CHECK ("price_tiers"."price_cents" >= 0),
	CONSTRAINT "price_tiers_total_qty_check" CHECK ("price_tiers"."total_qty" >= 0),
	CONSTRAINT "price_tiers_available_qty_check" CHECK ("price_tiers"."available_qty" >= 0),
	CONSTRAINT "price_tiers_sold_qty_check" CHECK ("price_tiers"."sold_qty" >= 0),
	CONSTRAINT "price_tiers_held_qty_check" CHECK ("price_tiers"."held_qty" >= 0),
	CONSTRAINT "price_tiers_qty_consistent" CHECK ("price_tiers"."available_qty" + "price_tiers"."sold_qty" + "price_tiers"."held_qty" = "price_tiers"."total_qty")
);
--> statement-breakpoint
ALTER TABLE "price_tiers" ADD CONSTRAINT "price_tiers_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_status_on_sale_at_idx" ON "events" USING btree ("status","on_sale_at");