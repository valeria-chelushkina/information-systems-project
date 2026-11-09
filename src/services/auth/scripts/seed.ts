import { randomUUID } from 'node:crypto';
import { authDb } from '@/services/auth/db/client.js';
import { createSchema } from '@/services/auth/db/schema.js';
import { UsersRepository } from '@/services/auth/modules/users.repository.js';
import { hashPassword } from '@/services/auth/security/password.js';
import { logger } from '@/shared/observability/logger.js';
import type { UserRole } from '@/services/auth/typedefs/user.typedefs.js';

const USERS: { email: string; password: string; role: UserRole }[] = [
  { email: 'admin@example.com', password: 'admin-password', role: 'admin' },
  { email: 'staff@example.com', password: 'staff-password', role: 'staff' },
  { email: 'customer@example.com', password: 'customer-password', role: 'customer' },
];

function main(): void {
  createSchema(authDb);

  const reset = process.argv.includes('--reset');

  if (reset) {
    authDb.exec('DELETE FROM login_attempts; DELETE FROM sessions; DELETE FROM users;');
    logger.info('cleared auth tables');
  }

  const users = new UsersRepository();
  let created = 0;

  for (const user of USERS) {
    if (users.findByEmail(user.email)) {
      continue;
    }

    users.insertOne({
      id: randomUUID(),
      email: user.email,
      passwordHash: hashPassword(user.password),
      role: user.role,
      isActive: 1,
      createdAt: new Date().toISOString(),
    });

    created += 1;
  }

  logger.info({ created, total: USERS.length }, 'auth seed complete');
  authDb.close();
}

main();
