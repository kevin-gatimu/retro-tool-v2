import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { reportRangeSchema } from './report-range.dto';

/**
 * Range + SQL pagination/search for the league-table endpoints.
 * Pagination happens in SQL (`LIMIT/OFFSET` + `ILIKE`), never in memory.
 */
export const leagueQuerySchema = reportRangeSchema.and(
  z.object({
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(100).optional(),
  }),
);

export type LeagueQueryDto = z.infer<typeof leagueQuerySchema>;

export class LeagueQueryDtoClass {
  @ApiPropertyOptional({ default: 1 })
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  pageSize?: number;

  @ApiPropertyOptional({ description: 'Case-insensitive name filter' })
  search?: string;
}
