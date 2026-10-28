import { InjectionToken } from '@angular/core';
import {
  CreateEventInput,
  CreateParticipantInput,
  EventField,
  EventItem,
  EventLocation,
  EventStatus,
  EventSummary,
  EventSummaryGroupBy,
  Participant,
  UpdateEventInput,
} from '@features/events/domain';
import { FilterNode, ListQuery, PagedResult } from '@shared/data';
import { Observable } from 'rxjs';

/** The only business-data boundary of the events feature. Swap the provider for an HTTP implementation. */
export interface EventsRepository {
  getEvents(query: ListQuery<EventField>): Observable<PagedResult<EventItem>>;
  getSummary(
    filter: FilterNode<EventField> | undefined,
    groupBy: EventSummaryGroupBy,
  ): Observable<EventSummary>;
  getStatuses(): Observable<EventStatus[]>;
  getLocations(): Observable<EventLocation[]>;
  createEvent(input: CreateEventInput): Observable<EventItem>;
  updateEvent(id: string, changes: UpdateEventInput): Observable<EventItem>;
  getParticipants(eventId: string): Observable<Participant[]>;
  addParticipant(
    eventId: string,
    input: CreateParticipantInput,
  ): Observable<{ participant: Participant; participantCount: number }>;
  removeParticipant(
    eventId: string,
    participantId: string,
  ): Observable<{ participantCount: number }>;
}

export const EVENTS_REPOSITORY = new InjectionToken<EventsRepository>('EVENTS_REPOSITORY');
