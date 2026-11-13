import type { Request, Response } from 'express';
import { ok } from '@/services/web/api/respond.js';
import { idParamsSchema, publicEventsQuerySchema } from '@/services/web/api/schemas.js';
import { PagesService } from '@/services/web/modules/pages/pages.service.js';
import { endOfKyivDay, startOfKyivDay } from '@/services/web/lib/time.js';
import { asyncHandler } from '@/shared/http/async-handler.js';
import { validate } from '@/shared/http/validate.js';
import { HttpError } from '@/shared/errors/http-error.js';

export class PublicController {
  protected readonly service = new PagesService();

  events = asyncHandler(async (req: Request, res: Response) => {
    const query = validate(publicEventsQuerySchema, req.query);
    const from = query.from ? startOfKyivDay(query.from) : null;
    const to = query.to ? endOfKyivDay(query.to) : null;

    if ((query.from && !from) || (query.to && !to)) {
      throw HttpError.badRequest('validation_failed', 'Invalid date filter');
    }

    const page = await this.service.listPublic({
      limit: query.limit,
      offset: query.offset,
      search: query.search,
      performerId: query.performerId,
      from: from?.toISOString(),
      to: to?.toISOString(),
    });

    ok(res, page);
  });

  event = asyncHandler(async (req: Request, res: Response) => {
    const { id } = validate(idParamsSchema, req.params);
    const detail = await this.service.eventDetail(id);

    ok(res, detail);
  });

  performers = asyncHandler(async (_req: Request, res: Response) => {
    const page = await this.service.listPublicPerformers();

    ok(res, page);
  });
}
