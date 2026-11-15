export type BookingStatus = 'requested' | 'confirmed' | 'rejected' | 'cancelled';

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
