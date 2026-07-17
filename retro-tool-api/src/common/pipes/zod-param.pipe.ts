import {
  PipeTransform,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { ZodSchema } from 'zod';

/**
 * Validates a single route param or query value against a Zod schema. The
 * body-only `ZodValidationPipe` short-circuits params, so use this at the
 * param level: `@Param('token', new ZodParamPipe(tokenSchema))`.
 */
export class ZodParamPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    if (metadata.type !== 'param' && metadata.type !== 'query') {
      return value;
    }
    try {
      return this.schema.parse(value);
    } catch {
      throw new BadRequestException('Validation failed');
    }
  }
}
