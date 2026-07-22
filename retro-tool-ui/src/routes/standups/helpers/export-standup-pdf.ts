import type { StandupEntryDetail } from '@/common/types/standups'
import { savePdf } from '@/lib/save-pdf'
import { formatEntryDate } from './index'

/**
 * jsPDF's standard fonts (helvetica) only support WinAnsi/Latin-1. A single
 * emoji or astral-plane codepoint forces jsPDF to emit the whole string as raw
 * UTF-16, which renders as garbled `&`-separated bytes. Keep only characters the
 * base font can draw so the rest of the line renders correctly.
 */
const EXTRA_ALLOWED = new Set([
  0x2013, // en dash
  0x2014, // em dash
  0x2018, // left single quote
  0x2019, // right single quote
  0x201c, // left double quote
  0x201d, // right double quote
  0x2022, // bullet
  0x2026, // ellipsis
])

function stripUnsupportedGlyphs(text: string): string {
  let out = ''
  for (const char of text) {
    const cp = char.codePointAt(0) ?? 0
    // Keep printable Latin-1 (helvetica-safe) plus a few common punctuation
    // marks; drop everything else (emoji, ZWJ, variation selectors, etc.).
    if ((cp >= 0x20 && cp <= 0xff) || EXTRA_ALLOWED.has(cp)) {
      out += char
    }
  }
  return out.replace(/[ \t]{2,}/g, ' ').trim()
}

// Public path to the brand logo, embedded in the PDF header.
const LOGO_URL = '/Retro-Tool-Logo.jpg'
const LOGO_SIZE = 40 // pt — rendered square in the header

// Best-effort fetch of the logo as a data URL for jsPDF.addImage. Returns null
// if the asset can't be loaded so the report still generates without it.
async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const response = await fetch(LOGO_URL)
    if (!response.ok) return null
    const blob = await response.blob()
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () =>
        resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

// Hex accent colors to RGB for the jsPDF question markers.
function hexToRgb(hex: string | null): [number, number, number] {
  if (!hex) return [148, 163, 184]
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!match) return [148, 163, 184]
  return [
    parseInt(match[1], 16),
    parseInt(match[2], 16),
    parseInt(match[3], 16),
  ]
}

/**
 * Builds and downloads a text-based (selectable) PDF of a standup day's
 * submissions. Pure client-side via jsPDF — no server round-trip. The brand
 * logo is embedded in the header when it can be loaded. Prompts for a save
 * location when the browser supports it; returns the saved filename, or `null`
 * if the user cancelled the save dialog.
 */
