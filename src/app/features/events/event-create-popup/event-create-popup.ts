import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NotifyService, t, TranslatePipe } from '@core';
import { EVENTS_REPOSITORY } from '@features/events/data-access';
import { CreateEventInput, EventItem, EventLocation, EventStatus } from '@features/events/domain';
import { DATE_FORMAT, formatDate, isFutureDate, tomorrowIso } from '@shared/utils';
import { DxButtonModule } from 'devextreme-angular/ui/button';
import { DxFormComponent, DxFormModule } from 'devextreme-angular/ui/form';
import { DxPopupModule } from 'devextreme-angular/ui/popup';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-event-create-popup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DxPopupModule, DxFormModule, DxButtonModule, TranslatePipe],
  template: `
    <dx-popup
      [(visible)]="visible"
      [title]="'create.title' | t"
      [showCloseButton]="true"
      [dragEnabled]="false"
      [hideOnOutsideClick]="false"
      [width]="560"
      height="auto"
      [maxWidth]="'95vw'"
      (onShowing)="reset()"
    >
      <form class="d-flex flex-col gap-4" (submit)="submit($event)" novalidate>
        <dx-form [formData]="formData" labelLocation="top" [colCount]="2" [disabled]="pending()">
          <dxi-form-simple-item
            dataField="name"
            [colSpan]="2"
            [label]="{ text: 'events.col.name' | t }"
            [editorOptions]="{ validationMessageMode: 'always' }"
          >
            <dxi-form-required-rule [message]="required('events.col.name')" />
            <dxi-form-string-length-rule [min]="3" [max]="120" [message]="nameLengthMessage" />
          </dxi-form-simple-item>
          <dxi-form-simple-item
            dataField="date"
            editorType="dxDateBox"
            [label]="{ text: 'events.col.date' | t }"
            [editorOptions]="{
              dateSerializationFormat: 'yyyy-MM-dd',
              displayFormat: dateFormat,
              min: minDate(),
              useMaskBehavior: true,
              validationMessageMode: 'always',
            }"
          >
            <dxi-form-required-rule [message]="required('events.col.date')" />
            <dxi-form-custom-rule [validationCallback]="isFuture" [message]="dateMessage()" />
          </dxi-form-simple-item>
          <dxi-form-simple-item
            dataField="locationId"
            editorType="dxSelectBox"
            [label]="{ text: 'events.col.location' | t }"
            [editorOptions]="{
              items: locations(),
              valueExpr: 'id',
              displayExpr: 'name',
              searchEnabled: true,
              validationMessageMode: 'always',
            }"
          >
            <dxi-form-required-rule [message]="required('events.col.location')" />
          </dxi-form-simple-item>
          <dxi-form-simple-item
            dataField="statusId"
            editorType="dxSelectBox"
            [colSpan]="2"
            [label]="{ text: 'events.col.status' | t }"
            [editorOptions]="{
              items: statuses(),
              valueExpr: 'id',
              displayExpr: 'label',
              validationMessageMode: 'always',
            }"
          >
            <dxi-form-required-rule [message]="required('events.col.status')" />
          </dxi-form-simple-item>
        </dx-form>

        <div class="d-flex justify-end gap-2">
          <dx-button [text]="'common.cancel' | t" (onClick)="visible.set(false)" />
          <dx-button
            type="default"
            [useSubmitBehavior]="true"
            [text]="(pending() ? 'create.pending' : 'create.submit') | t"
            [disabled]="pending()"
          />
        </div>
      </form>
    </dx-popup>
  `,
})
export class EventCreatePopup {
  private readonly repository = inject(EVENTS_REPOSITORY);
  private readonly notify = inject(NotifyService);
  private readonly form = viewChild(DxFormComponent);

  readonly visible = model(false);
  readonly statuses = input.required<EventStatus[]>();
  readonly locations = input.required<EventLocation[]>();
  readonly created = output<EventItem>();

  protected readonly pending = signal(false);
  protected formData: CreateEventInput = this.emptyForm('');
  /** Earliest allowed date; recomputed whenever the dialog opens so it stays correct past midnight. */
  protected readonly minDate = signal(tomorrowIso());
  protected readonly dateMessage = computed(() =>
    t('create.dateFuture', formatDate(this.minDate())),
  );
  protected readonly isFuture = (e: { value?: unknown }): boolean =>
    typeof e.value === 'string' && isFutureDate(e.value);
  protected readonly dateFormat = DATE_FORMAT;
  protected readonly nameLengthMessage = t('create.nameLength');
  protected readonly required = (labelKey: Parameters<typeof t>[0]): string =>
    t('create.required', t(labelKey));

  protected reset(): void {
    this.minDate.set(tomorrowIso());
    this.formData = this.emptyForm(this.statuses()[0]?.id ?? '');
    this.form()?.instance.option('formData', this.formData);
    this.form()?.instance.reset({ ...this.formData });
  }

  /**
   * Native form submit (button click or Enter in any field). The browser commits the focused
   * editor's value before `submit` fires; invalid fields are highlighted instead of saving.
   */
  protected submit(event: Event): void {
    event.preventDefault();
    const form = this.form()?.instance;
    if (this.pending() || !form?.validate().isValid) return;
    this.pending.set(true);
    this.repository
      .createEvent({ ...this.formData, name: this.formData.name.trim() })
      .pipe(finalize(() => this.pending.set(false)))
      .subscribe({
        next: (event) => {
          this.notify.success(t('create.success', event.name));
          this.created.emit(event);
          this.visible.set(false);
        },
        // Popup stays open and keeps the user's input on failure.
        error: (error: unknown) => this.notify.fromError(error),
      });
  }

  private emptyForm(defaultStatus: string): CreateEventInput {
    return { name: '', date: tomorrowIso(), locationId: '', statusId: defaultStatus };
  }
}
