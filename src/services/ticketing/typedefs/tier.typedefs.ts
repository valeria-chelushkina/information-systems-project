import type { priceTiers } from '@/services/ticketing/db/schema/index.js';

export type PriceTierRow = typeof priceTiers.$inferSelect;
export type NewPriceTierRow = typeof priceTiers.$inferInsert;
