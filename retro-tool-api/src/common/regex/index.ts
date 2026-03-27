/**
 * Common regex patterns used across the API
 */

/**
 * Matches "Merged from: <names>" line at the end of card content
 * Used to extract or remove merged card attribution
 */
export const MERGED_FROM_LINE_REGEX = /\n\s*Merged from:\s*(.+)\s*$/i;

/**
 * Matches base64-encoded merge metadata block at the end of card content
 * Format: [MERGE_META:<base64-json>]
 */
export const MERGE_METADATA_REGEX = /\n?\[MERGE_META:([A-Za-z0-9+/=]+)\]\s*$/i;
