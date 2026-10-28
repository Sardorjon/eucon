import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NotifyService, t, TranslatePipe } from '@core';
import { EVENTS_REPOSITORY } from '@features/events/data-access';
import {
  EVENT_FIELDS,
  EventField,
  EventItem,
  EventStatus,
  UpdateEventInput,
} from '@features/events/domain';
import { FilterNode, withReadRetry } from '@shared/data';
import {
  createRemoteStore,
  DEFAULT_PAGE_SIZES,
  exportGridToExcel,
  gridStateStoring,
  UnsupportedQueryError,
} from '@shared/data-grid';
import { ErrorAlert } from '@shared/ui';
import { DATE_FORMAT, todayIso } from '@shared/utils';
import { DxTemplateModule } from 'devextreme-angular/core';
import { DxButtonModule } from 'devextreme-angular/ui/button';
import { DxDataGridComponent, DxDataGridModule } from 'devextreme-angular/ui/data-grid';
import type { DataErrorOccurredEvent } from 'devextreme/ui/data_grid';
import { EventCreatePopup } from '../event-create-popup/event-create-popup';
import {
  EventParticipants,
  ParticipantCountChange,
} from '../event-participants/event-participants';
import { EventSummaryPanel } from '../event-summary/event-summary';
import { StatusBadge } from '../status-badge/status-badge';

const sameFilter = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

@Component({
  selector: 'app-events-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DxDataGridModule,
    DxButtonModule,
    DxTemplateModule,
    TranslatePipe,
    ErrorAlert,
    StatusBadge,
    EventSummaryPanel,
    EventCreatePopup,
    EventParticipants,
  ],
  templateUrl: './events-page.html',
})
export class EventsPage {
  private readonly repository = inject(EVENTS_REPOSITORY);
  private readonly notify = inject(NotifyService);
  private readonly grid = viewChild(DxDataGridComponent);
  private readonly summary = viewChild(EventSummaryPanel);

  protected readonly statuses = rxResource({
    stream: () => this.repository.getStatuses().pipe(withReadRetry()),
  });
  protected readonly locations = rxResource({
    stream: () => this.repository.getLocations().pipe(withReadRetry()),
  });
  protected readonly lookupsReady = computed(
    () => !!this.statuses.value() && !!this.locations.value(),
  );
  protected readonly lookupsFailed = computed(
    () => !!this.statuses.error() || !!this.locations.error(),
  );
  private readonly statusById = computed(
    () => new Map((this.statuses.value() ?? []).map((s) => [s.id, s])),
  );

  /** Filter of the result the grid currently shows; drives the summary so both describe the same set. */
  protected readonly activeFilter = signal<FilterNode<EventField> | undefined>(undefined, {
    equal: sameFilter,
  });
  protected readonly loadError = signal(false);
  protected readonly exporting = signal(false);
  protected readonly createVisible = signal(false);

  protected readonly store = createRemoteStore<EventItem, EventField>({
    key: 'id',
    fields: EVENT_FIELDS,
    load: (query) => this.repository.getEvents(query),
    update: (id, values) => this.repository.updateEvent(id, pickEditable(values)),
    onLoadSuccess: (query) => {
      this.activeFilter.set(query.filter);
      this.loadError.set(false);
    },
    onLoadError: (error) => this.handleLoadError(error),
  });

  protected readonly stateStoring = gridStateStoring('events-grid', 1);
  protected readonly pageSizes = [...DEFAULT_PAGE_SIZES];
  protected readonly dateFormat = DATE_FORMAT;

  protected readonly text = {
    search: t('events.search'),
    noData: t('events.noData'),
    pagerInfo: t('events.pagerInfo'),
    loadFailed: t('events.loadFailed'),
    lookupsFailed: t('events.lookupsFailed'),
  };

  protected status(id: string): EventStatus | undefined {
    return this.statusById().get(id);
  }

  protected retryLookups(): void {
    this.statuses.reload();
    this.locations.reload();
  }

  protected retryLoad(): void {
    this.grid()?.instance.refresh();
  }

  protected onSaved(): void {
    this.notify.success(t('common.saved'));
    this.summary()?.reload();
  }

  /** Save failures roll the cell back so the grid never shows an unsaved value as saved. */
  protected onDataError(e: DataErrorOccurredEvent): void {
    const grid = this.grid()?.instance;
    if (grid?.hasEditData()) {
      grid.cancelEditData();
      this.notify.fromError(e.error);
    }
  }

  protected onCreated(): void {
    this.grid()?.instance.refresh();
    this.summary()?.reload();
  }

  protected onParticipantCount({ eventId, participantCount }: ParticipantCountChange): void {
    this.store.push([{ type: 'update', key: eventId, data: { participantCount } }]);
    this.summary()?.reload();
  }

  protected async exportExcel(): Promise<void> {
    const grid = this.grid()?.instance;
    if (!grid || this.exporting()) return;
    this.exporting.set(true);
    try {
      await exportGridToExcel(grid, {
        title: t('export.title'),
        fileName: `${t('export.fileName')}_${todayIso()}.xlsx`,
      });
      this.notify.success(t('export.success'));
    } catch {
      this.notify.error(t('export.failed'));
    } finally {
      this.exporting.set(false);
    }
  }

  /**
   * A filter outside the API contract (e.g. from an older persisted state) must never lock the
   * user out: drop it and reload instead of showing a permanent error.
   */
  private handleLoadError(error: unknown): void {
    if (error instanceof UnsupportedQueryError) {
      console.warn('[events-grid] filter reset:', error.detail);
      this.notify.fromError(error);
      queueMicrotask(() => this.grid()?.instance.clearFilter());
      return;
    }
    this.loadError.set(true);
  }
}

/** Only status and location are editable inline; anything else is dropped before it reaches the API. */
function pickEditable(values: Partial<EventItem>): UpdateEventInput {
  const changes: UpdateEventInput = {};
  if (values.statusId !== undefined) changes.statusId = values.statusId;
  if (values.locationId !== undefined) changes.locationId = values.locationId;
  return changes;
}
