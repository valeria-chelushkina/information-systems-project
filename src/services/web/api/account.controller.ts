import type { Request, Response } from 'express';
import { ok } from '@/services/web/api/respond.js';
import { idParamsSchema, purchaseSchema } from '@/services/web/api/schemas.js';
import { PagesService } from '@/services/web/modules/pages/pages.service.js';
import { currentToken, currentUser } from '@/services/web/modules/session/session.middleware.js';
import { asyncHandler } from '@/shared/http/async-handler.js';
import { validate } from '@/shared/http/validate.js';

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

  refund = asyncHandler(async (req: Request, res: Response) => {
    const user = currentUser(res);
    const token = currentToken(res);
    const { id } = validate(idParamsSchema, req.params);
    const orderId = await this.service.refund(user, token, id);

    ok(res, { orderId });
  });
}
