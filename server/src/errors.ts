export interface AppError extends Error {
  status: number;
  code: string;
}

export function createAppError(code: string, status: number, message: string): AppError {
  const err = new Error(message) as AppError;
  err.status = status;
  err.code = code;
  return err;
}


