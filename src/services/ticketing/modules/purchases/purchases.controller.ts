import type { Request, Response } from 'express';
import { PurchasesService } from '@/services/ticketing/modules/purchases/purchases.service.js';
import {
  createHoldSchema,
  holdIdParamsSchema,
  orderIdParamsSchema,
  purchaseSchema,
} from '@/services/ticketing/modules/purchases/purchases.schemas.js';
import { asyncHandler } from '@/shared/http/async-handler.js';
import { validate } from '@/shared/http/validate.js';

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
}
