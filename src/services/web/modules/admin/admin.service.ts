import { AuthClient } from '@/services/web/clients/auth.client.js';
import { CatalogClient } from '@/services/web/clients/catalog.client.js';
import { probe } from '@/services/web/clients/http.client.js';
import { TicketingClient } from '@/services/web/clients/ticketing.client.js';
import { webConfig } from '@/services/web/config.js';
import { PagesService } from '@/services/web/modules/pages/pages.service.js';
import type {
  AdminUserDto,
  BookingDto,
  EventDto,
  EventStatus,
  PerformerDto,
  SessionUser,
  TierDto,
  UserRole,
  VenueDto,
} from '@/services/web/typedefs/api.typedefs.js';
import { HttpError } from '@/shared/errors/http-error.js';

const ALLOWED_TRANSITIONS: Record<EventStatus, readonly EventStatus[]> = {
  draft: ['scheduled', 'cancelled'],
  scheduled: ['on_sale', 'cancelled'],
  on_sale: ['sold_out', 'cancelled'],
  sold_out: ['completed', 'cancelled', 'on_sale'],
  completed: [],
  cancelled: [],
};

export interface CreateEventInput {
  title: string;
  performerId: string;
  venueId: string;
  startsAt: Date;
  doorsAt?: Date;
  durationMinutes?: number;
  status: 'draft' | 'scheduled';
}

export interface CreateTierInput {
  name: string;
  priceCents: number;
  totalQty: number;
}

export interface UpdateTierInput {
  name: string;
  priceCents: number;
  totalQty: number;
}

export interface CreatePerformerInput {
  name: string;
  genre?: string;
  contactEmail?: string;
}

export interface CreateVenueInput {
  name: string;
  city: string;
  timezone: string;
  capacity: number;
}

export interface CreateAccountInput {
  email: string;
  password: string;
  role: UserRole;
}

export interface DashboardCounts {
  events: number;
  onSale: number;
  bookings: number;
  performers: number;
  venues: number;
  users: number;
}

export interface DashboardResult {
  counts: DashboardCounts;
  recentEvents: EventDto[];
  health: { auth: boolean; ticketing: boolean; catalog: boolean };
}

export interface BookingsResult {
  bookings: BookingDto[];
  performerNames: Record<string, string>;
  venueNames: Record<string, string>;
  total: number;
  limit: number;
  offset: number;
}

export interface AdminEventFilters {
  status?: string;
  search?: string;
  performerId?: string;
  from?: string;
  to?: string;
  limit: number;
  offset: number;
}

export class AdminService {
  protected readonly ticketing = new TicketingClient();
  protected readonly catalog = new CatalogClient();
  protected readonly auth = new AuthClient();
  protected readonly pages = new PagesService();

  async dashboard(token: string): Promise<DashboardResult> {
    const [events, onSale, bookings, performers, venues, users, authOk, ticketingOk, catalogOk] =
      await Promise.all([
        this.ticketing.listEvents(token, { limit: 100 }).catch(() => null),
        this.ticketing.listEvents(token, { status: 'on_sale', limit: 1 }).catch(() => null),
        this.catalog.listBookings(token, { status: 'requested', limit: 1 }).catch(() => null),
        this.catalog.listPerformers(token, 1).catch(() => null),
        this.catalog.listVenues(token, 1).catch(() => null),
        this.auth.listUsers(token, 1, 0).catch(() => null),
        probe(webConfig.authBaseUrl),
        probe(webConfig.ticketingBaseUrl),
        probe(webConfig.catalogBaseUrl),
      ]);

    const recentEvents = [...(events?.items ?? [])]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 5);

