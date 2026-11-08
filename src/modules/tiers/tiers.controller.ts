import type { Request, Response } from 'express';
import { TiersService } from '@/modules/tiers/tiers.service.js';
import {
  createTierSchema,
  eventIdParamsSchema,
  tierIdParamsSchema,
  updateTierSchema,
} from '@/modules/tiers/tiers.schemas.js';
import { asyncHandler } from '@/shared/http/async-handler.js';
import { validate } from '@/shared/http/validate.js';

export class TiersController {
  protected readonly service = new TiersService();

  create = asyncHandler(async (req: Request, res: Response) => {
    const { eventId } = validate(eventIdParamsSchema, req.params);
    const body = validate(createTierSchema, req.body);
    const tier = await this.service.createTier(eventId, body);

    res.status(201).location(`/api/tiers/${tier.id}`).json({ data: tier });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const { eventId } = validate(eventIdParamsSchema, req.params);
    const data = await this.service.listTiers(eventId);

    res.status(200).json({ data });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const { tierId } = validate(tierIdParamsSchema, req.params);
    const body = validate(updateTierSchema, req.body);
    const tier = await this.service.updateTier(tierId, body);

    res.status(200).json({ data: tier });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    const { tierId } = validate(tierIdParamsSchema, req.params);
    await this.service.deleteTier(tierId);

    res.status(204).send();
  });
}
