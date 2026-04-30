import type { SchemaTableDeclaration } from "./types";

// Pinned Better Auth normalized declaration snapshot.
// Source provenance: better-auth@1.3.4 generated Drizzle auth schema,
// then normalized into dialect-neutral declarations for deterministic offline usage.
// Update workflow: regenerate from Better Auth, normalize, and replace this constant.
export const PINNED_BETTER_AUTH_TABLES = [
  {
    tableName: "user",
    columns: [
      { columnName: "id", dataType: "id", primaryKey: true },
      { columnName: "name", dataType: "text", notNull: true },
      { columnName: "email", dataType: "text", notNull: true, unique: true },
      {
        columnName: "email_verified",
        dataType: "boolean",
        notNull: true,
        propertyName: "emailVerified",
      },
      { columnName: "image", dataType: "text" },
      {
        columnName: "created_at",
        dataType: "timestamp",
        notNull: true,
        propertyName: "createdAt",
      },
      {
        columnName: "updated_at",
        dataType: "timestamp",
        notNull: true,
        propertyName: "updatedAt",
      },
    ],
    relations: [
      { kind: "many", name: "sessions", targetTable: "session" },
      { kind: "many", name: "accounts", targetTable: "account" },
    ],
  },
  {
    tableName: "session",
    columns: [
      { columnName: "id", dataType: "id", primaryKey: true },
      {
        columnName: "expires_at",
        dataType: "timestamp",
        notNull: true,
        propertyName: "expiresAt",
      },
      { columnName: "token", dataType: "text", notNull: true, unique: true },
      {
        columnName: "created_at",
        dataType: "timestamp",
        notNull: true,
        propertyName: "createdAt",
      },
      {
        columnName: "updated_at",
        dataType: "timestamp",
        notNull: true,
        propertyName: "updatedAt",
      },
      { columnName: "ip_address", dataType: "text", propertyName: "ipAddress" },
      { columnName: "user_agent", dataType: "text", propertyName: "userAgent" },
      {
        columnName: "user_id",
        dataType: "id",
        notNull: true,
        propertyName: "userId",
      },
    ],
    relations: [
      {
        kind: "one",
        name: "user",
        targetTable: "user",
        fields: ["userId"],
        references: ["id"],
      },
    ],
  },
  {
    tableName: "account",
    columns: [
      { columnName: "id", dataType: "id", primaryKey: true },
      {
        columnName: "account_id",
        dataType: "text",
        notNull: true,
        propertyName: "accountId",
      },
      {
        columnName: "provider_id",
        dataType: "text",
        notNull: true,
        propertyName: "providerId",
      },
      {
        columnName: "user_id",
        dataType: "id",
        notNull: true,
        propertyName: "userId",
      },
      {
        columnName: "access_token",
        dataType: "text",
        propertyName: "accessToken",
      },
      {
        columnName: "refresh_token",
        dataType: "text",
        propertyName: "refreshToken",
      },
      { columnName: "id_token", dataType: "text", propertyName: "idToken" },
      { columnName: "scope", dataType: "text" },
      { columnName: "password", dataType: "text" },
      {
        columnName: "created_at",
        dataType: "timestamp",
        notNull: true,
        propertyName: "createdAt",
      },
      {
        columnName: "updated_at",
        dataType: "timestamp",
        notNull: true,
        propertyName: "updatedAt",
      },
    ],
    relations: [
      {
        kind: "one",
        name: "user",
        targetTable: "user",
        fields: ["userId"],
        references: ["id"],
      },
    ],
  },
  {
    tableName: "verification",
    columns: [
      { columnName: "id", dataType: "id", primaryKey: true },
      { columnName: "identifier", dataType: "text", notNull: true },
      { columnName: "value", dataType: "text", notNull: true },
      {
        columnName: "expires_at",
        dataType: "timestamp",
        notNull: true,
        propertyName: "expiresAt",
      },
      {
        columnName: "created_at",
        dataType: "timestamp",
        propertyName: "createdAt",
      },
      {
        columnName: "updated_at",
        dataType: "timestamp",
        propertyName: "updatedAt",
      },
    ],
  },
] as const satisfies readonly SchemaTableDeclaration[];
