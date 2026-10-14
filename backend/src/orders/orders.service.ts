
import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
    const domain = process.env.SHOPIFY_STORE_DOMAIN;
    const clientId = process.env.SHOPIFY_CLIENT_ID;
    const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

    if (!domain || !clientId || !clientSecret) {
      throw new InternalServerErrorException(
        'Shopify environment variables are missing',
      );
    }

    try {
      const tokenResponse = await fetch(
        `https://${domain}/admin/oauth/access_token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
          }),
        },
      );

      if (!tokenResponse.ok) {
        throw new Error('Shopify authentication failed');
      }

      const tokenData = await tokenResponse.json();

      const ordersResponse = await fetch(
        `https://${domain}/admin/api/2026-10/orders.json?status=any&limit=50`,
        {
          headers: {
            'X-Shopify-Access-Token': tokenData.access_token,
          },
        },
      );

      if (!ordersResponse.ok) {
        throw new Error('Shopify orders request failed');
      }

      const data = await ordersResponse.json();
      let synced = 0;

      for (const order of data.orders ?? []) {
        await this.saveShopifyWebhookOrder(order);
        synced++;
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

  async saveShopifyWebhookOrder(shopifyOrder: any) {
    const customerName = shopifyOrder.customer
      ? [
          shopifyOrder.customer.first_name,
          shopifyOrder.customer.last_name,
        ]
          .filter(Boolean)
          .join(' ') || null
      : null;

    const orderData = {
      orderNumber: shopifyOrder.name ?? null,
      customerName,
      customerEmail:
        shopifyOrder.email ?? shopifyOrder.customer?.email ?? null,
      totalPrice: shopifyOrder.total_price,
      currency: shopifyOrder.currency || 'USD',
      financialStatus: shopifyOrder.financial_status ?? null,
      fulfillmentStatus: shopifyOrder.fulfillment_status ?? null,
    };

    return this.prisma.order.upsert({
      where: {
        shopifyOrderId: String(shopifyOrder.id),
      },
      create: {
        shopifyOrderId: String(shopifyOrder.id),
        ...orderData,
        items: {
          create: (shopifyOrder.line_items ?? []).map((item: any) => ({
            shopifyLineItemId: String(item.id),
            title: item.title,
            quantity: item.quantity,
            price: item.price,
          })),
        },
      },
      update: orderData,
    });
  }
}
