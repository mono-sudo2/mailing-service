import { ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { MailService } from './../src/mail/mail.service';

describe('MailController (e2e)', () => {
  let app: INestApplication<App>;
  const send = jest.fn().mockResolvedValue({ status: 'success' });

  beforeEach(async () => {
    process.env.SUPABASE_URL ??= 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role';
    process.env.POSTAL_BASE_URL ??= 'https://postal.test';
    process.env.POSTAL_API_KEY ??= 'test-postal-key';
    process.env.MAIL_FROM ??= 'Test <test@example.com>';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue({ send })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/mail/send (POST) rejects invalid body', () => {
    return request(app.getHttpServer()).post('/mail/send').send({}).expect(400);
  });

  it('/mail/send (POST) forwards to MailService', async () => {
    const body = {
      templateId: '550e8400-e29b-41d4-a716-446655440000',
      to: 'one@example.com',
      subject: 'Hi',
      variables: { name: 'Test' },
    };

    await request(app.getHttpServer())
      .post('/mail/send')
      .send(body)
      .expect(201);

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: body.templateId,
        to: ['one@example.com'],
        subject: body.subject,
        variables: body.variables,
      }),
    );
  });
});
