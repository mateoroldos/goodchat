import type { eden } from "$lib/eden-client";
import type { EdenSuccess } from "$lib/utils";

type AuthStatusEndpoint = ReturnType<(typeof eden.api)["auth-status"]["get"]>;

export type AuthStatus = EdenSuccess<() => AuthStatusEndpoint>;
