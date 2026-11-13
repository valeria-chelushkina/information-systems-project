import type { EventRow, EventStatus } from '@/services/ticketing/typedefs/event.typedefs.js';
import type { PriceTierRow } from '@/services/ticketing/typedefs/tier.typedefs.js';

export const PUBLIC_EVENT_STATUSES: readonly EventStatus[] = [
  'scheduled',
  'on_sale',
  'sold_out',
];

export interface PublicEventDto {
  id: string;
  title: string;
  performerId: string;
  performerName: string;
  venueId: string;
  venueName: string;
  startsAt: string;
  doorsAt: string | null;
  durationMinutes: number | null;
  status: EventStatus;
}

export interface PublicTierDto {
  id: string;
  name: string;
  priceCents: number;
  availableQty: number;
  totalQty: number;
}

export interface PublicEventDetail {
  event: PublicEventDto;
  tiers: PublicTierDto[];
}

export function toPublicEvent(row: EventRow): PublicEventDto {
  return {
    id: row.id,
    title: row.title,
    performerId: row.performerId,
    performerName: row.performerName,
    venueId: row.venueId,
    venueName: row.venueName,
    startsAt: row.startsAt.toISOString(),
    doorsAt: row.doorsAt === null ? null : row.doorsAt.toISOString(),
    durationMinutes: row.durationMinutes,
    status: row.status as EventStatus,
  };
}

export function toPublicTier(row: PriceTierRow): PublicTierDto {
  return {
    id: row.id,
    name: row.name,
    priceCents: row.priceCents,
    availableQty: row.availableQty,
    totalQty: row.totalQty,
  };
}
