import { Routes } from '@angular/router';
import { provideMockEventsRepository } from '@features/events/data-access';

export default [
  {
    path: '',
    // Feature-scoped data access: replace with an HTTP provider without touching any component.
    providers: [provideMockEventsRepository()],
    loadComponent: () => import('./events-page/events-page').then((m) => m.EventsPage),
  },
] satisfies Routes;
