import type { Request, Response } from 'express';
import { AlertsService } from '@/services/notify/modules/alerts/alerts.service.js';
import { notificationSchema } from '@/services/notify/modules/alerts/alerts.schemas.js';
import { asyncHandler } from '@/shared/http/async-handler.js';
import { validate } from '@/shared/http/validate.js';

export class AlertsController {
  protected readonly service = new AlertsService();

  handle = asyncHandler(async (req: Request, res: Response) => {
    const { alerts } = validate(notificationSchema, req.body);

    await this.service.handle(alerts);

    res.status(200).json({ status: 'ok', received: alerts.length });
  });
}
