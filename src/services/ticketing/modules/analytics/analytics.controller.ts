import type { Request, Response } from 'express';
import { AnalyticsService } from '@/services/ticketing/modules/analytics/analytics.service.js';
import { reportQuerySchema } from '@/services/ticketing/modules/analytics/analytics.schemas.js';
import { asyncHandler } from '@/shared/http/async-handler.js';
import { validate } from '@/shared/http/validate.js';
import { HttpError } from '@/shared/errors/http-error.js';

export class AnalyticsController {
  protected readonly service = new AnalyticsService();

  report = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user;

    if (!user) {
      throw new HttpError(401, 'missing_token', 'Authorization header is required');
    }

    if (user.role !== 'admin' && user.role !== 'staff') {
      throw new HttpError(403, 'forbidden', 'Only staff can read reports');
    }

    const query = validate(reportQuerySchema, req.query);
    const result = await this.service.report(query.from, query.to);

    res.status(200).json({ data: result });
  });
}
