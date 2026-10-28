/** ISO date-only string, e.g. "2026-11-04". */
export type IsoDate = string;

export interface EventItem {
  id: string;
  name: string;
  date: IsoDate;
  locationId: string;
  locationName: string;
  statusId: string;
  participantCount: number;
}

/** Statuses are backend data: the set and labels may change without a frontend release. */
export interface EventStatus {
  id: string;
  label: string;
  color?: string;
  sortOrder?: number;
}

export interface EventLocation {
  id: string;
  name: string;
}

export const PARTICIPANT_ROLES = ['guest', 'speaker', 'organizer', 'press'] as const;
export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];

export interface Participant {
  id: string;
  eventId: string;
  name: string;
  email: string;
  role: ParticipantRole;
}

/** Fields the list may filter and sort on (the API's whitelist); the type is derived from it. */
export const EVENT_FIELDS = [
  'name',
  'date',
  'locationId',
  'locationName',
  'statusId',
  'participantCount',
] as const satisfies readonly (keyof EventItem)[];
export type EventField = (typeof EVENT_FIELDS)[number];

export interface CreateEventInput {
  name: string;
  date: IsoDate;
  locationId: string;
  statusId: string;
}

export type UpdateEventInput = Partial<Pick<EventItem, 'statusId' | 'locationId'>>;

export interface CreateParticipantInput {
  name: string;
  email: string;
  role: ParticipantRole;
}

export type EventSummaryGroupBy = 'status' | 'location';

export interface EventSummaryGroup {
  key: string;
  label: string;
  eventCount: number;
  participantCount: number;
}

export interface EventSummary {
  totalEvents: number;
  totalParticipants: number;
  groups: EventSummaryGroup[];
}
