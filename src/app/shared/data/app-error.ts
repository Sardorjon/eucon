/**
 * Error contract shared by data access and UI. `messageKey` is a localization key, never display
 * text; `status` follows HTTP semantics (4xx = client/validation, 5xx = transient).
 */
export class AppError extends Error {
  constructor(
    readonly messageKey: string,
    readonly status = 500,
  ) {
    super(messageKey);
    this.name = new.target.name;
  }
}
