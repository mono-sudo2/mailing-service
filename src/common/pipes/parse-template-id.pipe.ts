import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';

/** Accepts any RFC 4122-style UUID (versions 1–8 in the version nibble). */
const CANONICAL_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class ParseTemplateIdPipe implements PipeTransform<string, string> {
  transform(value: string, metadata: ArgumentMetadata): string {
    void metadata;
    if (typeof value !== 'string' || !CANONICAL_UUID.test(value)) {
      throw new BadRequestException(
        'templateId must be a canonical UUID string',
      );
    }
    return value;
  }
}
