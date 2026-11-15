export type UserRole = 'customer' | 'staff' | 'admin';

export type EventStatus =
  | 'draft'
  | 'scheduled'
  | 'on_sale'
  | 'sold_out'
  | 'completed'
  | 'cancelled';

export type BookingStatus = 'requested' | 'confirmed' | 'rejected' | 'cancelled';

export type OrderStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded';

export type TicketStatus = 'issued' | 'checked_in' | 'refunded' | 'void';

export interface SessionUser {
  userId: string;
  email: string;
  role: UserRole;
}

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

export interface Booking {
  id: string;
  performerId: string;
  venueId: string;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  requestedBy: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  note: string | null;
  createdAt: string;
}

export interface OrderRecord {
  id: string;
  customerRef: string;
  customerEmail: string;
  holdId: string;
  status: OrderStatus;
  totalCents: number;
  idempotencyKey: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  orderId: string;
  eventId: string;
  tierId: string;
  customerRef: string;
  unitPriceCents: number;
  status: TicketStatus;
  issuedAt: string;
}

export interface OrderDetail {
  order: OrderRecord;
  tickets: Ticket[];
  event: EventRecord | null;
  tierNames: Record<string, string>;
  canRefund: boolean;
}

export interface CustomerOrderEvent {
  id: string;
  title: string;
  performerName: string;
  venueName: string;
  startsAt: string;
  status: string;
}

export interface CustomerOrder {
  order: OrderRecord;
  tickets: Ticket[];
  event: CustomerOrderEvent | null;
}

export interface PerformerOption {
  id: string;
  name: string;
}

export interface AdminUser {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface PublicEventsPage {
  items: PublicEventCard[];
  total: number;
  limit: number;
  offset: number;
}

export interface Dashboard {
  counts: {
    events: number;
    onSale: number;
    bookings: number;
    performers: number;
    venues: number;
    users: number;
  };
  recentEvents: EventRecord[];
  health: { auth: boolean; ticketing: boolean; catalog: boolean };
}

export interface EventsPage {
  items: EventRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface EventDetail {
  event: EventRecord;
  tiers: Tier[];
  transitions: EventStatus[];
}

export interface BookingsPage {
  bookings: Booking[];
  performerNames: Record<string, string>;
  venueNames: Record<string, string>;
  total: number;
  limit: number;
  offset: number;
}

export interface Paged<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface SessionResponse {
  user: SessionUser | null;
}
