import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { currentLocale, SUPPORTED_LOCALES, switchLocale, TranslatePipe } from '@core';
import { DxSelectBoxModule } from 'devextreme-angular/ui/select-box';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe, DxSelectBoxModule],
  template: `
    <header>
      <div class="page-container d-flex items-center justify-between gap-5">
        <div class="d-flex items-center gap-6">
          <span class="fw-semibold">{{ 'app.title' | t }}</span>
          <nav [attr.aria-label]="'app.nav' | t" class="d-flex gap-4">
            <a
              class="nav-link"
              routerLink="/"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ exact: true }"
              ariaCurrentWhenActive="page"
            >
              {{ 'events.nav' | t }}
            </a>
          </nav>
        </div>
        @if (locales.length > 1) {
          <dx-select-box
            [items]="locales"
            valueExpr="id"
            displayExpr="label"
            [value]="locale"
            [width]="80"
            [inputAttr]="{ 'aria-label': 'app.language' | t }"
            (onValueChanged)="$event.event && switchLocale($event.value)"
          />
        }
      </div>
    </header>
    <main class="page-container py-5">
      <router-outlet />
    </main>
  `,
  styles: `
    header {
      background: var(--app-color-surface);
      border-bottom: 1px solid var(--app-color-border);
    }
    .nav-link {
      color: var(--app-color-text);
      text-decoration: none;
      padding-block: var(--app-space-4);
      border-bottom: 2px solid transparent;
    }
    .nav-link.active {
      color: var(--app-color-primary);
      border-bottom-color: var(--app-color-primary);
      font-weight: 600;
    }
  `,
})
export class App {
  protected readonly locales = SUPPORTED_LOCALES.map((id) => ({ id, label: id.toUpperCase() }));
  protected readonly locale = currentLocale();
  protected readonly switchLocale = switchLocale;
}
