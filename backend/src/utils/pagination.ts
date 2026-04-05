import type { PaginationInput, PaginatedResult } from '../models/transport.types'

export function createPagination(input: Partial<PaginationInput>): PaginationInput {
  const page = Math.max(1, Number(input.page ?? 1) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(input.pageSize ?? 20) || 20))

  return { page, pageSize }
}

export function rangeFromPagination({ page, pageSize }: PaginationInput) {
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  return { from, to }
}

export function toPaginatedResult<T>(data: T[], total: number, pagination: PaginationInput): PaginatedResult<T> {
  return {
    data,
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pagination.pageSize)),
    },
  }
}
