import { Transform } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

function toEmailArray(value: unknown): string[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string');
  }
  if (typeof value === 'string') {
    return [value];
  }
  return [];
}

function toOptionalEmailArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const arr = toEmailArray(value);
  return arr.length ? arr : undefined;
}

export class SendMailDto {
  @Transform(({ value }) => toEmailArray(value))
  @IsArray()
  @ArrayNotEmpty()
  @IsEmail({}, { each: true })
  to!: string[];

  @IsString()
  subject!: string;

  @IsObject()
  variables!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @Transform(({ value }) => toOptionalEmailArray(value))
  @IsArray()
  @IsEmail({}, { each: true })
  cc?: string[];

  @IsOptional()
  @Transform(({ value }) => toOptionalEmailArray(value))
  @IsArray()
  @IsEmail({}, { each: true })
  bcc?: string[];
}
