import { ERROR_CODES, type ErrorCode, type ValidationErrorDetail } from './api-types';

interface ApiErrorParams {
  code: ErrorCode | string;
  message: string;
  status?: number;
  details?: ValidationErrorDetail[] | Record<string, unknown>;
  requestId?: string;
}

export class ApiError extends Error {
  readonly code: ErrorCode | string;
  readonly status: number | undefined;
  readonly details: ValidationErrorDetail[] | Record<string, unknown> | undefined;
  readonly requestId: string | undefined;

  constructor(params: ApiErrorParams) {
    super(params.message);
    this.name = 'ApiError';
    this.code = params.code;
    this.status = params.status;
    this.details = params.details;
    this.requestId = params.requestId;
  }

  isValidationError(): boolean {
    return this.code === ERROR_CODES.VALIDATION_FAILED;
  }

  validationDetails(): ValidationErrorDetail[] {
    if (!this.isValidationError() || !Array.isArray(this.details)) return [];
    return this.details;
  }
}
