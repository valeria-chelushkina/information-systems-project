import type { Request, Response } from 'express';
import { ok } from '@/services/web/api/respond.js';
import { idParamsSchema, publicEventsQuerySchema } from '@/services/web/api/schemas.js';
import { PagesService } from '@/services/web/modules/pages/pages.service.js';
import { asyncHandler } from '@/shared/http/async-handler.js';
import { validate } from '@/shared/http/validate.js';

export class PublicController {
  protected readonly service = new PagesService();

  events = asyncHandler(async (req: Request, res: Response) => {
    const query = validate(publicEventsQuerySchema, req.query);
    const page = await this.service.listPublic(query.limit, query.offset);

    ok(res, page);
  });

  event = asyncHandler(async (req: Request, res: Response) => {
    const { id } = validate(idParamsSchema, req.params);
    const detail = await this.service.eventDetail(id);

    ok(res, detail);
  });
}
