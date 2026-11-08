import type { Request, Response } from 'express';
import { VenuesService } from '@/services/catalog/modules/venues/venues.service.js';
import {
  createVenueSchema,
  listVenuesQuerySchema,
  venueIdParamsSchema,
} from '@/services/catalog/modules/venues/venues.schemas.js';
import { asyncHandler } from '@/shared/http/async-handler.js';
import { validate } from '@/shared/http/validate.js';

export class VenuesController {
  protected readonly service = new VenuesService();

  create = asyncHandler(async (req: Request, res: Response) => {
    const body = validate(createVenueSchema, req.body);
    const venue = await this.service.createVenue(body);

    res.status(201).location(`/api/venues/${venue.id}`).json({ data: venue });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const query = validate(listVenuesQuerySchema, req.query);
    const page = await this.service.listVenues(query);

    res.status(200).json({
      data: page.items,
      meta: { total: page.total, limit: page.limit, offset: page.offset },
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = validate(venueIdParamsSchema, req.params);
    const venue = await this.service.getVenueById(id);

    res.status(200).json({ data: venue });
  });
}
