import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { t, TranslatePipe } from '@core';
import { EVENTS_REPOSITORY } from '@features/events/data-access';
import {
  EventField,
  EventStatus,
  EventSummary,
  EventSummaryGroupBy,
} from '@features/events/domain';
import { FilterNode, withReadRetry } from '@shared/data';
import { ErrorAlert } from '@shared/ui';
import { DxButtonGroupModule } from 'devextreme-angular/ui/button-group';
import { DxLoadIndicatorModule } from 'devextreme-angular/ui/load-indicator';

@Component({
  selector: 'app-event-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, TranslatePipe, ErrorAlert, DxButtonGroupModule, DxLoadIndicatorModule],
  template: `
    <section class="card d-flex flex-col gap-3" aria-labelledby="summary-title">
      <div class="d-flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="summary-title" class="text-lg">{{ 'summary.title' | t }}</h2>
          <p class="m-0 mt-1 text-sm text-muted">{{ 'summary.basis' | t }}</p>
        </div>
        <dx-button-group
          [items]="groupOptions"
          keyExpr="key"
          [selectedItemKeys]="[groupBy()]"
          [elementAttr]="{ role: 'group', 'aria-label': 'summary.groupBy' | t }"
          (onSelectionChanged)="setGroupBy($event.component.option('selectedItemKeys') ?? [])"
        />
      </div>

      @if (summary.error()) {
        <app-error-alert [message]="failedText" (retry)="reload()" />
      } @else if (current(); as value) {
        <div
          class="d-grid grid-auto gap-3"
          [class.loading]="summary.isLoading()"
          [attr.aria-busy]="summary.isLoading()"
        >
          <div class="card">
            <div class="text-sm text-muted">{{ 'summary.events' | t }}</div>
            <div class="text-xl fw-semibold mt-1 tabular-nums">
              {{ value.totalEvents | number }}
            </div>
          </div>
          <div class="card">
            <div class="text-sm text-muted">{{ 'summary.participants' | t }}</div>
            <div class="text-xl fw-semibold mt-1 tabular-nums">
              {{ value.totalParticipants | number }}
            </div>
          </div>
        </div>
        <ul class="breakdown d-flex flex-col gap-2 m-0 p-0" [class.loading]="summary.isLoading()">
          @for (row of rows(); track row.key) {
            <li class="row d-grid items-center gap-3 text-sm">
              <span class="fw-semibold">{{ row.label }}</span>
              <span class="bar" aria-hidden="true"
                ><span [style.width.%]="row.percent" [style.background]="row.color"></span
              ></span>
              <span class="tabular-nums text-right">{{
                'summary.row'
                  | t: (row.eventCount | number) ?? '' : (row.participantCount | number) ?? ''
              }}</span>
            </li>
          }
        </ul>
      } @else {
        <div class="d-flex items-center gap-2 text-muted" role="status">
          <dx-load-indicator [height]="20" [width]="20" />
          {{ 'common.loading' | t }}
        </div>
      }
    </section>
  `,
  styles: `
    .bar {
      height: 8px;
      border-radius: 4px;
      background: var(--app-color-track);
      overflow: hidden;
    }
    .bar > span {
      display: block;
      height: 100%;
    }
    .loading {
      opacity: 0.6;
      transition: opacity 0.15s;
    }
    .breakdown {
      list-style: none;
      max-height: 240px;
      overflow: auto;
    }
    .row {
      grid-template-columns: minmax(96px, 160px) minmax(0, 1fr) auto;
    }
  `,
})
export class EventSummaryPanel {
  private readonly repository = inject(EVENTS_REPOSITORY);

  /** Active grid filter: the summary always covers every matching event, not the visible page. */
  readonly filter = input<FilterNode<EventField> | undefined>();
  readonly statuses = input<EventStatus[]>([]);

  protected readonly failedText = t('summary.failed');
  protected readonly groupBy = signal<EventSummaryGroupBy>('status');
  protected readonly groupOptions = [
    { key: 'status', text: t('summary.byStatus') },
    { key: 'location', text: t('summary.byLocation') },
  ];

  protected readonly summary = rxResource({
    params: () => ({ filter: this.filter(), groupBy: this.groupBy() }),
    stream: ({ params }) =>
      this.repository.getSummary(params.filter, params.groupBy).pipe(withReadRetry()),
  });

  /** Last loaded summary, kept while the next one loads so the layout never collapses. */
  protected readonly current = linkedSignal<EventSummary | undefined, EventSummary | undefined>({
    source: () => this.summary.value(),
    computation: (value, previous) => value ?? previous?.value,
  });

  protected readonly rows = computed(() => {
    const summary = this.current();
    if (!summary) return [];
    const max = Math.max(1, ...summary.groups.map((g) => g.participantCount));
    const statusById = new Map(this.statuses().map((s) => [s.id, s]));
    // Labels come from the server response; only status groups match a status id and get its colour.
    return summary.groups.map((g) => ({
      ...g,
      percent: (g.participantCount / max) * 100,
      color: statusById.get(g.key)?.color ?? 'var(--app-color-primary)',
    }));
  });

  /** Re-fetches after a mutation; the last numbers stay visible (dimmed) meanwhile. */
  reload(): void {
    this.summary.reload();
  }

  protected setGroupBy(keys: unknown[]): void {
    const [key] = keys;
    if (key === 'status' || key === 'location') this.groupBy.set(key);
  }
}
