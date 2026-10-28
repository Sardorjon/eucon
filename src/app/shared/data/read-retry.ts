import { MonoTypeOperatorFunction, retry, throwError, timer } from 'rxjs';
import { AppError } from './app-error';

/** Retries idempotent reads on transient (5xx / network) errors with exponential backoff. */
export function withReadRetry<T>(count = 2, baseDelayMs = 300): MonoTypeOperatorFunction<T> {
  return retry({
    count,
    delay: (error: unknown, attempt) =>
      error instanceof AppError && error.status < 500
        ? throwError(() => error)
        : timer(baseDelayMs * 2 ** (attempt - 1)),
  });
}
