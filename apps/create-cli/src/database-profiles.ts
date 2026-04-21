import type { DatabaseDialect } from "@goodchat/contracts/config/types";

export type DatabaseProfileId =
  | "sqlite-local"
  | "postgres-local"
  | "postgres-neon"
  | "mysql-local"
  | "mysql-planetscale";

export interface DatabaseProfile {
  connectionDocsUrl?: string;
  connectionPlaceholder: string;
  connectionPrompt: string;
  dialect: DatabaseDialect;
  id: DatabaseProfileId;
  label: string;
  localDockerService?: "postgres" | "mysql";
  managed: boolean;
}

export const DATABASE_PROFILES: DatabaseProfile[] = [
  {
    id: "sqlite-local",
    label: "SQLite (local file)",
    dialect: "sqlite",
    managed: false,
    connectionPrompt: "SQLite database path",
    connectionPlaceholder: "./goodchat.db",
  },
  {
    id: "postgres-local",
    label: "PostgreSQL (local)",
    dialect: "postgres",
    managed: false,
    localDockerService: "postgres",
    connectionPrompt: "PostgreSQL connection URL",
    connectionPlaceholder:
      "postgres://goodchat:goodchat@localhost:5432/goodchat",
  },
  {
    id: "postgres-neon",
    label: "PostgreSQL (Neon)",
    dialect: "postgres",
    managed: true,
    connectionPrompt: "Neon Postgres connection URL",
    connectionPlaceholder:
      "postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
    connectionDocsUrl: "https://neon.com/docs/connect/connect-from-any-app",
  },
  {
    id: "mysql-local",
    label: "MySQL (local)",
    dialect: "mysql",
    managed: false,
    localDockerService: "mysql",
    connectionPrompt: "MySQL connection URL",
    connectionPlaceholder: "mysql://root:goodchat@localhost:3306/goodchat",
  },
  {
    id: "mysql-planetscale",
    label: "MySQL (PlanetScale)",
    dialect: "mysql",
    managed: true,
    connectionPrompt: "PlanetScale MySQL connection URL",
    connectionPlaceholder:
      "mysql://user:password@aws.connect.psdb.cloud/dbname?sslaccept=strict",
    connectionDocsUrl:
      "https://planetscale.com/docs/vitess/connecting/connection-strings",
  },
];

export const DEFAULT_DATABASE_PROFILE_ID: DatabaseProfileId = "sqlite-local";

export const DATABASE_PROFILE_BY_ID = DATABASE_PROFILES.reduce(
  (acc, profile) => {
    acc.set(profile.id, profile);
    return acc;
  },
  new Map<DatabaseProfileId, DatabaseProfile>()
);
