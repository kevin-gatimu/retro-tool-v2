/**
 * Common helper functions shared across multiple routes
 */

/**
 * Convert text to kebab-case slug
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Convert value to slug (lowercase, alphanumeric and hyphens only)
 */
export function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Create an empty editable column
 */
export function createEmptyColumn(order: number) {
  return {
    name: '',
    emoji: '',
    prompt: '',
    order,
  }
}
