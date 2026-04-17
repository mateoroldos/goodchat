import type { AnyColumn } from "drizzle-orm";
import { and, eq, gt, lt, or } from "drizzle-orm";

export const DEFAULT_LIST_LIMIT = 50;

export const buildCursorFilter = (
  sort: "asc" | "desc",
  createdAtColumn: AnyColumn,
  idColumn: AnyColumn,
  createdAt: string,
  id: string
) => {
  if (sort === "asc") {
    return or(
      gt(createdAtColumn, createdAt),
      and(eq(createdAtColumn, createdAt), gt(idColumn, id))
    );
  }

  return or(
    lt(createdAtColumn, createdAt),
    and(eq(createdAtColumn, createdAt), lt(idColumn, id))
  );
};
