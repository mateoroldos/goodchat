export const createRequestId = (): string => crypto.randomUUID();

export const logApiError = (requestId: string, error: Error): void => {
  console.error(`[${requestId}]`, error);
};
