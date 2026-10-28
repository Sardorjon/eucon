import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { NotifyService, t, TranslatePipe } from '@core';
import { EVENTS_REPOSITORY } from '@features/events/data-access';
import { CreateParticipantInput, Participant, PARTICIPANT_ROLES } from '@features/events/domain';
import { withReadRetry } from '@shared/data';
import { DxDataGridModule } from 'devextreme-angular/ui/data-grid';
import CustomStore from 'devextreme/data/custom_store';
import { firstValueFrom, tap } from 'rxjs';

export interface ParticipantCountChange {
  eventId: string;
  participantCount: number;
}

/** Rendered inside the grid's master-detail row, so participants load only when a row is expanded. */
@Component({
  selector: 'app-event-participants',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DxDataGridModule, TranslatePipe],
  template: `
    <section
      class="d-flex flex-col gap-2 py-2"
      [attr.aria-label]="'participants.title' | t: eventName()"
    >
      <h3 class="text-sm">{{ 'participants.title' | t: eventName() }}</h3>
      <dx-data-grid
        [dataSource]="store"
        [showBorders]="true"
        [columnAutoWidth]="true"
        [errorRowEnabled]="true"
        (onDataErrorOccurred)="onDataError($event)"
      >
        <dxo-data-grid-editing
          mode="row"
          [allowAdding]="true"
          [allowDeleting]="true"
          [useIcons]="true"
        >
          <dxo-data-grid-texts
            [addRow]="'participants.add' | t"
            [confirmDeleteMessage]="'participants.confirmDelete' | t"
            [deleteRow]="'participants.delete' | t"
          />
        </dxo-data-grid-editing>
        <dxi-data-grid-column dataField="name" [caption]="'participants.col.name' | t">
          <dxi-data-grid-validation-rule type="required" />
        </dxi-data-grid-column>
        <dxi-data-grid-column dataField="email" [caption]="'participants.col.email' | t">
          <dxi-data-grid-validation-rule type="required" />
          <dxi-data-grid-validation-rule type="email" [message]="emailMessage" />
        </dxi-data-grid-column>
        <dxi-data-grid-column
          dataField="role"
          [caption]="'participants.col.role' | t"
          [width]="200"
        >
          <dxo-data-grid-lookup [dataSource]="roles" valueExpr="id" displayExpr="label" />
          <dxi-data-grid-validation-rule type="required" />
        </dxi-data-grid-column>
      </dx-data-grid>
    </section>
  `,
})
export class EventParticipants {
  private readonly repository = inject(EVENTS_REPOSITORY);
  private readonly notify = inject(NotifyService);

  readonly eventId = input.required<string>();
  readonly eventName = input.required<string>();
  readonly countChanged = output<ParticipantCountChange>();

  protected readonly roles = PARTICIPANT_ROLES.map((id) => ({
    id,
    label: t(`participants.role.${id}`),
  }));
  protected readonly emailMessage = t('errors.invalidEmail');

  protected readonly store = new CustomStore<Participant, string>({
    key: 'id',
    loadMode: 'raw',
    load: () =>
      firstValueFrom(this.repository.getParticipants(this.eventId()).pipe(withReadRetry())),
    insert: (values: Partial<Participant>) =>
      firstValueFrom(
        this.repository
          .addParticipant(this.eventId(), values as CreateParticipantInput)
          .pipe(tap((r) => this.emitCount(r.participantCount))),
      ).then((r) => r.participant),
    remove: (key: string) =>
      firstValueFrom(
        this.repository
          .removeParticipant(this.eventId(), key)
          .pipe(tap((r) => this.emitCount(r.participantCount))),
      ).then(() => undefined),
  });

  protected onDataError(e: { error?: Error }): void {
    this.notify.fromError(e.error);
  }

  private emitCount(participantCount: number): void {
    this.countChanged.emit({ eventId: this.eventId(), participantCount });
  }
}
