import type { Request, Response } from 'express';
import { asyncHandler } from '@/shared/http/async-handler.js';
import { validate } from '@/shared/http/validate.js';
import { NotificationsService } from '@/services/notify/modules/notifications/notifications.service.js';
import { deliveryQuerySchema } from '@/services/notify/modules/notifications/notifications.schemas.js';

export class NotificationsController {
  protected readonly service = new NotificationsService();

  list = asyncHandler(async (req: Request, res: Response) => {
    const { limit, offset } = validate(deliveryQuerySchema, req.query);
    const page = this.service.list(limit, offset);

    res.status(200).json({
      data: page.items,
      meta: { total: page.total, limit: page.limit, offset: page.offset },
    });
  });

  summary = asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json({ data: this.service.summary() });
  });
}
