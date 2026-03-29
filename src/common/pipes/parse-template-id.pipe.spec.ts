import { BadRequestException } from '@nestjs/common';
import { ParseTemplateIdPipe } from './parse-template-id.pipe';

describe('ParseTemplateIdPipe', () => {
  const pipe = new ParseTemplateIdPipe();

  it('accepts UUID v4', () => {
    expect(
      pipe.transform('550e8400-e29b-41d4-a716-446655440000', {
        type: 'param',
        metatype: String,
        data: 'templateId',
      }),
    ).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('accepts UUID v7-shaped ids', () => {
    const v7 = '018f1234-5678-7abc-8def-123456789abc';
    expect(
      pipe.transform(v7, {
        type: 'param',
        metatype: String,
        data: 'templateId',
      }),
    ).toBe(v7);
  });

  it('rejects non-UUID strings', () => {
    expect(() =>
      pipe.transform('not-a-uuid', {
        type: 'param',
        metatype: String,
        data: 'templateId',
      }),
    ).toThrow(BadRequestException);
  });
});
