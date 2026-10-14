
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface ShopifyCustomer {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

interface ShopifyLineItem {
  id?: string | number | null;
  title: string;
  quantity: number;
  price: string | number;
}

interface ShopifyOrder {
  id: string | number;
  name?: string | null;
  email?: string | null;
  customer?: ShopifyCustomer | null;
  total_price: string | number;
  currency?: string | null;
  financial_status?: string | null;
  fulfillment_status?: string | null;
  line_items?: ShopifyLineItem[] | null;
  created_at?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringOrNumber(value: unknown): value is string | number {
  return (
    (typeof value === 'string' && value.trim().length > 0) ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

function isOptionalString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === 'string';
}

function isShopifyLineItem(value: unknown): value is ShopifyLineItem {
  return (
    isRecord(value) &&
    (value.id === undefined ||
      value.id === null ||
      isStringOrNumber(value.id)) &&
    typeof value.title === 'string' &&
    typeof value.quantity === 'number' &&
    Number.isInteger(value.quantity) &&
    value.quantity >= 0 &&
    isStringOrNumber(value.price) &&
    Number.isFinite(Number(value.price))
  );
}

function isShopifyOrder(value: unknown): value is ShopifyOrder {
  if (
    !isRecord(value) ||
    !isStringOrNumber(value.id) ||
    !isStringOrNumber(value.total_price) ||
    !Number.isFinite(Number(value.total_price)) ||
    !isOptionalString(value.name) ||
    !isOptionalString(value.email) ||
    !isOptionalString(value.currency) ||
    !isOptionalString(value.financial_status) ||
    !isOptionalString(value.fulfillment_status)
  ) {
    return false;
  }

  if (
    value.customer !== undefined &&
    value.customer !== null &&
    (!isRecord(value.customer) ||
      !isOptionalString(value.customer.first_name) ||
      !isOptionalString(value.customer.last_name) ||
      !isOptionalString(value.customer.email))
  ) {
    return false;
  }

  if (
    value.line_items !== undefined &&
    value.line_items !== null &&
    (!Array.isArray(value.line_items) ||
      !value.line_items.every(isShopifyLineItem))
  ) {
    return false;
  }

  return (
    value.created_at === undefined ||
    (typeof value.created_at === 'string' &&
      Number.isFinite(Date.parse(value.created_at)))
  );
}

function getNextPageUrl(
  linkHeader: string | null,
  expectedOrigin: string,
  expectedPath: string,
): string | undefined {
  const nextLink = linkHeader
    ?.split(',')
    .find((link) => /(?:^|;)\s*rel="?next"?\s*(?:;|$)/i.test(link));

  if (!nextLink) {
    return undefined;
  }

  const match = /<([^>]+)>/.exec(nextLink);
  if (!match) {
    throw new Error('Shopify returned an invalid pagination link');
  }

  const nextUrl = new URL(match[1]);
  if (nextUrl.origin !== expectedOrigin || nextUrl.pathname !== expectedPath) {
    throw new Error('Shopify returned an unexpected pagination URL');
  }

  return nextUrl.toString();
}

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.order.findMany({
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return order;
  }

  async syncFromShopify() {
    const domain = process.env.SHOPIFY_STORE_DOMAIN?.trim();
    const clientId = process.env.SHOPIFY_CLIENT_ID;
    const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

    if (!domain || !clientId || !clientSecret) {
      throw new InternalServerErrorException(
        'Shopify environment variables are missing',
      );
    }

    if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(domain)) {
      throw new InternalServerErrorException(
        'SHOPIFY_STORE_DOMAIN must be a valid myshopify.com domain',
      );
    }

    try {
      const storeOrigin = `https://${domain}`;
      const tokenResponse = await fetch(`${storeOrigin}/admin/oauth/access_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error(
          `Shopify authentication failed with HTTP ${tokenResponse.status}`,
        );
      }

      const tokenData: unknown = await tokenResponse.json();
      const accessToken =
        isRecord(tokenData) && typeof tokenData.access_token === 'string'
          ? tokenData.access_token
          : '';
      if (!accessToken) {
        throw new Error(
          'Shopify authentication response did not include an access token',
        );
      }

      const apiVersion = '2026-10';
      const ordersUrl = new URL(
        `/admin/api/${apiVersion}/orders.json`,
        storeOrigin,
      );
      ordersUrl.searchParams.set('status', 'any');
      ordersUrl.searchParams.set('limit', '250');

      let nextPageUrl: string | undefined = ordersUrl.toString();
      let synced = 0;
      const visitedPages = new Set<string>();

      while (nextPageUrl) {
        if (visitedPages.has(nextPageUrl)) {
          throw new Error('Shopify returned a repeated pagination link');
        }
        visitedPages.add(nextPageUrl);

        const ordersResponse = await fetch(nextPageUrl, {
          headers: {
            'X-Shopify-Access-Token': accessToken,
          },
        });

        if (!ordersResponse.ok) {
          throw new Error(
            `Shopify orders request failed with HTTP ${ordersResponse.status}`,
          );
        }

        const data: unknown = await ordersResponse.json();
        if (!isRecord(data) || !Array.isArray(data.orders)) {
          throw new Error('Shopify orders response had an invalid format');
        }

        for (const order of data.orders) {
          await this.saveShopifyWebhookOrder(order);
          synced++;
        }

        nextPageUrl = getNextPageUrl(
          ordersResponse.headers.get('link'),
          storeOrigin,
          ordersUrl.pathname,
        );
      }

      return {
        message: 'Shopify order sync completed',
        synced,
      };
    } catch (error) {
      console.error('Shopify sync error:', error);
      throw new InternalServerErrorException(
        'Shopify order sync failed. Check backend logs.',
      );
    }
  }

  async saveShopifyWebhookOrder(payload: unknown) {
    if (!isShopifyOrder(payload)) {
      throw new BadRequestException('Invalid Shopify order payload');
    }

    const shopifyOrder = payload;
    const customerName = shopifyOrder.customer
      ? [
          shopifyOrder.customer.first_name,
          shopifyOrder.customer.last_name,
        ]
          .filter(Boolean)
          .join(' ') || null
      : null;

    const items = (shopifyOrder.line_items ?? []).map((item: any) => ({
      shopifyLineItemId: item.id != null ? String(item.id) : null,
      title: item.title,
      quantity: item.quantity,
      price: item.price,
    }));

    const orderData = {
      orderNumber: shopifyOrder.name ?? null,
      customerName,
      customerEmail:
        shopifyOrder.email ?? shopifyOrder.customer?.email ?? null,
      totalPrice: shopifyOrder.total_price,
      currency: shopifyOrder.currency || 'INR',
      financialStatus: shopifyOrder.financial_status ?? null,
      fulfillmentStatus: shopifyOrder.fulfillment_status ?? null,
      ...(shopifyOrder.created_at
        ? { createdAt: new Date(shopifyOrder.created_at) }
        : {}),
    };

    return this.prisma.order.upsert({
      where: {
        shopifyOrderId: String(shopifyOrder.id),
      },
      create: {
        shopifyOrderId: String(shopifyOrder.id),
        ...orderData,
        items: {
          create: items,
        },
      },
      update: {
        ...orderData,
        items: {
          deleteMany: {},
          create: items,
        },
      },
    });
  }
}
