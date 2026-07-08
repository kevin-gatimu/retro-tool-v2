import { jsPDF } from 'jspdf'
import type { EstimateSession } from '@/common/types/estimates'
import { savePdf } from '@/lib/save-pdf'
import {
  closestTemplateLabel,
  formatTemplatePoint,
  getRoundDurationLabel,
} from './index'

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
 * Builds and downloads a text-based (selectable) PDF of a completed story
 * estimate session — per-round stories, stats, agreed points, and per-voter
 * votes. Pure client-side via jsPDF — no server round-trip. Prompts for a save
 * location when supported; returns the filename, or `null` if cancelled.
 */
export function exportEstimatePdf(
  session: EstimateSession,
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

  // ── Header ─────────────────────────────────────────────────────────────
  writeWrapped(session.name, { size: 20, style: 'bold', gapAfter: 2 })
  writeWrapped(`${session.team.name}  ·  Story Estimate Report`, {
    size: 11,
    color: [100, 116, 139],
    gapAfter: 6,
  })

  const uniqueParticipants = session.participants.filter(
    (p, i, arr) => arr.findIndex((x) => x.userId === p.userId) === i,
  )
  const totalVotes = session.rounds.reduce(
    (sum, round) => sum + round.votes.length,
    0,
  )
  writeWrapped(
    `${session.rounds.length} round${session.rounds.length === 1 ? '' : 's'}  ·  ${
      uniqueParticipants.length
    } participant${uniqueParticipants.length === 1 ? '' : 's'}  ·  ${totalVotes} vote${
      totalVotes === 1 ? '' : 's'
    }  ·  ${new Date(session.updatedAt).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })}`,
    { size: 10, color: [100, 116, 139], gapAfter: 10 },
  )
  if (session.sprintLink) {
    writeWrapped(`Sprint board: ${session.sprintLink}`, {
      size: 9,
      color: [79, 70, 229],
      gapAfter: 10,
    })
  }
  divider()

  // ── Rounds ──────────────────────────────────────────────────────────────
  if (session.rounds.length === 0) {
    writeWrapped('No round data recorded for this session.', {
      size: 10,
      style: 'italic',
      color: [148, 163, 184],
    })
  }

  for (const round of session.rounds) {
    ensureSpace(48)
    writeWrapped(`Round ${round.roundNumber} · Ticket ${round.ticketNumber}`, {
      size: 13,
      style: 'bold',
      gapAfter: 2,
    })

    if (round.storyName && round.storyName !== round.ticketNumber) {
      writeWrapped(round.storyName, {
        size: 11,
        color: [71, 85, 105],
        gapAfter: 2,
      })
    }
    if (round.storyDescription) {
      writeWrapped(round.storyDescription, {
        size: 10,
        color: [100, 116, 139],
        gapAfter: 2,
      })
    }
    if (round.storyLink) {
      writeWrapped(round.storyLink, {
        size: 9,
        color: [79, 70, 229],
        gapAfter: 4,
      })
    }

    const duration = getRoundDurationLabel(round)
    const rangeLabel =
      round.stats.min !== null && round.stats.max !== null
        ? `${formatTemplatePoint(round.stats.min, session.template)} – ${formatTemplatePoint(round.stats.max, session.template)}`
        : '—'
    const averageLabel =
      round.stats.average !== null
        ? `${round.stats.average}${(() => {
            const hint = closestTemplateLabel(
              round.stats.average,
              session.template,
            )
            return hint ? ` (~${hint})` : ''
          })()}`
        : '—'
    const agreed =
      round.agreedPoints !== null
        ? formatTemplatePoint(round.agreedPoints, session.template)
        : round.stats.average !== null
          ? formatTemplatePoint(round.stats.average, session.template)
          : '—'

    writeWrapped(
      `Votes: ${round.stats.votesCount}   ·   Average: ${averageLabel}   ·   Range: ${rangeLabel}${
        duration ? `   ·   Duration: ${duration}` : ''
      }`,
      { size: 10, color: [71, 85, 105], gapAfter: 3 },
    )
    writeWrapped(`Agreed Points: ${agreed}`, {
      size: 11,
      style: 'bold',
      color: [79, 70, 229],
      gapAfter: 6,
    })

    if (round.votes.length > 0) {
      writeWrapped('Votes', {
        size: 9,
        style: 'bold',
        color: [100, 116, 139],
        gapAfter: 3,
      })
      for (const vote of round.votes) {
        writeWrapped(
          `${vote.user.name}: ${formatTemplatePoint(vote.value, session.template)}`,
          { size: 10, color: [71, 85, 105], indent: 10, gapAfter: 2 },
        )
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
    doc.text('Retro-Tool · Story Estimate', marginX, pageHeight - 24)
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth - marginX,
      pageHeight - 24,
      { align: 'right' },
    )
  }

  const safeName = session.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const dateStr = new Date(session.updatedAt).toISOString().slice(0, 10)
  return savePdf(doc, `estimate-${safeName}-${dateStr}.pdf`)
}
