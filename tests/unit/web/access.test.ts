import { describe, expect, it } from 'vitest';
import {
  accountCreateSchema,
  adminEventListQuerySchema,
  eventCreateSchema,
  purchaseSchema,
  publicEventsQuerySchema,
  registerSchema,
  tierCreateSchema,
} from '@/services/web/api/schemas.js';
import { canSeeOrder, isStaff } from '@/services/web/modules/session/session.helpers.js';
import type { SessionUser } from '@/services/web/typedefs/api.typedefs.js';

const admin: SessionUser = { userId: 'admin-id', email: 'admin@example.com', role: 'admin' };
const staff: SessionUser = { userId: 'staff-id', email: 'staff@example.com', role: 'staff' };
const customer: SessionUser = { userId: 'customer-id', email: 'customer@example.com', role: 'customer' };

describe('role checks', () => {
  it('treats admin and staff as staff', () => {
    expect(isStaff(admin)).toBe(true);
    expect(isStaff(staff)).toBe(true);
    expect(isStaff(customer)).toBe(false);
  });

  it('lets staff see any order and customers only their own', () => {
    expect(canSeeOrder(admin, 'customer-id')).toBe(true);
    expect(canSeeOrder(staff, 'customer-id')).toBe(true);
    expect(canSeeOrder(customer, 'customer-id')).toBe(true);
    expect(canSeeOrder(customer, 'another-id')).toBe(false);
  });
});

describe('request validation', () => {
  const performerId = '20671bab-ae90-4730-97fa-ee31520fa960';
  const venueId = '2f09e81b-c190-45c8-ad6a-a4617adad552';

  it('accepts a valid event payload', () => {
    const result = eventCreateSchema.safeParse({
      title: 'Neon Tour',
      performerId,
      venueId,
      startsAt: '2026-11-20T19:00',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBeUndefined();
    }
  });

  it('rejects invalid references and empty titles', () => {
    expect(
      eventCreateSchema.safeParse({ title: '   ', performerId, venueId, startsAt: '2026-11-20T19:00' })
        .success,
    ).toBe(false);
    expect(
      eventCreateSchema.safeParse({ title: 'Show', performerId: 'nope', venueId, startsAt: '2026-11-20T19:00' })
        .success,
    ).toBe(false);
  });

  it('enforces purchase and tier limits', () => {
    expect(purchaseSchema.safeParse({ tierId: 'a7b9d6c4-1f2e-4a6b-9c8d-0e1f2a3b4c5d', quantity: 2 }).success).toBe(true);
    expect(purchaseSchema.safeParse({ tierId: 'a7b9d6c4-1f2e-4a6b-9c8d-0e1f2a3b4c5d', quantity: 0 }).success).toBe(false);
    expect(tierCreateSchema.safeParse({ name: 'VIP', priceCents: 15000, totalQty: 10 }).success).toBe(true);
    expect(tierCreateSchema.safeParse({ name: 'VIP', priceCents: -1, totalQty: 10 }).success).toBe(false);
  });

  it('defaults new accounts to the customer role', () => {
    const result = accountCreateSchema.safeParse({ email: 'new@example.com', password: 'password-123' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe('customer');
    }
  });

  it('validates public registration input', () => {
    expect(registerSchema.safeParse({ email: 'new@example.com', password: 'password-123' }).success).toBe(true);
    expect(registerSchema.safeParse({ email: 'not-an-email', password: 'password-123' }).success).toBe(false);
    expect(registerSchema.safeParse({ email: 'new@example.com', password: 'short' }).success).toBe(false);
  });

  it('parses admin event filters and paging defaults', () => {
    const result = adminEventListQuerySchema.safeParse({
      search: 'After',
      from: '2026-11-17',
      to: '2026-11-18',
      limit: '5',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(5);
      expect(result.data.offset).toBe(0);
      expect(result.data.search).toBe('After');
    }

    expect(adminEventListQuerySchema.safeParse({ from: '17.11.2026' }).success).toBe(false);
  });

  it('parses public lineup filters', () => {
    const result = publicEventsQuerySchema.safeParse({
      search: 'After',
      performerId: 'c9f839f2-4d22-4750-b44b-b22be893138f',
      from: '2026-11-17',
      to: '2026-11-18',
      limit: '9',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(9);
      expect(result.data.search).toBe('After');
    }

    expect(publicEventsQuerySchema.safeParse({ to: '18.11.2026' }).success).toBe(false);
  });
});
