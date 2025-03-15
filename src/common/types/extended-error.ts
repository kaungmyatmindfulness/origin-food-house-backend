export interface ExtendedError extends Error {
  response?: {
    message?: string | string[];
    error?: string;
  };
}
