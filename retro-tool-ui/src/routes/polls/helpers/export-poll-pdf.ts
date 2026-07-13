import { jsPDF } from 'jspdf'
import type { PollView } from '@/common/types/polls'
import { savePdf } from '@/lib/save-pdf'

/**
 * jsPDF's standard fonts (helvetica) only support WinAnsi/Latin-1. A single
 * emoji or astral-plane codepoint forces jsPDF to emit the whole string as raw
 * UTF-16, which renders as garbled bytes. Keep only characters the base font
 * can draw so the rest of the line renders correctly.
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
    if ((cp >= 0x20 && cp <= 0xff) || EXTRA_ALLOWED.has(cp)) {
      out += char
    }
  }
  return out.replace(/[ \t]{2,}/g, ' ').trim()
}

/**
 * Builds and downloads a text-based (selectable) PDF of a poll's results. Pure
 * client-side via jsPDF — no server round-trip. Shows per-option percentages
 * and counts, and (for non-anonymous polls) the voter names per option.
 * Prompts for a save location when the browser supports it; returns the saved
 * filename, or `null` if the user cancelled.
 */
export async function exportPollPdf(poll: PollView): Promise<string | null> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginX = 48
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
    } = {},
  ) => {
    const {
      size = 10,
      style = 'normal',
      color = [30, 41, 59],
      indent = 0,
      gapAfter = 4,
    } = options
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
    doc.setTextColor(color[0], color[1], color[2])
    const lines = doc.splitTextToSize(
      stripUnsupportedGlyphs(text),
      contentWidth - indent,
    ) as string[]
    const lineHeight = size * 1.35
    for (const line of lines) {
      ensureSpace(lineHeight)
      doc.text(line, marginX + indent, y)
      y += lineHeight
    }
    y += gapAfter
  }

  // ── Header ─────────────────────────────────────────────────────────────
  writeWrapped(poll.question, { size: 18, style: 'bold', gapAfter: 2 })
  writeWrapped(
    `${poll.team.name}  ·  ${poll.totalVotes} vote${
      poll.totalVotes === 1 ? '' : 's'
    }${poll.isAnonymous ? '  ·  Anonymous' : ''}`,
    { size: 11, color: [100, 116, 139], gapAfter: 6 },
  )

  ensureSpace(16)
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.5)
  doc.line(marginX, y, pageWidth - marginX, y)
  y += 16

  // ── Options ──────────────────────────────────────────────────────────────
  for (const option of poll.options) {
    const pct =
      poll.totalVotes > 0
        ? Math.round((option.voteCount / poll.totalVotes) * 100)
        : 0
    const label = option.emoji
      ? `${option.emoji} ${option.label}`
      : option.label
    writeWrapped(`${label} — ${pct}% (${option.voteCount})`, {
      size: 11,
      style: 'bold',
      gapAfter: option.voters.length > 0 ? 2 : 8,
    })
    if (!poll.isAnonymous && option.voters.length > 0) {
      writeWrapped(option.voters.map((voter) => voter.name).join(', '), {
        size: 9,
        color: [100, 116, 139],
        indent: 12,
        gapAfter: 8,
      })
    }
  }

  // ── Footer on every page ───────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(148, 163, 184)
    doc.text('Retro-Tool · Polls', marginX, pageHeight - 24)
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth - marginX,
      pageHeight - 24,
      {
        align: 'right',
      },
    )
  }

  const safeName = poll.question.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const dateStr = new Date().toISOString().slice(0, 10)
  return savePdf(doc, `poll-${safeName}-${dateStr}.pdf`)
}
