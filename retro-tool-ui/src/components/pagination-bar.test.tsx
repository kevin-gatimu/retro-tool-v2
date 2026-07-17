// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PaginationBar } from './pagination-bar'

function renderBar(
  overrides: Partial<Parameters<typeof PaginationBar>[0]> = {},
) {
  const onPageChange = vi.fn()
  const onPageSizeChange = vi.fn()
  const onRefresh = vi.fn()
  render(
    <PaginationBar
      page={2}
      totalPages={5}
      total={100}
      pageSize={12}
      isFetching={false}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      onRefresh={onRefresh}
      {...overrides}
    />,
  )
  return { onPageChange, onPageSizeChange, onRefresh }
}

describe('PaginationBar', () => {
  it('renders the current page/total summary', () => {
    renderBar()
    expect(screen.getByText(/Page 2 of 5/)).toBeTruthy()
    expect(screen.getByText(/100 templates/)).toBeTruthy()
  })

  it('navigates prev/next via the change handler', () => {
    const { onPageChange } = renderBar({ page: 2, totalPages: 5 })
    fireEvent.click(screen.getByRole('button', { name: /prev/i }))
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(onPageChange).toHaveBeenCalledWith(1)
    expect(onPageChange).toHaveBeenCalledWith(3)
  })

  it('disables Prev on the first page and Next on the last', () => {
    renderBar({ page: 1, totalPages: 3 })
    expect(screen.getByRole('button', { name: /prev/i })).toHaveProperty(
      'disabled',
      true,
    )
    expect(screen.getByRole('button', { name: /next/i })).toHaveProperty(
      'disabled',
      false,
    )
  })

  it('disables Refresh while fetching', () => {
    renderBar({ isFetching: true })
    expect(screen.getByRole('button', { name: /refresh/i })).toHaveProperty(
      'disabled',
      true,
    )
  })
})
