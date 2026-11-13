import type { Request, Response } from 'express';
import { PurchasesService } from '@/services/ticketing/modules/purchases/purchases.service.js';
import {
  createHoldSchema,
  holdIdParamsSchema,
  listOrdersQuerySchema,
  orderIdParamsSchema,
  purchaseSchema,
  refundOrderSchema,
} from '@/services/ticketing/modules/purchases/purchases.schemas.js';
import { asyncHandler } from '@/shared/http/async-handler.js';
import { validate } from '@/shared/http/validate.js';
import { HttpError } from '@/shared/errors/http-error.js';

export class PurchasesController {
  protected readonly service = new PurchasesService();

  createHold = asyncHandler(async (req: Request, res: Response) => {
    const body = validate(createHoldSchema, req.body);
    const hold = await this.service.createHold(body);

    res.status(201).location(`/api/holds/${hold.id}`).json({ data: hold });
  });

  cancelHold = asyncHandler(async (req: Request, res: Response) => {
    const { id } = validate(holdIdParamsSchema, req.params);
    await this.service.cancelHold(id);

    res.status(204).send();
  });

  purchase = asyncHandler(async (req: Request, res: Response) => {
    const body = validate(purchaseSchema, req.body);
    const result = await this.service.purchase(body);

    res.status(result.created ? 201 : 200).json({
      data: { order: result.order, tickets: result.tickets },
    });
  });

  getOrder = asyncHandler(async (req: Request, res: Response) => {
    const { id } = validate(orderIdParamsSchema, req.params);
    const result = await this.service.getOrder(id);

    res.status(200).json({ data: { order: result.order, tickets: result.tickets } });
  });

  listOrders = asyncHandler(async (req: Request, res: Response) => {
    const query = validate(listOrdersQuerySchema, req.query);
    const user = req.user;

    if (!user) {
      throw new HttpError(401, 'missing_token', 'Authorization header is required');
    }

    const page = await this.service.listOrders(user.userId, query.limit, query.offset);

    res.status(200).json({
      data: page.items,
      meta: { total: page.total, limit: page.limit, offset: page.offset },
    });
  });

  refund = asyncHandler(async (req: Request, res: Response) => {
    const { id } = validate(orderIdParamsSchema, req.params);
    const body = validate(refundOrderSchema, req.body ?? {});
    const result = await this.service.refundOrder(id, body);

    res.status(200).json({ data: result });
  });
}