    return {
      counts: {
        events: events?.total ?? 0,
        onSale: onSale?.total ?? 0,
        bookings: bookings?.total ?? 0,
        performers: performers?.total ?? 0,
        venues: venues?.total ?? 0,
        users: users?.total ?? 0,
      },
      recentEvents,
      health: { auth: authOk, ticketing: ticketingOk, catalog: catalogOk },
    };
  }

  listEvents(token: string, filters: AdminEventFilters) {
    return this.ticketing.listEvents(token, {
      status: filters.status as EventStatus | undefined,
      search: filters.search,
      performerId: filters.performerId,
      from: filters.from,
      to: filters.to,
      limit: filters.limit,
      offset: filters.offset,
    });
  }

  getEvent(token: string, id: string): Promise<EventDto> {
    return this.ticketing.getEvent(token, id);
  }

  transitionsFor(event: EventDto): EventStatus[] {
    return [...ALLOWED_TRANSITIONS[event.status]];
  }

  createEvent(token: string, input: CreateEventInput): Promise<EventDto> {
    return this.ticketing.createEvent(token, {
      title: input.title,
      performerId: input.performerId,
      venueId: input.venueId,
      startsAt: input.startsAt.toISOString(),
      ...(input.doorsAt ? { doorsAt: input.doorsAt.toISOString() } : {}),
      ...(input.durationMinutes ? { durationMinutes: input.durationMinutes } : {}),
      status: input.status,
    });
  }

  updateStatus(token: string, id: string, status: string): Promise<EventDto> {
    if (!(status in ALLOWED_TRANSITIONS)) {
      throw HttpError.badRequest('validation_failed', 'Unknown status');
    }

    return this.ticketing.updateEvent(token, id, { status: status as EventStatus });
  }

  deleteEvent(token: string, id: string): Promise<void> {
    return this.ticketing.deleteEvent(token, id);
  }

  listTiers(token: string, eventId: string): Promise<TierDto[]> {
    return this.ticketing.listTiers(token, eventId);
  }

  createTier(token: string, eventId: string, input: CreateTierInput): Promise<TierDto> {
    return this.ticketing.createTier(token, eventId, input);
  }

  updateTier(token: string, tierId: string, input: UpdateTierInput): Promise<TierDto> {
    return this.ticketing.updateTier(token, tierId, input);
  }

  deleteTier(token: string, tierId: string): Promise<void> {
    return this.ticketing.deleteTier(token, tierId);
  }

  async listPerformers(token: string, limit: number, offset: number) {
    return this.catalog.listPerformers(token, limit, offset);
  }

  createPerformer(token: string, input: CreatePerformerInput): Promise<PerformerDto> {
    return this.catalog.createPerformer(token, input);
  }

  async listVenues(token: string, limit: number, offset: number) {
    return this.catalog.listVenues(token, limit, offset);
  }

  createVenue(token: string, input: CreateVenueInput): Promise<VenueDto> {
    return this.catalog.createVenue(token, input);
  }

  async listBookings(
    token: string,
    status?: string,
    limit = 20,
    offset = 0,
  ): Promise<BookingsResult> {
    const [page, performers, venues] = await Promise.all([
      this.catalog.listBookings(token, {
        status: status as BookingDto['status'] | undefined,
        limit,
        offset,
      }),
      this.catalog.listPerformers(token, 100).catch(() => ({ items: [] as PerformerDto[] })),
      this.catalog.listVenues(token, 100).catch(() => ({ items: [] as VenueDto[] })),
    ]);

    return {
      bookings: page.items,
      performerNames: Object.fromEntries(
        performers.items.map((performer) => [performer.id, performer.name]),
      ),
      venueNames: Object.fromEntries(venues.items.map((venue) => [venue.id, venue.name])),
      total: page.total,
      limit: page.limit,
      offset: page.offset,
    };
  }

  decideBooking(
    token: string,
    id: string,
    status: string,
    actor: SessionUser,
  ): Promise<BookingDto> {
    if (status !== 'confirmed' && status !== 'rejected') {
      throw HttpError.badRequest('validation_failed', 'Unknown booking status');
    }

    return this.catalog.decideBooking(token, id, status, actor.userId);
  }

  order(user: SessionUser, token: string, id: string) {
    return this.pages.order(user, token, id);
  }

  refund(user: SessionUser, token: string, id: string) {
    return this.pages.refund(user, token, id);
  }

  listUsers(token: string, limit: number, offset: number) {
    return this.auth.listUsers(token, limit, offset);
  }

  createUser(token: string, input: CreateAccountInput): Promise<AdminUserDto> {
    return this.auth.createUser(token, input);
  }
}
