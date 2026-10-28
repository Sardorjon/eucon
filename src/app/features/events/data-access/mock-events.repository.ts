import { inject, Injectable, Provider } from '@angular/core';
import {
  CreateEventInput,
  CreateParticipantInput,
  EVENT_FIELDS,
  EventField,
  EventItem,
  EventLocation,
  EventStatus,
  EventSummary,
  EventSummaryGroupBy,
  Participant,
  PARTICIPANT_ROLES,
  UpdateEventInput,
} from '@features/events/domain';
import {
  AppError,
  applyListQuery,
  compareText,
  FieldAccessors,
  filterItems,
  FilterNode,
  ListQuery,
  MockBackend,
  PagedResult,
} from '@shared/data';
import { isFutureDate } from '@shared/utils';
import { Observable } from 'rxjs';
import { EVENTS_REPOSITORY, EventsRepository } from './events.repository';
import { generateMockEvents, MOCK_EVENTS_CONFIG, MockEventsData } from './mock-events.seed';

const EVENT_ACCESSORS = Object.fromEntries(
  EVENT_FIELDS.map((field) => [field, (e: EventItem) => e[field]]),
) as FieldAccessors<EventItem, EventField>;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** In-memory "server": validates like an API would and keeps derived data (participantCount) consistent. */
@Injectable()
export class MockEventsRepository implements EventsRepository {
  private readonly backend = inject(MockBackend);
  private readonly config = inject(MOCK_EVENTS_CONFIG);
  private dataCache?: MockEventsData;
  /** Primary-key index, like a database would have: O(1) lookups for every mutation. */
  private readonly eventsById = new Map<string, EventItem>();
  private nextEventId = 0;
  private nextParticipantId = 0;

  private get data(): MockEventsData {
    if (!this.dataCache) {
      this.dataCache = generateMockEvents(this.config);
      for (const event of this.dataCache.events) this.eventsById.set(event.id, event);
      this.nextEventId = this.dataCache.events.length;
      this.nextParticipantId = [...this.dataCache.participants.values()].reduce(
        (n, list) => n + list.length,
        0,
      );
    }
    return this.dataCache;
  }

  getEvents(query: ListQuery<EventField>): Observable<PagedResult<EventItem>> {
    return this.backend.respond('getEvents', () =>
      applyListQuery(this.data.events, query, EVENT_ACCESSORS),
    );
  }

  getSummary(
    filter: FilterNode<EventField> | undefined,
    groupBy: EventSummaryGroupBy,
  ): Observable<EventSummary> {
    return this.backend.respond('getSummary', () => {
      const events = filterItems(this.data.events, filter, EVENT_ACCESSORS);
      const groups =
        groupBy === 'status'
          ? this.sortedStatuses().map((s) => ({
              key: s.id,
              label: s.label,
              eventCount: 0,
              participantCount: 0,
            }))
          : [];
      const byKey = new Map(groups.map((g) => [g.key, g]));
      for (const e of events) {
        const key = groupBy === 'status' ? e.statusId : e.locationId;
        let group = byKey.get(key);
        if (!group) {
          group = {
            key,
            label: groupBy === 'status' ? key : e.locationName,
            eventCount: 0,
            participantCount: 0,
          };
          byKey.set(key, group);
          groups.push(group);
        }
        group.eventCount++;
        group.participantCount += e.participantCount;
      }
      if (groupBy === 'location') groups.sort((a, b) => b.participantCount - a.participantCount);
      return {
        totalEvents: events.length,
        totalParticipants: events.reduce((sum, e) => sum + e.participantCount, 0),
        groups,
      };
    });
  }

  getStatuses(): Observable<EventStatus[]> {
    return this.backend.respond('getStatuses', () => this.sortedStatuses());
  }

  getLocations(): Observable<EventLocation[]> {
    return this.backend.respond('getLocations', () =>
      [...this.data.locations].sort((a, b) => compareText(a.name, b.name)),
    );
  }

  createEvent(input: CreateEventInput): Observable<EventItem> {
    return this.backend.respond('createEvent', () => {
      const name = input.name?.trim() ?? '';
      if (name.length < 3 || name.length > 120) throw new AppError('errors.validation', 400);
      if (!isFutureDate(input.date, this.config.now()))
        throw new AppError('errors.dateNotFuture', 400);
      const location = this.findLocation(input.locationId);
      this.assertStatus(input.statusId);
      const event: EventItem = {
        id: `evt-${String(++this.nextEventId).padStart(5, '0')}`,
        name,
        date: input.date,
        locationId: location.id,
        locationName: location.name,
        statusId: input.statusId,
        participantCount: 0,
      };
      this.data.events.push(event);
      this.eventsById.set(event.id, event);
      this.data.participants.set(event.id, []);
      return event;
    });
  }

  updateEvent(id: string, changes: UpdateEventInput): Observable<EventItem> {
    return this.backend.respond('updateEvent', () => {
      const event = this.findEvent(id);
      if (changes.statusId !== undefined) {
        this.assertStatus(changes.statusId);
        event.statusId = changes.statusId;
      }
      if (changes.locationId !== undefined) {
        const location = this.findLocation(changes.locationId);
        event.locationId = location.id;
        event.locationName = location.name;
      }
      return event;
    });
  }

  getParticipants(eventId: string): Observable<Participant[]> {
    return this.backend.respond('getParticipants', () => {
      this.findEvent(eventId);
      return this.data.participants.get(eventId) ?? [];
    });
  }

  addParticipant(
    eventId: string,
    input: CreateParticipantInput,
  ): Observable<{ participant: Participant; participantCount: number }> {
    return this.backend.respond('addParticipant', () => {
      const event = this.findEvent(eventId);
      const name = input.name?.trim() ?? '';
      const email = input.email?.trim() ?? '';
      if (!name) throw new AppError('errors.validation', 400);
      if (!EMAIL.test(email)) throw new AppError('errors.invalidEmail', 400);
      if (!PARTICIPANT_ROLES.includes(input.role)) throw new AppError('errors.validation', 400);
      const participant: Participant = {
        id: `prt-${++this.nextParticipantId}`,
        eventId,
        name,
        email,
        role: input.role,
      };
      const list = this.data.participants.get(eventId) ?? [];
      list.push(participant);
      this.data.participants.set(eventId, list);
      event.participantCount = list.length;
      return { participant, participantCount: event.participantCount };
    });
  }

  removeParticipant(
    eventId: string,
    participantId: string,
  ): Observable<{ participantCount: number }> {
    return this.backend.respond('removeParticipant', () => {
      const event = this.findEvent(eventId);
      const list = this.data.participants.get(eventId) ?? [];
      const index = list.findIndex((p) => p.id === participantId);
      if (index < 0) throw new AppError('errors.notFound', 404);
      list.splice(index, 1);
      event.participantCount = list.length;
      return { participantCount: event.participantCount };
    });
  }

  private sortedStatuses(): EventStatus[] {
    return [...this.data.statuses].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  private findEvent(id: string): EventItem {
    const event = this.data && this.eventsById.get(id);
    if (!event) throw new AppError('errors.notFound', 404);
    return event;
  }

  private findLocation(id: string): EventLocation {
    const location = this.data.locations.find((l) => l.id === id);
    if (!location) throw new AppError('errors.validation', 400);
    return location;
  }

  private assertStatus(id: string): void {
    if (!this.data.statuses.some((s) => s.id === id)) throw new AppError('errors.validation', 400);
  }
}

export function provideMockEventsRepository(): Provider[] {
  return [{ provide: EVENTS_REPOSITORY, useClass: MockEventsRepository }];
}
