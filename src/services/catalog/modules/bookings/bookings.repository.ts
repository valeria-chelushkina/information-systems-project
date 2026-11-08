import { and, asc, count, eq, type SQL } from "drizzle-orm";
import { db as database, type Database } from "@/shared/db/client.js";
import type { Executor } from "@/shared/db/executor.js";
import { timedQuery } from "@/shared/db/timed-query.js";
import { bookingRequests } from "@/services/catalog/db/schema/index.js";
import type {
  BookingRow,
  BookingStatus,
  NewBookingRow,
  BookingFilters,
} from "@/services/catalog/typedefs/booking.typedefs.js";

export class BookingsRepository {
  protected readonly db: Database = database;

  insertOne(
    values: NewBookingRow,
    exec: Executor = this.db,
  ): Promise<BookingRow> {
    return timedQuery("insert_booking_request", async () => {
      const [row] = await exec
        .insert(bookingRequests)
        .values(values)
        .returning();

      if (!row) {
        throw new Error("insert_booking_request returned no row");
      }

      return row;
    });
  }

  findById(id: string): Promise<BookingRow | null> {
    return timedQuery("find_booking_by_id", async () => {
      const [row] = await this.db
        .select()
        .from(bookingRequests)
        .where(eq(bookingRequests.id, id));

      return row ?? null;
    });
  }

  findMany(filters: BookingFilters): Promise<BookingRow[]> {
    return timedQuery("list_booking_requests", () =>
      this.db
        .select()
        .from(bookingRequests)
        .where(this.buildFilter(filters))
        .orderBy(asc(bookingRequests.startsAt))
        .limit(filters.limit)
        .offset(filters.offset),
    );
  }

  count(filters: BookingFilters): Promise<number> {
    return timedQuery("count_booking_requests", async () => {
      const [row] = await this.db
        .select({ value: count() })
        .from(bookingRequests)
        .where(this.buildFilter(filters));

      return Number(row?.value ?? 0);
    });
  }

  decide(
    id: string,
    status: BookingStatus,
    decidedBy: string | null,
  ): Promise<BookingRow | null> {
    return timedQuery("decide_booking_request", async () => {
      const [row] = await this.db
        .update(bookingRequests)
        .set({ status, decidedBy, decidedAt: new Date() })
        .where(
          and(
            eq(bookingRequests.id, id),
            eq(bookingRequests.status, "requested"),
          ),
        )
        .returning();

      return row ?? null;
    });
  }

  private buildFilter(filters: BookingFilters): SQL | undefined {
    const conditions: SQL[] = [];

    if (filters.venueId) {
      conditions.push(eq(bookingRequests.venueId, filters.venueId));
    }
    if (filters.status) {
      conditions.push(eq(bookingRequests.status, filters.status));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }
}
