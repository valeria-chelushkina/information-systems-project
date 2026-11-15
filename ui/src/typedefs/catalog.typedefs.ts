import type { Paged } from '@/typedefs/common.typedefs';

export type EventStatus =
  | 'draft'
  | 'scheduled'
  | 'on_sale'
  | 'sold_out'
  | 'completed'
  | 'cancelled';

export interface PublicEvent {
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

export interface PublicEventCard extends PublicEvent {
  minPriceCents: number | null;
}

export interface PublicTier {
  id: string;
  name: string;
  priceCents: number;
  availableQty: number;
  totalQty: number;
}

export interface PublicEventDetail {
  event: PublicEvent;
  tiers: PublicTier[];
}

export interface EventRecord {
  id: string;
  title: string;
  performerId: string;
  performerName: string;
  venueId: string;
  venueName: string;
  startsAt: string;
  doorsAt: string | null;
  durationMinutes: number | null;
  onSaleAt: string | null;
  status: EventStatus;
  createdAt: string;
}

export interface Tier {
  id: string;
  eventId: string;
  name: string;
  priceCents: number;
  totalQty: number;
  availableQty: number;
  soldQty: number;
  heldQty: number;
}

export interface Performer {
  id: string;
  name: string;
  genre: string | null;
  contactEmail: string | null;
  createdAt: string;
}

export interface Venue {
  id: string;
  name: string;
  city: string;
  timezone: string;
  capacity: number;
  createdAt: string;
}

export interface PerformerOption {
  id: string;
  name: string;
}

export type PublicEventsPage = Paged<PublicEventCard>;
