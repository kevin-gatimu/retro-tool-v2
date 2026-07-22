// <reference types="vitest" />
// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StatCard } from '@/routes/reports/components/stat-card'
import { LeagueTable } from '@/routes/reports/components/league-table'
import { EmptyReportState } from '@/routes/reports/components/empty-report-state'
import {
  ReportLoadError,
  getReportLoadErrorMessage,
} from '@/routes/reports/components/report-load-error'
import { ApiError } from '@/lib/api'

interface Row {
  id: string
  name: string
  score: number
}

const rows: Row[] = [
  { id: '1', name: 'Alpha', score: 10 },
  { id: '2', name: 'Beta', score: 7 },
]

const columns = [
  {
    header: 'Name',
    render: (row: Row) => row.name,
    csv: (row: Row) => row.name,
  },
  {
    header: 'Score',
    align: 'right' as const,
    render: (row: Row) => row.score,
    csv: (row: Row) => row.score,
  },
]

describe('StatCard', () => {
  it('renders title, value, and hint', () => {
    render(<StatCard title="Attendance" value="82%" hint="12 of 15 retros" />)
    expect(screen.getByText('Attendance')).toBeTruthy()
    expect(screen.getByText('82%')).toBeTruthy()
    expect(screen.getByText('12 of 15 retros')).toBeTruthy()
  })
})

describe('EmptyReportState', () => {
  it('renders the message', () => {
    render(<EmptyReportState message="Nothing here yet." />)
    expect(screen.getByText('Nothing here yet.')).toBeTruthy()
  })
})

describe('ReportLoadError', () => {
  it('shows an access message only for forbidden responses', () => {
    render(
      <ReportLoadError
        error={new ApiError(403, 'Access denied')}
        reportName="platform report"
      />,
    )

    expect(
      screen.getByText(
        'You do not have permission to view the platform report.',
      ),
    ).toBeTruthy()
  })

  it('identifies an API version mismatch for missing report endpoints', () => {
    expect(
      getReportLoadErrorMessage({
        error: new ApiError(404, 'Not Found'),
        reportName: 'platform report',
      }),
    ).toContain('API and UI are running the same version')
  })

  it('preserves non-access errors for diagnosis', () => {
    expect(
      getReportLoadErrorMessage({
        error: new ApiError(500, 'Internal server error'),
        reportName: 'platform report',
      }),
    ).toBe('Could not load the platform report: Internal server error')
  })
})

describe('LeagueTable', () => {
  it('renders rows and headers', () => {
    render(
      <LeagueTable<Row>
        rows={rows}
        rowKey={(row) => row.id}
        columns={columns}
        emptyMessage="No rows."
      />,
    )
    expect(screen.getByText('Alpha')).toBeTruthy()
    expect(screen.getByText('Score')).toBeTruthy()
  })

  it('shows the empty message when there are no rows', () => {
    render(
      <LeagueTable<Row>
        rows={[]}
        rowKey={(row) => row.id}
        columns={columns}
        emptyMessage="No rows."
      />,
    )
    expect(screen.getByText('No rows.')).toBeTruthy()
  })

  it('pages forward through the pagination controls', () => {
    const onPageChange = vi.fn()
    render(
      <LeagueTable<Row>
        rows={rows}
        rowKey={(row) => row.id}
        columns={columns}
        emptyMessage="No rows."
        pagination={{ page: 1, pageSize: 2, total: 5, onPageChange }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(onPageChange).toHaveBeenCalledWith(2)
    expect(
      screen
        .getByRole('button', { name: 'Previous page' })
        .hasAttribute('disabled'),
    ).toBe(true)
  })

  it('propagates search input changes', () => {
    const onChange = vi.fn()
    render(
      <LeagueTable<Row>
        rows={rows}
        rowKey={(row) => row.id}
        columns={columns}
        emptyMessage="No rows."
        search={{ value: '', onChange, placeholder: 'Search teams…' }}
      />,
    )
    fireEvent.change(screen.getByPlaceholderText('Search teams…'), {
      target: { value: 'alp' },
    })
    expect(onChange).toHaveBeenCalledWith('alp')
  })
})
