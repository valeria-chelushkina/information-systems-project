import { db } from '@/db/client.js';
import { timedQuery } from '@/db/timed-query.js';
import { Transaction } from '@/typedefs/database.typedefs.js';

export function transaction<T>(name: string, run: (tx: Transaction) => Promise<T>): Promise<T> {
  return timedQuery(name, () => db.transaction(run));
}
