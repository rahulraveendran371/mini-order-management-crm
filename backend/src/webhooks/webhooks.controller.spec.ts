import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { createHmac } from 'crypto';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { OrdersService } from '../orders/orders.service';
import { WebhooksController } from './webhooks.controller';

describe('WebhooksController', () => {
  let controller: WebhooksController;
  const originalWebhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
  const ordersService = {
    saveShopifyWebhookOrder: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    ordersService.saveShopifyWebhookOrder.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [
        {
          provide: OrdersService,
          useValue: ordersService,
        },
      ],
    }).compile();

    controller = module.get<WebhooksController>(WebhooksController);
    process.env.SHOPIFY_WEBHOOK_SECRET = 'webhook-secret';
  });

  afterEach(() => {
    jest.restoreAllMocks();

    if (originalWebhookSecret === undefined) {
      delete process.env.SHOPIFY_WEBHOOK_SECRET;
    } else {
      process.env.SHOPIFY_WEBHOOK_SECRET = originalWebhookSecret;
    }
  });

  it('accepts a valid HMAC calculated from the raw request body', async () => {
    const rawBody = Buffer.from(JSON.stringify({ id: 123 }));
    const hmac = createHmac('sha256', 'webhook-secret')
      .update(rawBody)
      .digest('base64');

    await expect(
      controller.handleOrderCreated(
        { rawBody } as RawBodyRequest<Request>,
        hmac,
      ),
    ).resolves.toEqual({ received: true });

    expect(ordersService.saveShopifyWebhookOrder).toHaveBeenCalledWith({
      id: 123,
    });
  });

  it('rejects invalid HMAC signatures without saving the order', async () => {
    const rawBody = Buffer.from(JSON.stringify({ id: 123 }));

    await expect(
      controller.handleOrderCreated(
        { rawBody } as RawBodyRequest<Request>,
        'invalid-signature',
      ),
    ).rejects.toThrow(UnauthorizedException);

    expect(ordersService.saveShopifyWebhookOrder).not.toHaveBeenCalled();
  });
});
