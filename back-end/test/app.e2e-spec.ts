import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import type { ApiResponse } from '../src/common/api-response';
import type { City } from '../src/data/schemas';

describe('Urbanity API (e2e)', () => {
  let app: INestApplication;
  let server: App;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    server = app.getHttpServer() as App;
  });

  it('allows admins to create and read cities', async () => {
    const createResponse = await request(server)
      .post('/cities')
      .set('role', 'admin')
      .send({
        name: 'Hyderabad',
        state: 'Telangana',
        country: 'India',
      })
      .expect(201)
      .expect(({ body }) => {
        const responseBody = body as ApiResponse<City>;

        expect(responseBody.success).toBe(true);
        expect(responseBody.data.id).toEqual(expect.any(String));
      });

    const createdCity = createResponse.body as ApiResponse<City>;

    await request(server)
      .get(`/cities/${createdCity.data.id}`)
      .set('role', 'citizen')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          success: true,
          data: {
            name: 'Hyderabad',
            state: 'Telangana',
          },
        });
      });
  });

  it('blocks users from mutating city records', async () => {
    await request(server)
      .post('/cities')
      .set('role', 'citizen')
      .send({
        name: 'Unauthorized city',
      })
      .expect(403);
  });

  it('validates request bodies', async () => {
    await request(server)
      .post('/cities')
      .set('role', 'admin')
      .send({
        name: '',
        unknownField: 'blocked by whitelist',
      })
      .expect(400);
  });

  afterEach(async () => {
    await app.close();
  });
});
