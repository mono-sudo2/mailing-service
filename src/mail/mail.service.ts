import { HttpService } from '@nestjs/axios';
import {
  BadGatewayException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SupabaseClient } from '@supabase/supabase-js';
import Handlebars from 'handlebars';
import { firstValueFrom } from 'rxjs';
import { SUPABASE_CLIENT } from './mail.constants';
import type { SendMailDto } from './dto/send-mail.dto';

type TemplateRow = {
  html_content: string;
};

@Injectable()
export class MailService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {}

  async send(dto: SendMailDto): Promise<unknown> {
    const row = await this.fetchTemplate(dto);
    const variables = dto.variables;
    const htmlBody = Handlebars.compile(row.html_content)(variables);
    const subject = Handlebars.compile(dto.subject)(variables);
    return this.sendPostal(dto, subject, htmlBody);
  }

  private async fetchTemplate(dto: SendMailDto): Promise<TemplateRow> {
    let query = this.supabase
      .from('templates')
      .select('html_content')
      .eq('id', dto.templateId);

    if (dto.orgId !== undefined) {
      query = query.eq('org_id', dto.orgId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    if (!data) {
      throw new NotFoundException('Template not found');
    }
    return data as TemplateRow;
  }

  private async sendPostal(
    dto: SendMailDto,
    subject: string,
    htmlBody: string,
  ): Promise<unknown> {
    const baseUrl = this.config
      .getOrThrow<string>('POSTAL_BASE_URL')
      .replace(/\/$/, '');
    const url = `${baseUrl}/api/v1/send/message`;

    const from = dto.from ?? this.config.getOrThrow<string>('MAIL_FROM');

    const payload: Record<string, unknown> = {
      to: dto.to,
      from,
      subject,
      html_body: htmlBody,
    };

    if (dto.cc?.length) {
      payload.cc = dto.cc;
    }
    if (dto.bcc?.length) {
      payload.bcc = dto.bcc;
    }

    const response = await firstValueFrom(
      this.http.post(url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Server-API-Key': this.config.getOrThrow<string>('POSTAL_API_KEY'),
        },
        validateStatus: () => true,
      }),
    );

    const body = response.data as {
      status?: string;
      data?: { message_id?: string; messages?: unknown };
      error?: string;
      errors?: string[];
    };

    if (response.status >= 400) {
      throw new BadGatewayException({
        message: 'Postal HTTP error',
        status: response.status,
        body,
      });
    }

    if (body?.status === 'error') {
      throw new BadGatewayException({
        message: body.error ?? 'Postal rejected the message',
        errors: body.errors,
      });
    }

    return body;
  }
}