export async function exportStandupPdf(
  entryDetail: StandupEntryDetail,
): Promise<string | null> {
  const { standup, submissions, members, polls } = entryDetail
  // Load jsPDF on demand so the ~380 kB library stays out of the route chunk
  // and only downloads when the user actually exports.
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginX = 48
  const logoDataUrl = await loadLogoDataUrl()
  const headerTextWidth = logoDataUrl
    ? pageWidth - marginX * 2 - LOGO_SIZE - 14
    : pageWidth - marginX * 2
  const contentWidth = pageWidth - marginX * 2
  let y = 56

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 48) {
      doc.addPage()
      y = 56
    }
  }

  const writeWrapped = (
    text: string,
    options: {
      size?: number
      style?: 'normal' | 'bold' | 'italic'
      color?: [number, number, number]
      indent?: number
      gapAfter?: number
      maxWidth?: number
    } = {},
  ) => {
    const {
      size = 10,
      style = 'normal',
      color = [30, 41, 59],
      indent = 0,
      gapAfter = 4,
      maxWidth = contentWidth,
    } = options
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
    doc.setTextColor(color[0], color[1], color[2])
    const lines = doc.splitTextToSize(
      stripUnsupportedGlyphs(text),
      maxWidth - indent,
    ) as string[]
    const lineHeight = size * 1.35
    for (const line of lines) {
      ensureSpace(lineHeight)
      doc.text(line, marginX + indent, y)
      y += lineHeight
    }
    y += gapAfter
  }

  const divider = () => {
    ensureSpace(16)
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.5)
    doc.line(marginX, y, pageWidth - marginX, y)
    y += 16
  }

  // ── Header ─────────────────────────────────────────────────────────────
  if (logoDataUrl) {
    // Top-right, aligned with the title baseline.
    doc.addImage(
      logoDataUrl,
      'JPEG',
      pageWidth - marginX - LOGO_SIZE,
      y - 16,
      LOGO_SIZE,
      LOGO_SIZE,
    )
  }
  writeWrapped(standup.name, {
    size: 20,
    style: 'bold',
    gapAfter: 2,
    maxWidth: headerTextWidth,
  })
  writeWrapped(
    `${standup.team.name}  ·  ${formatEntryDate(entryDetail.date)}`,
    {
      size: 11,
      color: [100, 116, 139],
      gapAfter: 6,
      maxWidth: headerTextWidth,
    },
  )

  const submittedCount = members.filter((m) => m.hasSubmitted).length
  writeWrapped(
    `${submittedCount}/${members.length} submitted  ·  ${submissions.length} update${
      submissions.length === 1 ? '' : 's'
    }${polls.length > 0 ? `  ·  ${polls.length} poll${polls.length === 1 ? '' : 's'}` : ''}`,
    {
      size: 10,
      color: [100, 116, 139],
      gapAfter: 10,
      maxWidth: headerTextWidth,
    },
  )
  // Keep content below the logo if the header text was shorter than the logo.
  if (logoDataUrl) y = Math.max(y, 56 - 16 + LOGO_SIZE + 10)
  divider()

  // ── Polls ──────────────────────────────────────────────────────────────
  if (polls.length > 0) {
    writeWrapped('Polls', { size: 14, style: 'bold', gapAfter: 6 })
    for (const poll of polls) {
      writeWrapped(poll.question, { size: 11, style: 'bold', gapAfter: 4 })
      for (const option of poll.options) {
        const pct =
          poll.totalVotes > 0
            ? Math.round((option.voteCount / poll.totalVotes) * 100)
            : 0
        writeWrapped(`${option.label} — ${pct}% (${option.voteCount})`, {
          size: 10,
          color: [71, 85, 105],
          indent: 14,
          gapAfter: 2,
        })
      }
      writeWrapped(
        `${poll.totalVotes} vote${poll.totalVotes === 1 ? '' : 's'}${
          poll.isAnonymous ? ' · anonymous' : ''
        }`,
        { size: 9, color: [148, 163, 184], indent: 14, gapAfter: 8 },
      )
    }
    divider()
  }

  // ── Submissions ────────────────────────────────────────────────────────
  writeWrapped('Updates', { size: 14, style: 'bold', gapAfter: 8 })

  if (submissions.length === 0) {
    writeWrapped('No updates were submitted for this day.', {
      size: 10,
      style: 'italic',
      color: [148, 163, 184],
    })
  }

  for (const submission of submissions) {
    ensureSpace(40)
    writeWrapped(submission.user.name, {
      size: 12,
      style: 'bold',
      gapAfter: 1,
    })
    writeWrapped(
      new Date(submission.updatedAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
      { size: 9, color: [148, 163, 184], gapAfter: 6 },
    )

    for (const question of standup.questions) {
      const answer = submission.answers.find(
        (a) => a.questionId === question.id,
      )
      if (!answer || !answer.content.trim()) continue

      // Accent marker for the question.
      const [r, g, b] = hexToRgb(question.color)
      ensureSpace(14)
      doc.setFillColor(r, g, b)
      doc.rect(marginX, y - 8, 3, 11, 'F')

      writeWrapped(question.prompt, {
        size: 10,
        style: 'bold',
        indent: 10,
        gapAfter: 2,
      })
      writeWrapped(answer.content, {
        size: 10,
        color: [71, 85, 105],
        indent: 10,
        gapAfter: 6,
      })
    }

    if (submission.comments.length > 0) {
      writeWrapped(`Comments (${submission.comments.length})`, {
        size: 9,
        style: 'bold',
        color: [100, 116, 139],
        gapAfter: 3,
      })
      for (const comment of submission.comments) {
        writeWrapped(`${comment.author.name}: ${comment.content}`, {
          size: 9,
          color: [100, 116, 139],
          indent: 10,
          gapAfter: 2,
        })
      }
      y += 4
    }

    divider()
  }

  // ── Footer on every page ───────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(148, 163, 184)
    doc.text('Retro-Tool · Standups', marginX, pageHeight - 24)
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth - marginX,
      pageHeight - 24,
      { align: 'right' },
    )
  }

  const safeName = standup.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const filename = `standup-${safeName}-${entryDetail.date}.pdf`
  return savePdf(doc, filename)
}
