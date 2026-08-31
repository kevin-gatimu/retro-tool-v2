type StorageKind = 'localStorage' | 'sessionStorage'
type StorageAccess = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>

export function isStorageAvailable(storage: StorageAccess): boolean {
  try {
    const key = '__retro_storage_test__'
    storage.setItem(key, key)
    const available = storage.getItem(key) === key
    storage.removeItem(key)
    return available
  } catch {
    return false
  }
}

export function isBrowserStorageAvailable(kind: StorageKind): boolean {
  if (typeof window === 'undefined') return false

  try {
    return isStorageAvailable(window[kind])
  } catch {
    return false
  }
}
