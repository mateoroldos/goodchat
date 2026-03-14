import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// biome-ignore lint/suspicious/noExplicitAny: allow removing child prop generically
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, "child"> : T;
// biome-ignore lint/suspicious/noExplicitAny: allow removing children prop generically
export type WithoutChildren<T> = T extends { children?: any }
  ? Omit<T, "children">
  : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & {
  ref?: U | null;
};

export type ApiError =
  | { message: string }
  | { code: string; message: string; requestId: string };
type EdenResponse<T> = T extends (...args: infer _Args) => infer Return
  ? Awaited<Return>
  : never;
export type EdenData<T> =
  EdenResponse<T> extends { data?: infer Data } ? Data : never;
export type EdenSuccess<T> = Exclude<EdenData<T>, ApiError | null | undefined>;
