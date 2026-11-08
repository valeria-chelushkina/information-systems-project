import { asc, eq } from 'drizzle-orm';
import { db as database, type Database } from '@/db/client.js';
import { priceTiers } from '@/db/schema/index.js';
import { timedQuery } from '@/db/timed-query.js';
import type { NewPriceTierRow, PriceTierRow } from '@/typedefs/tier.typedefs.js';

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

  findById(id: string): Promise<PriceTierRow | null> {
    return timedQuery('find_price_tier_by_id', async () => {
      const [row] = await this.db.select().from(priceTiers).where(eq(priceTiers.id, id));
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
