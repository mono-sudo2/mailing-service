import { ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { MailService } from './../src/mail/mail.service';

describe('MailController (e2e)', () => {
  const send = jest.fn().mockResolvedValue({ status: 'success' });
  const templateId = '550e8400-e29b-41d4-a716-446655440000';

  async function createApp(): Promise<INestApplication<App>> {
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

    const application = moduleFixture.createNestApplication();
    application.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await application.init();
    return application;
  }

  describe('without MAIL_SERVICE_API_KEY', () => {
    let app: INestApplication<App>;

    beforeEach(async () => {
      delete process.env.MAIL_SERVICE_API_KEY;
      app = await createApp();
    });

    afterEach(async () => {
      await app.close();
    });

    it('/mail/send/:templateId (POST) rejects invalid body', () => {
      return request(app.getHttpServer())
        .post(`/mail/send/${templateId}`)
        .send({})
        .expect(400);
    });

    it('/mail/send/:templateId (POST) forwards to MailService', async () => {
      const body = {
        to: 'one@example.com',
        subject: 'Hi',
        variables: { name: 'Test' },
      };

      await request(app.getHttpServer())
        .post(`/mail/send/${templateId}`)
        .send(body)
        .expect(201);

      expect(send).toHaveBeenCalledWith(
        templateId,
        expect.objectContaining({
          to: ['one@example.com'],
          subject: body.subject,
          variables: body.variables,
        }),
      );
    });
  });

  describe('with MAIL_SERVICE_API_KEY', () => {
    let app: INestApplication<App>;

    beforeEach(async () => {
      process.env.MAIL_SERVICE_API_KEY = 'e2e-secret';
      app = await createApp();
    });

    afterEach(async () => {
      delete process.env.MAIL_SERVICE_API_KEY;
      await app.close();
    });

    it('returns 401 without API key', () => {
      return request(app.getHttpServer())
        .post(`/mail/send/${templateId}`)
        .send({
          to: 'one@example.com',
          subject: 'Hi',
          variables: {},
        })
        .expect(401);
    });

    it('returns 201 with X-API-Key', () => {
      return request(app.getHttpServer())
        .post(`/mail/send/${templateId}`)
        .set('X-API-Key', 'e2e-secret')
        .send({
          to: 'one@example.com',
          subject: 'Hi',
          variables: {},
        })
        .expect(201);
    });
  });
});
