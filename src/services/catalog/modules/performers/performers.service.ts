import { PerformersRepository } from '@/services/catalog/modules/performers/performers.repository.js';
import type {
  CreatePerformerInput,
  ListPerformersQuery,
} from '@/services/catalog/modules/performers/performers.schemas.js';
import type { PerformerRow } from '@/services/catalog/typedefs/performer.typedefs.js';
import { HttpError } from '@/shared/errors/http-error.js';

export class PerformersService {
  protected readonly repository = new PerformersRepository();

  async createPerformer(input: CreatePerformerInput): Promise<PerformerRow> {
    return this.repository.insertOne({
      name: input.name,
      genre: input.genre ?? null,
      contactEmail: input.contactEmail ?? null,
    });
  }

  async listPerformers(query: ListPerformersQuery): Promise<{
    items: PerformerRow[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const [items, total] = await Promise.all([
      this.repository.findMany(query.limit, query.offset),
      this.repository.count(),
    ]);

    return { items, total, limit: query.limit, offset: query.offset };
  }

  async getPerformerById(id: string): Promise<PerformerRow> {
    const performer = await this.repository.findById(id);

    if (!performer) {
      throw HttpError.notFound('performer_not_found', `Performer ${id} was not found`);
    }

    return performer;
  }
}
