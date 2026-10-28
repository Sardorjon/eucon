import { TestBed } from '@angular/core/testing';
import { firstValueFrom, Observable, throwError, of, defer } from 'rxjs';
import { AppError } from './app-error';
import { createSeededRandom, MOCK_BACKEND_CONFIG, MockBackend, MockBackendConfig } from './mock-backend';
import { withReadRetry } from './read-retry';

function setup(config: Partial<MockBackendConfig>): MockBackend {
  TestBed.configureTestingModule({
    providers: [{ provide: MOCK_BACKEND_CONFIG, useValue: { latencyMs: [0, 0], failureRate: 0, random: () => 0.5, ...config } }],
  });
  return TestBed.inject(MockBackend);
}

describe('createSeededRandom', () => {
  it('is reproducible and within [0, 1)', () => {
    const a = createSeededRandom(42);
    const b = createSeededRandom(42);
    const values = Array.from({ length: 100 }, () => a());
    expect(values).toEqual(Array.from({ length: 100 }, () => b()));
    expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
  });
});

describe('MockBackend', () => {
  afterEach(() => vi.useRealTimers());

  it('fails with a 503 AppError when failureRate is 1, without running the handler', async () => {
    const backend = setup({ failureRate: 1 });
    const handler = vi.fn(() => 1);
    const error = await firstValueFrom(backend.respond('x', handler)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).status).toBe(503);
    expect((error as AppError).messageKey).toBe('errors.unavailable');
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns a clone so callers cannot mutate backend state', async () => {
    const backend = setup({});
    const source = { a: { b: 1 } };
    const result = await firstValueFrom(backend.respond('x', () => source));
    result.a.b = 2;
    expect(source.a.b).toBe(1);
  });

  it('delays by the configured latency', () => {
    vi.useFakeTimers();
    const backend = setup({ latencyMs: [100, 300] });
    const next = vi.fn();
    backend.respond('x', () => 1).subscribe(next);
    vi.advanceTimersByTime(199);
    expect(next).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(next).toHaveBeenCalledWith(1);
  });

  it('propagates handler errors unchanged', async () => {
    const backend = setup({});
    const error = await firstValueFrom(
      backend.respond('x', () => {
        throw new AppError('errors.validation', 400);
      }),
    ).catch((e: unknown) => e);
    expect((error as AppError).status).toBe(400);
  });
});

describe('withReadRetry', () => {
  function failingTimes(times: number, error: unknown = new AppError('errors.unavailable')): Observable<string> {
    let calls = 0;
    return defer(() => (++calls <= times ? throwError(() => error) : of('ok')));
  }

  it('recovers from transient failures', async () => {
    await expect(firstValueFrom(failingTimes(2).pipe(withReadRetry(2, 1)))).resolves.toBe('ok');
  });

  it('gives up after the retry budget', async () => {
    await expect(firstValueFrom(failingTimes(3).pipe(withReadRetry(2, 1)))).rejects.toBeInstanceOf(AppError);
  });

  it('does not retry client errors', async () => {
    let calls = 0;
    const source = defer(() => {
      calls++;
      return throwError(() => new AppError('errors.validation', 400));
    });
    await expect(firstValueFrom(source.pipe(withReadRetry(2, 1)))).rejects.toBeInstanceOf(AppError);
    expect(calls).toBe(1);
  });
});
