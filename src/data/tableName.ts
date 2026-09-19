const TABLE_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * User-supplied table names reach raw SQL / qpl. Only allow identifier-safe
 * names, which is also what qpl's own registerTable accepts.
 */
export function sanitizeTableName(name: string): string {
  if (!TABLE_NAME_RE.test(name)) {
    throw new Error(
      `Invalid table name "${name}": must match ${TABLE_NAME_RE} (letters, digits, underscore; cannot start with a digit).`,
    );
  }
  return name;
}
