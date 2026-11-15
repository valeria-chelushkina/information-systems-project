import { PerformersRepository } from '@/services/catalog/modules/performers/performers.repository.js';
import type {
  CreatePerformerInput,
  ListPerformersQuery,
  UpdatePerformerInput,
} from '@/services/catalog/modules/performers/performers.schemas.js';
import type { PerformerRow } from '@/services/catalog/typedefs/performer.typedefs.js';
import { HttpError } from '@/shared/errors/http-error.js';

export class PerformersService {
  protected readonly repository = new PerformersRepository();

  async createPerformer(input: CreatePerformerInput): Promise<PerformerRow> {
    return this.repository.insertOne({
      name: input.name,
      genre: input.genre ?? null,
      bio: input.bio ?? null,
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
      this.repository.findMany(query.limit, query.offset, query.search),
      this.repository.count(query.search),
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

  async updatePerformer(id: string, input: UpdatePerformerInput): Promise<PerformerRow> {
    const updated = await this.repository.updateById(id, input);

    if (!updated) {
      throw HttpError.notFound('performer_not_found', `Performer ${id} was not found`);
    }

    return updated;
  }
}
