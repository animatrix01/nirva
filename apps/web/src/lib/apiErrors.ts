export interface TypedErrorBody {
  detail: string;
  field: string | null;
}

export class ApiError extends Error {
  readonly status: number;
  readonly body: TypedErrorBody;

  constructor(status: number, detail: string, field: string | null = null) {
    super(detail);
    this.status = status;
    this.body = { detail, field };
  }
}
