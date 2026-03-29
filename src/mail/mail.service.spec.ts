import { HttpService } from '@nestjs/axios';
import { BadGatewayException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import { SUPABASE_CLIENT } from './mail.constants';
import { MailService } from './mail.service';
import type { SendMailDto } from './dto/send-mail.dto';

describe('MailService', () => {
  let service: MailService;
  let httpPost: jest.Mock;

  const maybeSingle = jest.fn();

  const mockSupabase = {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle,
    })),
  };

  beforeEach(async () => {
    maybeSingle.mockReset();
    mockSupabase.from.mockClear();
    httpPost = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: SUPABASE_CLIENT,
          useValue: mockSupabase,
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              const map: Record<string, string> = {
                POSTAL_BASE_URL: 'https://postal.test',
                POSTAL_API_KEY: 'postal-key',
                MAIL_FROM: 'App <app@test.local>',
              };
              const v = map[key];
              if (!v) throw new Error(`missing ${key}`);
              return v;
            },
          },
        },
        {
          provide: HttpService,
          useValue: {
            post: httpPost,
          },
        },
      ],
    }).compile();

    service = module.get(MailService);
  });

  const baseDto: SendMailDto = {
    templateId: '550e8400-e29b-41d4-a716-446655440000',
    to: ['user@test.local'],
    subject: 'Hi {{name}}',
    variables: { name: 'Ada' },
  };

  it('loads template, compiles handlebars, sends to Postal', async () => {
    maybeSingle.mockResolvedValue({
      data: { html_content: '<p>Hello {{name}}</p>' },
      error: null,
    });

    httpPost.mockReturnValue(
      of({
        status: 200,
        data: { status: 'success', data: { message_id: 'mid-1' } },
      }),
    );

    const result = await service.send(baseDto);

    expect(mockSupabase.from).toHaveBeenCalledWith('templates');
    expect(httpPost).toHaveBeenCalledWith(
      'https://postal.test/api/v1/send/message',
      {
        to: ['user@test.local'],
        from: 'App <app@test.local>',
        subject: 'Hi Ada',
        html_body: '<p>Hello Ada</p>',
      },
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/json',
          'X-Server-API-Key': 'postal-key',
        },
      }),
    );
    expect(result).toEqual({
      status: 'success',
      data: { message_id: 'mid-1' },
    });
  });

  it('throws NotFoundException when template is missing', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(service.send(baseDto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(httpPost).not.toHaveBeenCalled();
  });

  it('throws BadGatewayException when Postal returns error status', async () => {
    maybeSingle.mockResolvedValue({
      data: { html_content: '<p>x</p>' },
      error: null,
    });

    httpPost.mockReturnValue(
      of({
        status: 200,
        data: { status: 'error', error: 'Invalid domain' },
      }),
    );

    await expect(service.send(baseDto)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('scopes by org_id when orgId is set', async () => {
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle,
    };
    mockSupabase.from.mockReturnValue(chain);
    maybeSingle.mockResolvedValue({
      data: { html_content: '<p></p>' },
      error: null,
    });
    httpPost.mockReturnValue(
      of({ status: 200, data: { status: 'success', data: {} } }),
    );

    await service.send({
      ...baseDto,
      orgId: '660e8400-e29b-41d4-a716-446655440001',
    });

    expect(chain.eq).toHaveBeenCalledWith(
      'id',
      '550e8400-e29b-41d4-a716-446655440000',
    );
    expect(chain.eq).toHaveBeenCalledWith(
      'org_id',
      '660e8400-e29b-41d4-a716-446655440001',
    );
  });
});
