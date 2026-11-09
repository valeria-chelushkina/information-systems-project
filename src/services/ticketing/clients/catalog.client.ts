import { ticketingConfig } from '@/services/ticketing/config.js';
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
  protected readonly baseUrl = ticketingConfig.catalogBaseUrl;
  protected readonly timeoutMs = ticketingConfig.catalogTimeoutMs;

  getPerformer(id: string, token: string): Promise<CatalogPerformer> {
    return this.fetchOne<CatalogPerformer>(`/api/performers/${id}`, 'performer', token);
  }

  getVenue(id: string, token: string): Promise<CatalogVenue> {
    return this.fetchOne<CatalogVenue>(`/api/venues/${id}`, 'venue', token);
  }

  private async fetchOne<T>(path: string, resource: string, token: string): Promise<T> {
    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        headers: { authorization: `Bearer ${token}` },
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
