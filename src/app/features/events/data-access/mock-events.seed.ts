import { InjectionToken } from '@angular/core';
import {
  EventItem,
  EventLocation,
  EventStatus,
  Participant,
  PARTICIPANT_ROLES,
} from '@features/events/domain';
import { createSeededRandom } from '@shared/data';
import { addDaysIso, todayIso } from '@shared/utils';

export interface MockEventsConfig {
  eventCount: number;
  seed: number;
  now: () => Date;
}

export const MOCK_EVENTS_CONFIG = new InjectionToken<MockEventsConfig>('MOCK_EVENTS_CONFIG', {
  providedIn: 'root',
  factory: () => ({ eventCount: 5000, seed: 20261028, now: () => new Date() }),
});

export interface MockEventsData {
  statuses: EventStatus[];
  locations: EventLocation[];
  events: EventItem[];
  participants: Map<string, Participant[]>;
}

const STATUSES: EventStatus[] = [
  { id: 'planned', label: 'Geplant', color: '#0f6cbd', sortOrder: 1 },
  { id: 'cancelled', label: 'Abgesagt', color: '#c50f1f', sortOrder: 2 },
  { id: 'done', label: 'Erledigt', color: '#107c10', sortOrder: 3 },
];

const CITIES = [
  'Berlin',
  'Hamburg',
  'München',
  'Köln',
  'Frankfurt am Main',
  'Stuttgart',
  'Düsseldorf',
  'Leipzig',
  'Dortmund',
  'Essen',
  'Bremen',
  'Dresden',
  'Hannover',
  'Nürnberg',
  'Duisburg',
  'Bochum',
  'Wuppertal',
  'Bielefeld',
  'Bonn',
  'Münster',
  'Mannheim',
  'Karlsruhe',
  'Augsburg',
  'Wiesbaden',
  'Mainz',
];
const TYPES = [
  'Messe',
  'Kongress',
  'Kundenevent',
  'Workshop',
  'Sommerfest',
  'Weihnachtsfeier',
  'Partnertag',
  'Roadshow',
  'Fachforum',
  'Vertriebstagung',
];
const TOPICS = [
  'Digitale Logistik',
  'Industrie 4.0',
  'Handel',
  'Nachhaltigkeit',
  'KI im Einkauf',
  'Pricing',
  'Supply Chain',
  'Data Analytics',
  'Automotive',
  'Retail',
];
const FIRST = [
  'Anna',
  'Jonas',
  'Lea',
  'Mehmet',
  'Sophie',
  'Paul',
  'Mia',
  'Lukas',
  'Emma',
  'Finn',
  'Hannah',
  'Elias',
  'Lena',
  'Noah',
  'Clara',
  'Ali',
];
const LAST = [
  'Schröder',
  'Weber',
  'Hoffmann',
  'Yilmaz',
  'Braun',
  'Neumann',
  'Schulz',
  'Fischer',
  'Wagner',
  'Becker',
  'Koch',
  'Richter',
  'Klein',
  'Wolf',
];

const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-');

export function generateMockEvents({ eventCount, seed, now }: MockEventsConfig): MockEventsData {
  const random = createSeededRandom(seed);
  const pickOne = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
  const int = (min: number, max: number): number => min + Math.floor(random() * (max - min + 1));

  const locations = CITIES.map((name) => ({ id: `loc-${slug(name)}`, name }));
  const today = todayIso(now());
  const participants = new Map<string, Participant[]>();
  let participantSeq = 0;

  const events = Array.from({ length: eventCount }, (_, i): EventItem => {
    const id = `evt-${String(i + 1).padStart(5, '0')}`;
    const date = addDaysIso(today, int(-365, 540));
    const isPast = date <= today;
    const statusId = isPast
      ? random() < 0.8
        ? 'done'
        : 'cancelled'
      : random() < 0.88
        ? 'planned'
        : 'cancelled';
    const location = pickOne(locations);
    const type = pickOne(TYPES);
    const name = `${type} ${random() < 0.5 ? pickOne(TOPICS) : location.name} ${date.slice(0, 4)}`;

    const people = Array.from({ length: int(3, 10) }, (): Participant => {
      const first = pickOne(FIRST);
      const last = pickOne(LAST);
      participantSeq++;
      return {
        id: `prt-${participantSeq}`,
        eventId: id,
        name: `${first} ${last}`,
        email: `${slug(first)}.${slug(last)}${participantSeq}@example.com`,
        role: pickOne(PARTICIPANT_ROLES),
      };
    });
    participants.set(id, people);

    return {
      id,
      name,
      date,
      locationId: location.id,
      locationName: location.name,
      statusId,
      participantCount: people.length,
    };
  });

  return { statuses: STATUSES, locations, events, participants };
}
