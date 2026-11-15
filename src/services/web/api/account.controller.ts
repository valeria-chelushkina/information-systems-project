import type { Request, Response } from 'express';
import { ok } from '@/services/web/api/respond.js';
import { accountOrdersQuerySchema, idParamsSchema, purchaseSchema } from '@/services/web/api/schemas.js';
import { PagesService } from '@/services/web/modules/pages/pages.service.js';
import { currentToken, currentUser } from '@/services/web/modules/session/session.middleware.js';
import { endOfKyivDay, startOfKyivDay } from '@/services/web/lib/time.js';
import { asyncHandler } from '@/shared/http/async-handler.js';
import { validate } from '@/shared/http/validate.js';
import { HttpError } from '@/shared/errors/http-error.js';

export class AccountController {
  protected readonly service = new PagesService();

  purchase = asyncHandler(async (req: Request, res: Response) => {
    const user = currentUser(res);
    const token = currentToken(res);
    const { id } = validate(idParamsSchema, req.params);
    const body = validate(purchaseSchema, req.body);
    const orderId = await this.service.purchase(user, token, id, body.tierId, body.quantity);

    ok(res, { orderId }, 201);
  });

  order = asyncHandler(async (req: Request, res: Response) => {
    const user = currentUser(res);
    const token = currentToken(res);
    const { id } = validate(idParamsSchema, req.params);
    const order = await this.service.order(user, token, id);

    ok(res, order);
  });

  orders = asyncHandler(async (req: Request, res: Response) => {
    const token = currentToken(res);
    const query = validate(accountOrdersQuerySchema, req.query);
    const from = query.from ? startOfKyivDay(query.from) : null;
    const to = query.to ? endOfKyivDay(query.to) : null;

    if ((query.from && !from) || (query.to && !to)) {
      throw HttpError.badRequest('validation_failed', 'Invalid date filter');
    }

    const page = await this.service.listOrders(token, {
      limit: query.limit,
      offset: query.offset,
      performerId: query.performerId,
      from: from?.toISOString(),
      to: to?.toISOString(),
    });

    ok(res, page);
  });

  orderPerformers = asyncHandler(async (_req: Request, res: Response) => {
    const token = currentToken(res);
    const performers = await this.service.listOrderPerformers(token);

    ok(res, performers);
  });

  refund = asyncHandler(async (req: Request, res: Response) => {
    const user = currentUser(res);
    const token = currentToken(res);
    const { id } = validate(idParamsSchema, req.params);
    const orderId = await this.service.refund(user, token, id);

    ok(res, { orderId });
  });
}
