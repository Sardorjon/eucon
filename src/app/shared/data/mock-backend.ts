import { inject, Injectable, InjectionToken, isDevMode } from '@angular/core';
import { defer, map, Observable, timer } from 'rxjs';
import { AppError } from './app-error';

export interface MockBackendConfig {
  latencyMs: readonly [min: number, max: number];
  failureRate: number;
  random: () => number;
}

export const MOCK_BACKEND_CONFIG = new InjectionToken<MockBackendConfig>('MOCK_BACKEND_CONFIG', {
  providedIn: 'root',
  factory: () => ({ latencyMs: [100, 300], failureRate: 0.05, random: Math.random }),
});

/** Deterministic PRNG (mulberry32) for reproducible seed data. */
export function createSeededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Simulates network latency, random outages and serialization for in-memory "endpoints". */
@Injectable({ providedIn: 'root' })
export class MockBackend {
  private readonly config = inject(MOCK_BACKEND_CONFIG);

  respond<T>(label: string, handler: () => T): Observable<T> {
    return defer(() => {
      const [min, max] = this.config.latencyMs;
      const delay = Math.round(min + this.config.random() * (max - min));
      const failed = this.config.random() < this.config.failureRate;
      return timer(delay).pipe(
        map(() => {
          if (failed) throw new AppError('errors.unavailable', 503);
          const result = structuredClone(handler());
          if (isDevMode()) console.debug(`[mock] ${label} ${delay}ms`);
          return result;
        }),
      );
    });
  }
}
