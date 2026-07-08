import { randomUUID } from 'crypto';

export function generateId(): string {
  return randomUUID();
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type PlainObject = Record<string, unknown>;

export function isPlainObject(value: unknown): value is PlainObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/**
 * Recursively merge `source` into `target`. Nested plain objects are merged;
 * arrays and primitives are replaced wholesale (so a full list — e.g. a
 * `favorites` array — replaces the previous one rather than concatenating).
 */
export function deepMerge<T extends PlainObject>(
  target: T,
  source: PlainObject,
): T {
  const output: PlainObject = { ...target };
  for (const [key, value] of Object.entries(source)) {
    const existing = output[key];
    if (isPlainObject(value) && isPlainObject(existing)) {
      output[key] = deepMerge(existing, value);
    } else {
      output[key] = value;
    }
  }
  return output as T;
}
