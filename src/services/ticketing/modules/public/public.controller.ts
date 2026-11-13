import type { Request, Response } from 'express';
import {
  listPublicEventsQuerySchema,
  publicEventIdParamsSchema,
} from '@/services/ticketing/modules/public/public.schemas.js';
import { PublicEventsService } from '@/services/ticketing/modules/public/public.service.js';
import { asyncHandler } from '@/shared/http/async-handler.js';
import { validate } from '@/shared/http/validate.js';

export class PublicEventsController {
  protected readonly service = new PublicEventsService();

  list = asyncHandler(async (req: Request, res: Response) => {
    const query = validate(listPublicEventsQuerySchema, req.query);
    const page = await this.service.listEvents(query);

    res.status(200).json({
      data: page.items,
      meta: { total: page.total, limit: page.limit, offset: page.offset },
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = validate(publicEventIdParamsSchema, req.params);
    const detail = await this.service.getEventDetail(id);

    res.status(200).json({ data: detail });
  });

  listTiers = asyncHandler(async (req: Request, res: Response) => {
    const { id } = validate(publicEventIdParamsSchema, req.params);
    const tiers = await this.service.listTiers(id);

    res.status(200).json({ data: tiers });
  });
}
