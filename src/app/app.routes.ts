import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadChildren: () => import('./features/events/events.routes') },
  { path: '**', redirectTo: '' },
];
