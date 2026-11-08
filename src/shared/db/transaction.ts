import { db } from '@/shared/db/client.js';
import { timedQuery } from '@/shared/db/timed-query.js';
import type { Transaction } from '@/shared/typedefs/database.typedefs.js';

export function transaction<T>(name: string, run: (tx: Transaction) => Promise<T>): Promise<T> {
  return timedQuery(name, () => db.transaction(run));
}
