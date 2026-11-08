CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "booking_requests"
  ADD COLUMN "during" tstzrange
  GENERATED ALWAYS AS (tstzrange("starts_at", "ends_at", '[)')) STORED;
--> statement-breakpoint
ALTER TABLE "booking_requests"
  ADD CONSTRAINT "booking_requests_venue_no_overlap"
  EXCLUDE USING gist ("venue_id" WITH =, "during" WITH &&)
  WHERE ("status" = 'confirmed');
