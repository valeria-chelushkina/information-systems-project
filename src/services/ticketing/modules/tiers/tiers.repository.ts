import { and, asc, eq, sql } from 'drizzle-orm';
import { db as database, type Database } from '@/shared/db/client.js';
import type { Executor } from '@/shared/db/executor.js';
import { priceTiers } from '@/services/ticketing/db/schema/index.js';
import { timedQuery } from '@/shared/db/timed-query.js';
import type { NewPriceTierRow, PriceTierRow } from '@/services/ticketing/typedefs/tier.typedefs.js';

export class TiersRepository {
  protected readonly db: Database = database;

  insertOne(values: NewPriceTierRow): Promise<PriceTierRow> {
    return timedQuery('insert_price_tier', async () => {
      const [row] = await this.db.insert(priceTiers).values(values).returning();

      if (!row) {
        throw new Error('insert_price_tier returned no row');
      }

      return row;
    });
  }

  insertMany(values: NewPriceTierRow[]): Promise<PriceTierRow[]> {
    return timedQuery('insert_price_tiers_bulk', () =>
      this.db.insert(priceTiers).values(values).returning(),
    );
  }

  findById(id: string, exec: Executor = this.db): Promise<PriceTierRow | null> {
    return timedQuery('find_price_tier_by_id', async () => {
      const [row] = await exec.select().from(priceTiers).where(eq(priceTiers.id, id));
      return row ?? null;
    });
  }

  findByEventId(eventId: string): Promise<PriceTierRow[]> {
    return timedQuery('list_price_tiers', () =>
      this.db
        .select()
        .from(priceTiers)
        .where(eq(priceTiers.eventId, eventId))
        .orderBy(asc(priceTiers.priceCents)),
    );
  }

  reserve(
    tierId: string,
    quantity: number,
    exec: Executor = this.db,
  ): Promise<PriceTierRow | null> {
    return timedQuery('reserve_tier_inventory', async () => {
      const [row] = await exec
        .update(priceTiers)
        .set({
          availableQty: sql`${priceTiers.availableQty} - ${quantity}`,
          heldQty: sql`${priceTiers.heldQty} + ${quantity}`,
        })
        .where(and(eq(priceTiers.id, tierId), sql`${priceTiers.availableQty} >= ${quantity}`))
        .returning();

      return row ?? null;
    });
  }

  release(
    tierId: string,
    quantity: number,
    exec: Executor = this.db,
  ): Promise<PriceTierRow | null> {
    return timedQuery('release_tier_inventory', async () => {
      const [row] = await exec
        .update(priceTiers)
        .set({
          availableQty: sql`${priceTiers.availableQty} + ${quantity}`,
          heldQty: sql`${priceTiers.heldQty} - ${quantity}`,
        })
        .where(and(eq(priceTiers.id, tierId), sql`${priceTiers.heldQty} >= ${quantity}`))
        .returning();

      return row ?? null;
    });
  }

  sellFromHold(
    tierId: string,
    quantity: number,
    exec: Executor = this.db,
  ): Promise<PriceTierRow | null> {
    return timedQuery('sell_from_hold', async () => {
      const [row] = await exec
        .update(priceTiers)
        .set({
          heldQty: sql`${priceTiers.heldQty} - ${quantity}`,
          soldQty: sql`${priceTiers.soldQty} + ${quantity}`,
        })
        .where(and(eq(priceTiers.id, tierId), sql`${priceTiers.heldQty} >= ${quantity}`))
        .returning();

      return row ?? null;
    });
  }

  remainingInventory(eventId: string, exec: Executor = this.db): Promise<number> {
    return timedQuery('remaining_event_inventory', async () => {
      const [row] = await exec
        .select({
          remaining: sql<number>`coalesce(sum(${priceTiers.availableQty} + ${priceTiers.heldQty}), 0)`,
        })
        .from(priceTiers)
        .where(eq(priceTiers.eventId, eventId));

      return Number(row?.remaining ?? 0);
    });
  }

  updateById(id: string, values: Partial<NewPriceTierRow>): Promise<PriceTierRow | null> {
    return timedQuery('update_price_tier', async () => {
      const [row] = await this.db
        .update(priceTiers)
        .set(values)
        .where(eq(priceTiers.id, id))
        .returning();

      return row ?? null;
    });
  }

  deleteById(id: string): Promise<boolean> {
    return timedQuery('delete_price_tier', async () => {
      const rows = await this.db
        .delete(priceTiers)
        .where(eq(priceTiers.id, id))
        .returning({ id: priceTiers.id });

      return rows.length > 0;
    });
  }
}
