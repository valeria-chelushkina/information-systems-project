import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { notifyConfig } from '@/services/notify/config.js';
import { createSchema } from '@/services/notify/db/schema.js';

mkdirSync(dirname(notifyConfig.notifyDbPath), { recursive: true });

export const notifyDb = new DatabaseSync(notifyConfig.notifyDbPath);

notifyDb.exec('PRAGMA journal_mode = WAL;');
notifyDb.exec('PRAGMA busy_timeout = 5000;');

createSchema(notifyDb);
