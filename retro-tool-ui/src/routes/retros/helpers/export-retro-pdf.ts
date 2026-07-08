import { jsPDF } from 'jspdf'
import type { RetroDetail } from '@/common/types/retros'
import { savePdf } from '@/lib/save-pdf'
import type { CarriedForwardItem } from '../types'

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
 * Builds and downloads a text-based (selectable) PDF of a completed retro —
 * per-column cards grouped by discussed / not discussed / carried forward,
 * discussion notes, and carried-forward items from the previous retro. Pure
 * client-side via jsPDF — no server round-trip.
 */
export function exportRetroPdf(
  retro: RetroDetail,
  previousCarriedItems: CarriedForwardItem[],
): Promise<string | null> {
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

  const divider = () => {
    ensureSpace(16)
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.5)
    doc.line(marginX, y, pageWidth - marginX, y)
    y += 16
  }

  const columns = retro.template.columns
  const allCards = retro.cards
  const discussedCards = allCards.filter((c) => c.isDiscussed)
  const carriedForwardCards = allCards.filter(
    (c) => !c.isDiscussed && c.isCarriedForward,
  )
  const undiscussedCards = allCards.filter(
    (c) => !c.isDiscussed && !c.isCarriedForward,
  )
  const totalVotes = allCards.reduce((sum, c) => sum + (c.voteCount ?? 0), 0)
  const totalComments = allCards.reduce((sum, c) => sum + c.comments.length, 0)
  const participantsCount = new Set(retro.participants.map((p) => p.userId))
    .size

  const cardContent = (card: RetroDetail['cards'][number]): string =>
    card.sourceContents && card.sourceContents.length > 1
      ? card.sourceContents.join(' · ')
      : card.content

  const writeCardGroup = (
    cards: RetroDetail['cards'],
    accent: [number, number, number],
  ) => {
    for (const col of columns) {
      const colCards = cards.filter((c) => c.columnId === col.id)
      if (colCards.length === 0) continue
      writeWrapped(`${col.emoji ? `${col.emoji} ` : ''}${col.name}`, {
        size: 10,
        style: 'bold',
        color: [100, 116, 139],
        gapAfter: 3,
      })
      for (const card of colCards) {
        ensureSpace(14)
        const [r, g, b] = accent
        doc.setFillColor(r, g, b)
        doc.rect(marginX, y - 8, 3, 11, 'F')
        writeWrapped(cardContent(card), {
          size: 10,
          indent: 10,
          gapAfter: 1,
        })
        const meta: string[] = []
        if ((card.voteCount ?? 0) > 0) meta.push(`${card.voteCount} votes`)
        if (card.comments.length > 0)
          meta.push(
            `${card.comments.length} comment${card.comments.length === 1 ? '' : 's'}`,
          )
        if (meta.length > 0) {
          writeWrapped(meta.join(' · '), {
            size: 9,
            color: [148, 163, 184],
            indent: 10,
            gapAfter: card.comments.length > 0 ? 2 : 6,
          })
        }
        for (const comment of card.comments) {
          writeWrapped(
            `${comment.author?.name ?? 'Unknown'}: ${comment.content}`,
            {
              size: 9,
              color: [100, 116, 139],
              indent: 18,
              gapAfter: 2,
            },
          )
        }
        if (card.comments.length > 0) y += 4
      }
    }
  }

  // ── Header ─────────────────────────────────────────────────────────────
  writeWrapped(retro.name, { size: 20, style: 'bold', gapAfter: 2 })
  const completedAt = retro.completedAt
    ? new Date(retro.completedAt).toLocaleString()
    : 'Completed'
  writeWrapped(`${retro.team.name}  ·  ${completedAt}`, {
    size: 11,
    color: [100, 116, 139],
    gapAfter: 6,
  })
  writeWrapped(
    `${participantsCount} participant${participantsCount === 1 ? '' : 's'}  ·  ${
      allCards.length
    } card${allCards.length === 1 ? '' : 's'}  ·  ${totalVotes} vote${
      totalVotes === 1 ? '' : 's'
    }  ·  ${totalComments} comment${totalComments === 1 ? '' : 's'}`,
    { size: 10, color: [100, 116, 139], gapAfter: 10 },
  )
  divider()

  // ── Discussed ────────────────────────────────────────────────────────────
  writeWrapped(`Discussed (${discussedCards.length})`, {
    size: 14,
    style: 'bold',
    gapAfter: 6,
  })
  if (discussedCards.length === 0) {
    writeWrapped('No cards were discussed.', {
      size: 10,
      style: 'italic',
      color: [148, 163, 184],
    })
  } else {
    writeCardGroup(discussedCards, [34, 197, 94])
  }
  divider()

  // ── Not discussed ─────────────────────────────────────────────────────────
  writeWrapped(`Not Discussed (${undiscussedCards.length})`, {
    size: 14,
    style: 'bold',
    gapAfter: 6,
  })
  if (undiscussedCards.length === 0) {
    writeWrapped('All cards were discussed.', {
      size: 10,
      style: 'italic',
      color: [148, 163, 184],
    })
  } else {
    writeCardGroup(undiscussedCards, [245, 158, 11])
  }

  // ── Carried forward ───────────────────────────────────────────────────────
  if (carriedForwardCards.length > 0) {
    divider()
    writeWrapped(`Carried Forward (${carriedForwardCards.length})`, {
      size: 14,
      style: 'bold',
      gapAfter: 6,
    })
    writeCardGroup(carriedForwardCards, [168, 85, 247])
  }

  // ── Carried from previous retro ───────────────────────────────────────────
  if (previousCarriedItems.length > 0) {
    divider()
    writeWrapped(
      `Carried From Previous Retro (${previousCarriedItems.length})`,
      { size: 14, style: 'bold', gapAfter: 6 },
    )
    for (const item of previousCarriedItems) {
      const text =
        (item.sourceContents?.length ?? 0) > 1
          ? item.sourceContents!.join(' · ')
          : item.title
      writeWrapped(text, { size: 10, indent: 10, gapAfter: 2 })
    }
  }

  // ── Footer on every page ───────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(148, 163, 184)
    doc.text('Retro-Tool · Retrospective', marginX, pageHeight - 24)
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth - marginX,
      pageHeight - 24,
      { align: 'right' },
    )
  }

  const safeName = retro.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const completedDate = retro.completedAt ? new Date(retro.completedAt) : null
  const dateStr =
    completedDate && !isNaN(completedDate.getTime())
      ? completedDate.toISOString().slice(0, 10)
      : 'report'
  return savePdf(doc, `retro-${safeName}-${dateStr}.pdf`)
}
