import { optionalEnv } from '@/shared/config/env.js';
import { HttpError } from '@/shared/errors/http-error.js';

interface CatalogPerformer {
  id: string;
  name: string;
}

interface CatalogVenue {
  id: string;
  name: string;
}

interface ApiEnvelope<T> {
  data: T;
}

export class CatalogClient {
  protected readonly baseUrl = optionalEnv('CATALOG_BASE_URL', 'http://127.0.0.1:3003');
  protected readonly timeoutMs = Number(optionalEnv('CATALOG_TIMEOUT_MS', '3000'));

  getPerformer(id: string): Promise<CatalogPerformer> {
    return this.fetchOne<CatalogPerformer>(`/api/performers/${id}`, 'performer');
  }

  getVenue(id: string): Promise<CatalogVenue> {
    return this.fetchOne<CatalogVenue>(`/api/venues/${id}`, 'venue');
  }

  private async fetchOne<T>(path: string, resource: string): Promise<T> {
    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new HttpError(
        503,
        'catalog_unavailable',
        'Catalog service is unavailable, cannot resolve the reference',
      );
    }

    if (response.status === 404) {
      throw HttpError.badRequest(`unknown_${resource}`, `Catalog has no ${resource} with that id`);
    }

    if (!response.ok) {
      throw new HttpError(502, 'catalog_error', `Catalog responded with ${response.status}`);
    }

    const body = (await response.json()) as ApiEnvelope<T>;
    return body.data;
  }
}
