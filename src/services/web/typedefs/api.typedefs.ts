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

export interface LoginResult {
  token: string;
  expiresAt: string;
  user: SessionUser;
}

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

export interface PublicEventCard extends PublicEventDto {
  minPriceCents: number | null;
}

export interface PublicTierDto {
  id: string;
  name: string;
  priceCents: number;
  availableQty: number;
  totalQty: number;
}

export interface EventDto {
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

export interface TierDto {
  id: string;
  eventId: string;
  name: string;
  priceCents: number;
  totalQty: number;
  availableQty: number;
  soldQty: number;
  heldQty: number;
}

export interface PerformerDto {
  id: string;
  name: string;
  genre: string | null;
  contactEmail: string | null;
  createdAt: string;
}

export interface VenueDto {
  id: string;
  name: string;
  city: string;
  timezone: string;
  capacity: number;
  createdAt: string;
}

export interface BookingDto {
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

export interface OrderDto {
  id: string;
  customerRef: string;
  customerEmail: string;
  holdId: string;
  status: OrderStatus;
  totalCents: number;
  idempotencyKey: string;
  createdAt: string;
}

export interface TicketDto {
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
  order: OrderDto;
  tickets: TicketDto[];
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
  order: OrderDto;
  tickets: TicketDto[];
  event: CustomerOrderEvent | null;
}

export interface AdminUserDto {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
