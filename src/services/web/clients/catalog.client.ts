import { call, callPage, type Page } from '@/services/web/clients/http.client.js';
import { webConfig } from '@/services/web/config.js';
import type {
  BookingDto,
  BookingStatus,
  PerformerDto,
  PerformerOption,
  VenueDto,
} from '@/services/web/typedefs/api.typedefs.js';

export interface CreatePerformerPayload {
  name: string;
  genre?: string;
  contactEmail?: string;
}

export interface CreateVenuePayload {
  name: string;
  city: string;
  timezone?: string;
  capacity: number;
}

export interface BookingQuery {
  status?: BookingStatus;
  limit?: number;
  offset?: number;
}

export class CatalogClient {
  listPerformers(token: string, limit = 100, offset = 0): Promise<Page<PerformerDto>> {
    return callPage<PerformerDto>(webConfig.catalogBaseUrl, '/api/performers', {
      token,
      query: { limit, offset },
    });
  }

  createPerformer(token: string, payload: CreatePerformerPayload): Promise<PerformerDto> {
    return call<PerformerDto>(webConfig.catalogBaseUrl, '/api/performers', {
      method: 'POST',
      token,
      body: payload,
    });
  }

  listVenues(token: string, limit = 100, offset = 0): Promise<Page<VenueDto>> {
    return callPage<VenueDto>(webConfig.catalogBaseUrl, '/api/venues', {
      token,
      query: { limit, offset },
    });
  }

  listPublicPerformers(limit = 100, offset = 0): Promise<Page<PerformerOption>> {
    return callPage<PerformerOption>(webConfig.catalogBaseUrl, '/public/performers', {
      query: { limit, offset },
    });
  }

  createVenue(token: string, payload: CreateVenuePayload): Promise<VenueDto> {
    return call<VenueDto>(webConfig.catalogBaseUrl, '/api/venues', {
      method: 'POST',
      token,
      body: payload,
    });
  }

  listBookings(token: string, query: BookingQuery = {}): Promise<Page<BookingDto>> {
    return callPage<BookingDto>(webConfig.catalogBaseUrl, '/api/bookings', {
      token,
      query: { status: query.status, limit: query.limit, offset: query.offset },
    });
  }

  decideBooking(
    token: string,
    id: string,
    status: 'confirmed' | 'rejected',
    decidedBy?: string,
  ): Promise<BookingDto> {
    return call<BookingDto>(webConfig.catalogBaseUrl, `/api/bookings/${id}`, {
      method: 'PATCH',
      token,
      body: { status, decidedBy },
    });
  }
}
