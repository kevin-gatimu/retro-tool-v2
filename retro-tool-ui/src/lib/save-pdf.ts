import type { jsPDF } from 'jspdf'

/**
 * Minimal typing for the File System Access API — it isn't in the default DOM
 * lib. Only the bits we use are declared.
 */
interface SaveFilePickerOptions {
  suggestedName?: string
  types?: {
    description?: string
    accept: Record<string, string[]>
  }[]
}
interface FileSystemWritableStream {
  write: (data: Blob) => Promise<void>
  close: () => Promise<void>
}
interface FileSystemFileHandleLike {
  createWritable: () => Promise<FileSystemWritableStream>
}
type ShowSaveFilePicker = (
  options?: SaveFilePickerOptions,
) => Promise<FileSystemFileHandleLike>

function getSaveFilePicker(): ShowSaveFilePicker | null {
  const picker = (
    window as unknown as { showSaveFilePicker?: ShowSaveFilePicker }
  ).showSaveFilePicker
  return typeof picker === 'function' ? picker : null
}

/** Reliable named download via a temporary anchor — honors `filename` even
 *  when called after an `await` (unlike jsPDF's own `doc.save()`, which loses
 *  user activation and falls back to opening the blob as a UUID-named tab). */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  // Revoke on the next tick so the click has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Saves a generated jsPDF document. Prefers the native "Save as" dialog (File
 * System Access API) so the user picks the location and name; falls back to a
 * standard named download when the picker is unavailable or activation has
 * lapsed. Returns the filename used, or `null` if the user cancelled the
 * picker.
 */
export async function savePdf(
  doc: jsPDF,
  filename: string,
): Promise<string | null> {
  const blob = doc.output('blob')
  const picker = getSaveFilePicker()

  if (picker) {
    try {
      const handle = await picker({
        suggestedName: filename,
        types: [
          {
            description: 'PDF document',
            accept: { 'application/pdf': ['.pdf'] },
          },
        ],
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return filename
    } catch (error) {
      // User cancelled the dialog — treat as a no-op, not an error.
      if (error instanceof DOMException && error.name === 'AbortError') {
        return null
      }
      // Any other failure (e.g. activation lost) → fall through to download.
    }
  }

  downloadBlob(blob, filename)
  return filename
}
