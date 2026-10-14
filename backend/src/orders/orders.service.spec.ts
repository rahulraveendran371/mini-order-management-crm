import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';

describe('OrdersService', () => {
  let service: OrdersService;
  const originalShopifyEnv = {
    domain: process.env.SHOPIFY_STORE_DOMAIN,
    clientId: process.env.SHOPIFY_CLIENT_ID,
    clientSecret: process.env.SHOPIFY_CLIENT_SECRET,
  };
  const prisma = {
    order: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.order.upsert.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  afterEach(() => {
    jest.restoreAllMocks();

    if (originalShopifyEnv.domain === undefined) {
      delete process.env.SHOPIFY_STORE_DOMAIN;
    } else {
      process.env.SHOPIFY_STORE_DOMAIN = originalShopifyEnv.domain;
    }

    if (originalShopifyEnv.clientId === undefined) {
      delete process.env.SHOPIFY_CLIENT_ID;
    } else {
      process.env.SHOPIFY_CLIENT_ID = originalShopifyEnv.clientId;
    }

    if (originalShopifyEnv.clientSecret === undefined) {
      delete process.env.SHOPIFY_CLIENT_SECRET;
    } else {
      process.env.SHOPIFY_CLIENT_SECRET = originalShopifyEnv.clientSecret;
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('syncs all pages of Shopify orders and upserts each order', async () => {
    process.env.SHOPIFY_STORE_DOMAIN = 'example.myshopify.com';
    process.env.SHOPIFY_CLIENT_ID = 'client-id';
    process.env.SHOPIFY_CLIENT_SECRET = 'client-secret';

    const nextPageUrl =
      'https://example.myshopify.com/admin/api/2026-10/orders.json?limit=250&page_info=next';
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'access-token' })),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            orders: [
              {
                id: 101,
                total_price: '12.50',
                currency: 'USD',
                line_items: [
                  { id: 501, title: 'First item', quantity: 1, price: '12.50' },
                ],
              },
            ],
          }),
          {
            headers: { Link: `<${nextPageUrl}>; rel="next"` },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            orders: [
              {
                id: 102,
                total_price: '20.00',
                currency: 'USD',
                line_items: [],
              },
            ],
          }),
        ),
      );

    await expect(service.syncFromShopify()).resolves.toEqual({
      message: 'Shopify order sync completed',
      synced: 2,
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      nextPageUrl,
      expect.objectContaining({
        headers: { 'X-Shopify-Access-Token': 'access-token' },
      }),
    );
    expect(prisma.order.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.order.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { shopifyOrderId: '101' },
        create: expect.objectContaining({
          items: {
            create: [
              {
                shopifyLineItemId: '501',
                title: 'First item',
                quantity: 1,
                price: '12.50',
              },
            ],
          },
        }),
        update: expect.objectContaining({
          items: {
            deleteMany: {},
            create: [
              {
                shopifyLineItemId: '501',
                title: 'First item',
                quantity: 1,
                price: '12.50',
              },
            ],
          },
        }),
      }),
    );
  });

  it('rejects malformed Shopify order payloads before persistence', async () => {
    await expect(service.saveShopifyWebhookOrder({ id: 101 })).rejects.toThrow(
      BadRequestException,
    );

    expect(prisma.order.upsert).not.toHaveBeenCalled();
  });
});
