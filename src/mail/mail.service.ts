import { HttpService } from '@nestjs/axios';
import {
  BadGatewayException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
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
  subject: string;
};

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {}

  async send(templateId: string, dto: SendMailDto): Promise<unknown> {
    const row = await this.fetchTemplate(templateId);
    const variables = dto.variables;
    const htmlBody = Handlebars.compile(row.html_content)(variables);
    const subjectTemplate = dto.subject ?? row.subject;
    const subject = Handlebars.compile(subjectTemplate)(variables);
    return this.sendPostal(dto, subject, htmlBody);
  }

  private async fetchTemplate(templateId: string): Promise<TemplateRow> {
    const { data, error } = await this.supabase
      .from('templates')
      .select('html_content, subject')
      .eq('id', templateId)
      .maybeSingle();

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

    const body = response.data as Record<string, unknown> & {
      status?: string;
      data?: unknown;
      error?: string;
      errors?: unknown;
    };

    if (response.status >= 400) {
      this.logger.warn(
        `Postal HTTP ${response.status} from ${url}: ${JSON.stringify(body)}`,
      );
      throw new BadGatewayException({
        message: 'Postal HTTP error',
        status: response.status,
        postal: body,
      });
    }

    if (body?.status === 'error') {
      const summary =
        typeof body.error === 'string'
          ? body.error
          : 'Postal rejected the message';
      this.logger.warn(
        `Postal API returned status=error: ${JSON.stringify(body)}`,
      );
      throw new BadGatewayException({
        message: summary,
        postal: body,
      });
    }

    return body;
  }
}
