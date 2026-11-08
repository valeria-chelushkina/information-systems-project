import { dbQueryDuration, dbQueryErrorsTotal } from '@/shared/observability/metrics.js';

export async function timedQuery<T>(name: string, run: () => Promise<T>): Promise<T> {
  const end = dbQueryDuration.startTimer({ query_name: name });

  try {
    const result = await run();
    end({ status: 'ok' });
    return result;
  } catch (error) {
    end({ status: 'error' });
    dbQueryErrorsTotal.inc({ query_name: name });
    throw error;
  }
}
