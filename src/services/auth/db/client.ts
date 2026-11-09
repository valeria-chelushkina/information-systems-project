import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { optionalEnv } from '@/shared/config/env.js';

const databasePath = optionalEnv('AUTH_DB_PATH', './data/auth.db');

mkdirSync(dirname(databasePath), { recursive: true });

export const authDb = new DatabaseSync(databasePath);

authDb.exec('PRAGMA journal_mode = WAL;');
authDb.exec('PRAGMA busy_timeout = 5000;');
authDb.exec('PRAGMA foreign_keys = ON;');
