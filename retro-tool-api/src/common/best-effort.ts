import { Logger } from '@nestjs/common';

const logger = new Logger('BestEffortOperation');

export function reportBestEffortFailure(
  operation: string,
): (error: unknown) => void {
  return (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`${operation} failed: ${message}`);
  };
}
