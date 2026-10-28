import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { EventStatus } from '@features/events/domain';

/** Status is always shown as text; the backend colour only tints the dot (no colour-only meaning). */
@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="badge d-flex items-center gap-2 text-sm fw-semibold">
      <span
        class="dot"
        aria-hidden="true"
        [style.background]="status()?.color ?? 'var(--app-status-fallback)'"
      ></span>
      {{ status()?.label ?? fallback() }}
    </span>
  `,
  styles: `
    .badge {
      display: inline-flex;
      padding: 2px var(--app-space-3);
      border: 1px solid var(--app-color-border);
      border-radius: 999px;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex: none;
    }
  `,
})
export class StatusBadge {
  readonly status = input<EventStatus | undefined>();
  readonly fallback = input('');
}
