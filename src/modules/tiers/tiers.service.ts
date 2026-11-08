import type { EventsService } from '@/modules/events/events.service.js';
import type { TiersRepository } from '@/modules/tiers/tiers.repository.js';
import type { CreateTierInput, UpdateTierInput } from '@/modules/tiers/tiers.schemas.js';
import { HttpError } from '@/shared/errors/http-error.js';
import type { NewPriceTierRow, PriceTierRow } from '@/typedefs/tier.typedefs.js';

export class TiersService {
  constructor(
    private readonly repository: TiersRepository,
    private readonly eventsService: EventsService,
  ) {}

  async createTier(eventId: string, input: CreateTierInput): Promise<PriceTierRow> {
    await this.eventsService.getEventById(eventId);

    return this.repository.insertOne({
      eventId,
      name: input.name,
      priceCents: input.priceCents,
      totalQty: input.totalQty,
      availableQty: input.totalQty,
      soldQty: 0,
      heldQty: 0,
    });
  }

  async listTiers(eventId: string): Promise<PriceTierRow[]> {
    await this.eventsService.getEventById(eventId);
    return this.repository.findByEventId(eventId);
  }

  async updateTier(tierId: string, input: UpdateTierInput): Promise<PriceTierRow> {
    const tier = await this.repository.findById(tierId);

    if (!tier) {
      throw HttpError.notFound('price_tier_not_found', `Price tier ${tierId} was not found`);
    }

    const changes: Partial<NewPriceTierRow> = {};

    if (input.name !== undefined) changes.name = input.name;
    if (input.priceCents !== undefined) changes.priceCents = input.priceCents;

    if (input.totalQty !== undefined && input.totalQty !== tier.totalQty) {
      const nextAvailable = tier.availableQty + (input.totalQty - tier.totalQty);

      if (nextAvailable < 0) {
        throw HttpError.conflict(
          'insufficient_inventory',
          'Cannot reduce total quantity below the number of sold and held seats',
        );
      }

      changes.totalQty = input.totalQty;
      changes.availableQty = nextAvailable;
    }

    if (Object.keys(changes).length === 0) {
      return tier;
    }

    const updated = await this.repository.updateById(tierId, changes);

    if (!updated) {
      throw HttpError.notFound('price_tier_not_found', `Price tier ${tierId} was not found`);
    }

    return updated;
  }

  async deleteTier(tierId: string): Promise<void> {
    const tier = await this.repository.findById(tierId);

    if (!tier) {
      throw HttpError.notFound('price_tier_not_found', `Price tier ${tierId} was not found`);
    }

    if (tier.soldQty > 0 || tier.heldQty > 0) {
      throw HttpError.conflict(
        'price_tier_in_use',
        'Cannot delete a price tier that has sold or held seats',
      );
    }

    await this.repository.deleteById(tierId);
  }
}
