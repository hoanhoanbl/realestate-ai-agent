import { Module, ValidationPipe, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportBreakdownsService } from './report-breakdowns.service';

const url = process.env.FE33_TEST_DATABASE_URL;
(url ? describe : describe.skip)(
  'L4: real PostgreSQL and protected HTTP contract',
  () => {
    let db: DataSource, app: INestApplication, base: string;
    const originalSecret = process.env.WEBHOOK_SECRET;
    beforeAll(async () => {
      const target = new URL(url!);
      if (
        !['localhost', '127.0.0.1'].includes(target.hostname) ||
        target.port !== '55433' ||
        target.pathname !== '/fe33_test'
      )
        throw new Error('Chỉ dùng DB disposable localhost:55433/fe33_test');
      db = new DataSource({
        type: 'postgres',
        url,
        extra: { options: '-c search_path=l4_report_test' },
      });
      await db.initialize();
      await db.query(`CREATE SCHEMA IF NOT EXISTS l4_report_test;
      CREATE TABLE users(id int,name text,role text);
      CREATE TABLE properties(id int,name text,status text);
      CREATE TABLE leads(id int,status text,assigned_user_id int,assigned_at timestamptz,response_due_at timestamptz,first_response_at timestamptz);
      CREATE TABLE lead_events(id int,lead_id int,type text,note text,created_at timestamptz);
      CREATE TABLE viewings(id int,lead_id int,property_id int,viewing_time timestamptz,status text);
      CREATE TABLE feedbacks(id int,lead_id int,token text,submitted_at timestamptz,rating int,interest text,comment text);
      CREATE TABLE contracts(id int,lead_id int,property_id int,created_at timestamptz,signed_at timestamptz);
      INSERT INTO users VALUES(1,'Minh','SALE'),(2,'An','SALE');
      INSERT INTO properties VALUES(10,'Căn A','AVAILABLE'),(20,'Căn B','AVAILABLE');
      INSERT INTO leads VALUES(100,'VIEWED',2,'2026-10-05 09:00+07','2026-10-05 11:00+07','2026-10-05 10:00+07');
      INSERT INTO lead_events VALUES(1,100,'LEAD_ASSIGNED','1 (Minh)','2026-10-01 09:00+07'),(2,100,'LEAD_REASSIGNED','1 -> 2 (An)','2026-10-05 09:00+07');
      INSERT INTO viewings VALUES(1,100,10,'2026-10-02 09:00+07','ATTENDED'),(2,100,20,'2026-10-06 09:00+07','ATTENDED');
      INSERT INTO feedbacks VALUES(1,100,'v1_abcdef','2026-10-07 09:00+07',2,'OTHER','Giá cao'),(2,100,'legacy_hex','2026-10-07 10:00+07',4,'OTHER',null),(3,100,'v99_missing','2026-10-07 11:00+07',1,'NONE',null),(4,100,'v2_abcd','2026-10-07 12:00+07',5,'DEPOSIT',null);
      INSERT INTO contracts VALUES(1,100,20,'2026-10-06 10:00+07','2026-10-07 10:00+07');`);
      process.env.WEBHOOK_SECRET = 'l4-disposable-test-secret';
      @Module({
        imports: [JwtModule.register({ secret: 'l4-disposable-jwt' })],
        controllers: [ReportsController],
        providers: [
          { provide: ReportsService, useValue: {} },
          {
            provide: ReportBreakdownsService,
            useValue: new ReportBreakdownsService(db),
          },
        ],
      })
      class TestModule {}
      app = await NestFactory.create(TestModule, { logger: false });
      app.setGlobalPrefix('api');
      app.useGlobalPipes(
        new ValidationPipe({ transform: true, whitelist: true }),
      );
      await app.listen(0, '127.0.0.1');
      base = await app.getUrl();
    });
    afterAll(async () => {
      await app?.close();
      if (db?.isInitialized) {
        await db.query('DROP SCHEMA l4_report_test CASCADE');
        await db.destroy();
      }
      if (originalSecret === undefined) delete process.env.WEBHOOK_SECRET;
      else process.env.WEBHOOK_SECRET = originalSecret;
    });
    const request = (body: unknown, secret?: string) =>
      fetch(base + '/api/reports/breakdowns', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(secret ? { 'X-Webhook-Secret': secret } : {}),
        },
        body: JSON.stringify(body),
      });
    const period = {
      periodStart: '2026-10-01T00:00:00+07:00',
      periodEnd: '2026-10-08T00:00:00+07:00',
    };
    it('rejects missing/wrong webhook secrets before releasing data', async () => {
      expect((await request(period)).status).toBe(401);
      expect((await request(period, 'wrong')).status).toBe(401);
    });
    it('maps prefixed and legacy feedback to the right property, without exposing tokens', async () => {
      const response = await request(period, process.env.WEBHOOK_SECRET);
      expect(response.status).toBe(201);
      const result = await response.json();
      expect(
        result.properties.find((p: any) => p.propertyId === 10),
      ).toMatchObject({
        feedbackCount: 2,
        averageRating: 3,
        interestedCustomers: 0,
      });
      expect(
        result.properties.find((p: any) => p.propertyId === 20),
      ).toMatchObject({
        feedbackCount: 1,
        averageRating: 5,
        interestedCustomers: 1,
        signedContracts: 1,
      });
      expect(result.sales.find((s: any) => s.userId === 1).viewedLeads).toBe(1);
      expect(result.sales.find((s: any) => s.userId === 2)).toMatchObject({
        viewedLeads: 1,
        signedLeads: 1,
        respondedOnTime: 1,
      });
      expect(result.dataQuality.unmappedFeedbacks).toBe(1);
      expect(JSON.stringify(result)).not.toMatch(
        /abcdef|legacy_hex|Giá cao|password/i,
      );
    });
    it('validates dates, interval direction, max span and future periods', async () => {
      for (const body of [
        {},
        { ...period, periodStart: 'bad' },
        { periodStart: period.periodEnd, periodEnd: period.periodStart },
        { periodStart: '2025-01-01', periodEnd: '2026-10-01' },
        { periodStart: '2099-01-01', periodEnd: '2099-01-08' },
      ]) {
        expect((await request(body, process.env.WEBHOOK_SECRET)).status).toBe(
          400,
        );
      }
    });
  },
);
