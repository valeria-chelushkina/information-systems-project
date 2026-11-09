import { BookingsRepository } from '@/services/catalog/modules/bookings/bookings.repository.js';
import type {
  CreateBookingInput,
  DecideBookingInput,
  ListBookingsQuery,
} from '@/services/catalog/modules/bookings/bookings.schemas.js';
import { PerformersService } from '@/services/catalog/modules/performers/performers.service.js';
import { VenuesService } from '@/services/catalog/modules/venues/venues.service.js';
import type { BookingRow } from '@/services/catalog/typedefs/booking.typedefs.js';
import { bookingsTotal } from '@/services/catalog/observability/business-metrics.constants.js';
import { HttpError } from '@/shared/errors/http-error.js';
import { mapDatabaseError } from '@/shared/errors/database-error.js';

export class BookingsService {
  protected readonly repository = new BookingsRepository();
  protected readonly performers = new PerformersService();
  protected readonly venues = new VenuesService();

  async createBooking(input: CreateBookingInput): Promise<BookingRow> {
    await this.performers.getPerformerById(input.performerId);
    await this.venues.getVenueById(input.venueId);

    if (input.endsAt <= input.startsAt) {
      throw HttpError.badRequest('invalid_period', 'endsAt must be later than startsAt');
    }

    const booking = await this.repository.insertOne({
      performerId: input.performerId,
      venueId: input.venueId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      status: 'requested',
      requestedBy: input.requestedBy ?? null,
      note: input.note ?? null,
    });

    bookingsTotal.inc({ status: 'requested' });

    return booking;
  }

  async decideBooking(id: string, input: DecideBookingInput): Promise<BookingRow> {
    let decided: BookingRow | null;

    try {
      decided = await this.repository.decide(id, input.status, input.decidedBy ?? null);
    } catch (error) {
      const mapped = mapDatabaseError(error);
      bookingsTotal.inc({
        status: mapped?.code === 'booking_conflict' ? 'conflict' : 'failed',
      });
      throw error;
    }

    if (!decided) {
      const existing = await this.repository.findById(id);

      if (!existing) {
        throw HttpError.notFound('booking_not_found', `Booking ${id} was not found`);
      }

      bookingsTotal.inc({ status: 'failed' });

      throw HttpError.conflict(
        'booking_not_pending',
        `Booking ${id} is already ${existing.status}`,
      );
    }

    bookingsTotal.inc({ status: input.status });

    return decided;
  }

  async listBookings(query: ListBookingsQuery): Promise<{
    items: BookingRow[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const filters = {
      venueId: query.venueId,
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    };

    const [items, total] = await Promise.all([
      this.repository.findMany(filters),
      this.repository.count(filters),
    ]);

    return { items, total, limit: filters.limit, offset: filters.offset };
  }

  async getBookingById(id: string): Promise<BookingRow> {
    const booking = await this.repository.findById(id);

    if (!booking) {
      throw HttpError.notFound('booking_not_found', `Booking ${id} was not found`);
    }

    return booking;
  }
}
