export interface Logger {
  emit(...args: unknown[]): void;
  error(...args: unknown[]): void;
  getContext(): Record<string, unknown>;
  info(...args: unknown[]): void;
  set(fields: Record<string, unknown>): void;
  warn(...args: unknown[]): void;
}
