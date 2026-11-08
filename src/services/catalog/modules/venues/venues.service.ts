import { VenuesRepository } from '@/services/catalog/modules/venues/venues.repository.js';
import type {
  CreateVenueInput,
  ListVenuesQuery,
} from '@/services/catalog/modules/venues/venues.schemas.js';
import type { VenueRow } from '@/services/catalog/typedefs/venue.typedefs.js';
import { HttpError } from '@/shared/errors/http-error.js';

export class VenuesService {
  protected readonly repository = new VenuesRepository();

  async createVenue(input: CreateVenueInput): Promise<VenueRow> {
    return this.repository.insertOne({
      name: input.name,
      city: input.city,
      timezone: input.timezone,
      capacity: input.capacity,
    });
  }

  async listVenues(query: ListVenuesQuery): Promise<{
    items: VenueRow[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const [items, total] = await Promise.all([
      this.repository.findMany(query.limit, query.offset),
      this.repository.count(),
    ]);

    return { items, total, limit: query.limit, offset: query.offset };
  }

  async getVenueById(id: string): Promise<VenueRow> {
    const venue = await this.repository.findById(id);

    if (!venue) {
      throw HttpError.notFound('venue_not_found', `Venue ${id} was not found`);
    }

    return venue;
  }
}
