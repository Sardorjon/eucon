import { TestBed } from '@angular/core/testing';
import { AppError, MOCK_BACKEND_CONFIG, MockBackendConfig } from '@shared/data';
import { firstValueFrom, Observable } from 'rxjs';
import { EVENTS_REPOSITORY, EventsRepository } from './events.repository';
import { provideMockEventsRepository } from './mock-events.repository';
import { MOCK_EVENTS_CONFIG } from './mock-events.seed';

const NOW = new Date(2026, 9, 28, 12, 0);

function setup(backend: Partial<MockBackendConfig> = {}, seed = 1): EventsRepository {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideMockEventsRepository(),
      { provide: MOCK_BACKEND_CONFIG, useValue: { latencyMs: [0, 0], failureRate: 0, random: () => 0.5, ...backend } },
      { provide: MOCK_EVENTS_CONFIG, useValue: { eventCount: 5000, seed, now: () => NOW } },
    ],
  });
  return TestBed.inject(EVENTS_REPOSITORY);
}
const run = <T>(o: Observable<T>): Promise<T> => firstValueFrom(o);
const error = (o: Observable<unknown>): Promise<AppError> => firstValueFrom(o).then(() => { throw new Error('expected failure'); }, (e: AppError) => e);

describe('MockEventsRepository', () => {
  let repo: EventsRepository;
  beforeEach(() => (repo = setup()));

  it('seeds 5,000 events with 3–10 participants each and consistent counts', async () => {
    const all = await run(repo.getEvents({ skip: 0 }));
    expect(all.totalCount).toBe(5000);
    for (const event of all.items.slice(0, 50)) {
      const participants = await run(repo.getParticipants(event.id));
      expect(participants.length).toBe(event.participantCount);
      expect(event.participantCount).toBeGreaterThanOrEqual(3);
      expect(event.participantCount).toBeLessThanOrEqual(10);
    }
  });

  it('is deterministic for the same seed', async () => {
    const first = await run(repo.getEvents({ skip: 0, take: 20 }));
    const second = await run(setup().getEvents({ skip: 0, take: 20 }));
    expect(second).toEqual(first);
  });

  it('pages a filtered, sorted set and reports the full match count', async () => {
    const filter = { field: 'statusId', op: 'eq', value: 'planned' } as const;
    const page = await run(repo.getEvents({ skip: 50, take: 50, sort: [{ field: 'date', desc: false }], filter }));
    const all = await run(repo.getEvents({ skip: 0, filter }));
    expect(page.items).toHaveLength(50);
    expect(page.items.every((e) => e.statusId === 'planned')).toBe(true);
    expect(page.items.map((e) => e.date)).toEqual([...page.items.map((e) => e.date)].sort());
    expect(page.totalCount).toBe(all.totalCount);
  });

  it('returns statuses from the backend sorted by sortOrder', async () => {
    const statuses = await run(repo.getStatuses());
    expect(statuses.map((s) => s.id)).toEqual(['planned', 'cancelled', 'done']);
  });

  it('summarizes the full filtered set', async () => {
    const [location] = await run(repo.getLocations());
    const filter = { field: 'locationId', op: 'eq', value: location.id } as const;
    const events = (await run(repo.getEvents({ skip: 0, filter }))).items;
    const byStatus = await run(repo.getSummary(filter, 'status'));
    expect(byStatus.totalEvents).toBe(events.length);
    expect(byStatus.totalParticipants).toBe(events.reduce((s, e) => s + e.participantCount, 0));
    expect(byStatus.groups.map((g) => g.key)).toEqual(['planned', 'cancelled', 'done']);
    expect(byStatus.groups.reduce((s, g) => s + g.participantCount, 0)).toBe(byStatus.totalParticipants);
    const byLocation = await run(repo.getSummary(filter, 'location'));
    expect(byLocation.groups).toEqual([{ key: location.id, label: location.name, eventCount: events.length, participantCount: byStatus.totalParticipants }]);
  });

  it('keeps participantCount consistent on add and remove', async () => {
    const [event] = (await run(repo.getEvents({ skip: 0, take: 1 }))).items;
    const added = await run(repo.addParticipant(event.id, { name: 'Max Muster', email: 'max@example.com', role: 'guest' }));
    expect(added.participantCount).toBe(event.participantCount + 1);
    expect((await run(repo.getParticipants(event.id))).length).toBe(added.participantCount);

    const removed = await run(repo.removeParticipant(event.id, added.participant.id));
    expect(removed.participantCount).toBe(event.participantCount);
    const [reloaded] = (await run(repo.getEvents({ skip: 0, take: 1, filter: { field: 'name', op: 'eq', value: event.name } }))).items;
    expect(reloaded.participantCount).toBe(event.participantCount);
  });

  it('validates new events like a server', async () => {
    const [location] = await run(repo.getLocations());
    const valid = { name: 'Kundenevent Test', date: '2026-10-29', locationId: location.id, statusId: 'planned' };
    expect((await error(repo.createEvent({ ...valid, date: '2026-10-28' }))).messageKey).toBe('errors.dateNotFuture');
    expect((await error(repo.createEvent({ ...valid, name: ' a ' }))).status).toBe(400);
    expect((await error(repo.createEvent({ ...valid, locationId: 'nope' }))).status).toBe(400);
    expect((await error(repo.createEvent({ ...valid, statusId: 'nope' }))).status).toBe(400);

    const created = await run(repo.createEvent(valid));
    expect(created).toMatchObject({ participantCount: 0, locationName: location.name });
    const found = await run(repo.getEvents({ skip: 0, filter: { field: 'name', op: 'contains', value: 'kundenevent test' } }));
    expect(found.items.map((e) => e.id)).toContain(created.id);
  });

  it('updates status and location', async () => {
    const [event] = (await run(repo.getEvents({ skip: 0, take: 1 }))).items;
    const locations = await run(repo.getLocations());
    const target = locations.find((l) => l.id !== event.locationId)!;
    const updated = await run(repo.updateEvent(event.id, { statusId: 'cancelled', locationId: target.id }));
    expect(updated).toMatchObject({ statusId: 'cancelled', locationId: target.id, locationName: target.name });
    expect((await error(repo.updateEvent('evt-missing', { statusId: 'done' }))).status).toBe(404);
  });

  it('rejects invalid participant emails', async () => {
    const [event] = (await run(repo.getEvents({ skip: 0, take: 1 }))).items;
    const e = await error(repo.addParticipant(event.id, { name: 'X', email: 'x@', role: 'guest' }));
    expect(e.messageKey).toBe('errors.invalidEmail');
  });

  it('fails every call at failureRate 1 without mutating data', async () => {
    const failing = setup({ failureRate: 1 });
    expect((await error(failing.updateEvent('evt-00001', { statusId: 'done' }))).status).toBe(503);
    const healthy = setup();
    const [event] = (await run(healthy.getEvents({ skip: 0, take: 1 }))).items;
    expect(event.id).toBe('evt-00001');
  });
});
