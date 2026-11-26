export class ApiError extends Error {
  constructor(
    public status: number,
    public payload: Record<string, unknown> = {},
  ) {
    super(String(payload.error ?? `HTTP ${status}`));
  }
}
