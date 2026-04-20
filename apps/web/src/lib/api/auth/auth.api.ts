import { eden } from "$lib/eden-client";

export const fetchAuthStatus = async () => {
  const { data, error } = await eden.api["auth-status"].get();
  if (error || !data) {
    throw new Error("Failed to fetch auth status");
  }

  return data;
};
