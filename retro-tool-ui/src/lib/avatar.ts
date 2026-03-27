/**
 * Generate a DiceBear avatar URL using the HTTP API.
 * @see https://www.dicebear.com/how-to-use/http-api/
 */

export type AvatarStyle =
  | 'adventurer'
  | 'adventurer-neutral'
  | 'avataaars'
  | 'avataaars-neutral'
  | 'big-ears'
  | 'big-ears-neutral'
  | 'big-smile'
  | 'bottts'
  | 'bottts-neutral'
  | 'croodles'
  | 'croodles-neutral'
  | 'dylan'
  | 'fun-emoji'
  | 'glass'
  | 'icons'
  | 'identicon'
  | 'initials'
  | 'lorelei'
  | 'lorelei-neutral'
  | 'micah'
  | 'miniavs'
  | 'notionists'
  | 'notionists-neutral'
  | 'open-peeps'
  | 'personas'
  | 'pixel-art'
  | 'pixel-art-neutral'
  | 'rings'
  | 'shapes'
  | 'thumbs'

export const DEFAULT_AVATAR_STYLE: AvatarStyle = 'thumbs'

export function generateAvatarUrl(
  seed: string,
  style: AvatarStyle = DEFAULT_AVATAR_STYLE,
  options?: {
    size?: number
    backgroundColor?: string
    radius?: number
  },
): string {
  const baseUrl = `https://api.dicebear.com/9.x/${style}/svg`
  const params = new URLSearchParams()

  params.set('seed', seed)

  if (options?.size) {
    params.set('size', options.size.toString())
  }
  if (options?.backgroundColor) {
    params.set('backgroundColor', options.backgroundColor)
  }
  if (options?.radius) {
    params.set('radius', options.radius.toString())
  }

  return `${baseUrl}?${params.toString()}`
}
