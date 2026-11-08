import type { Request, Response } from 'express';
import { PerformersService } from '@/services/catalog/modules/performers/performers.service.js';
import {
  createPerformerSchema,
  listPerformersQuerySchema,
  performerIdParamsSchema,
} from '@/services/catalog/modules/performers/performers.schemas.js';
import { asyncHandler } from '@/shared/http/async-handler.js';
import { validate } from '@/shared/http/validate.js';

export class PerformersController {
  protected readonly service = new PerformersService();

  create = asyncHandler(async (req: Request, res: Response) => {
    const body = validate(createPerformerSchema, req.body);
    const performer = await this.service.createPerformer(body);

    res.status(201).location(`/api/performers/${performer.id}`).json({ data: performer });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const query = validate(listPerformersQuerySchema, req.query);
    const page = await this.service.listPerformers(query);

    res.status(200).json({
      data: page.items,
      meta: { total: page.total, limit: page.limit, offset: page.offset },
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = validate(performerIdParamsSchema, req.params);
    const performer = await this.service.getPerformerById(id);

    res.status(200).json({ data: performer });
  });
}
