import { createQueryClient } from "$lib/query-client";

export const prerender = false;
export const ssr = false;

export const load = () => {
  return { queryClient: createQueryClient() };
};
