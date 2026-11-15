import type { Request, Response } from 'express';
import { PerformersService } from '@/services/catalog/modules/performers/performers.service.js';
import { performerIdParamsSchema } from '@/services/catalog/modules/performers/performers.schemas.js';
import { publicPerformersQuerySchema } from '@/services/catalog/modules/public/public.schemas.js';
import { asyncHandler } from '@/shared/http/async-handler.js';
import { validate } from '@/shared/http/validate.js';

export class PublicCatalogController {
  protected readonly performers = new PerformersService();

  listPerformers = asyncHandler(async (req: Request, res: Response) => {
    const query = validate(publicPerformersQuerySchema, req.query);
    const page = await this.performers.listPerformers(query);

    res.status(200).json({
      data: page.items.map((performer) => ({ id: performer.id, name: performer.name })),
      meta: { total: page.total, limit: page.limit, offset: page.offset },
    });
  });

  getPerformer = asyncHandler(async (req: Request, res: Response) => {
    const { id } = validate(performerIdParamsSchema, req.params);
    const performer = await this.performers.getPerformerById(id);

    res.status(200).json({
      data: {
        id: performer.id,
        name: performer.name,
        genre: performer.genre,
        bio: performer.bio,
      },
    });
  });
}
