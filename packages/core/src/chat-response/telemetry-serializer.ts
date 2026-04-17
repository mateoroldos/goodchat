export const toJsonRecord = (
  value: unknown
): Record<string, unknown> | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  try {
    const normalized = JSON.parse(
      JSON.stringify(value, (_key: string, entry: unknown) => {
        if (typeof entry === "bigint") {
          return entry.toString();
        }

        if (
          typeof entry === "function" ||
          typeof entry === "symbol" ||
          typeof entry === "undefined"
        ) {
          return undefined;
        }

        return entry;
      })
    );

    if (
      !normalized ||
      typeof normalized !== "object" ||
      Array.isArray(normalized)
    ) {
      return undefined;
    }

    return normalized as Record<string, unknown>;
  } catch {
    return undefined;
  }
};
