import { savePdf } from '@/lib/save-pdf'

export interface ReportPdfSection {
  heading: string
  /** simple label/value rows or a table with headers */
  rows?: Array<[string, string | number]>
  table?: {
    headers: string[]
    rows: Array<Array<string | number>>
  }
}

/**
 * Text-based (selectable) PDF export for a dashboard — KPIs and tables, no
 * chart rasterization. jsPDF loads on demand so it stays out of the route
 * chunk (same pattern as the retro/estimate exports).
 */
export async function exportReportPdf(
  title: string,
  rangeLabel: string,
  sections: ReportPdfSection[],
): Promise<string | null> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginX = 48
  let y = 56

  const ensureRoom = (needed: number) => {
    if (y + needed > pageHeight - 48) {
      doc.addPage()
      y = 56
    }
  }

  doc.setFont('helvetica', 'bold').setFontSize(18)
  doc.text(title, marginX, y)
  y += 20
  doc.setFont('helvetica', 'normal').setFontSize(10)
  doc.setTextColor(120)
  doc.text(rangeLabel, marginX, y)
  doc.setTextColor(0)
  y += 24

  for (const section of sections) {
    ensureRoom(40)
    doc.setFont('helvetica', 'bold').setFontSize(12)
    doc.text(section.heading, marginX, y)
    y += 16
    doc.setFont('helvetica', 'normal').setFontSize(10)

    for (const [label, value] of section.rows ?? []) {
      ensureRoom(14)
      doc.text(`${label}:`, marginX, y)
      doc.text(String(value), marginX + 220, y)
      y += 14
    }

    if (section.table) {
      const columnWidth =
        (pageWidth - marginX * 2) / section.table.headers.length
      ensureRoom(16)
      doc.setFont('helvetica', 'bold')
      section.table.headers.forEach((header, index) => {
        doc.text(header, marginX + index * columnWidth, y)
      })
      y += 14
      doc.setFont('helvetica', 'normal')
      for (const row of section.table.rows) {
        ensureRoom(14)
        row.forEach((cell, index) => {
          doc.text(String(cell).slice(0, 40), marginX + index * columnWidth, y)
        })
        y += 14
      }
    }
    y += 12
  }

  const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`
  return savePdf(doc, filename)
}
