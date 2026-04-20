import { Context } from "runed";
import type { AuthStatus } from "./auth.types";

export const authStatusContext = new Context<AuthStatus>("auth-status");
