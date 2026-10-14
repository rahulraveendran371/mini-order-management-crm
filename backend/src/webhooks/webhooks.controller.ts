
import {
  Controller,
  Post,
  Req,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { OrdersService } from '../orders/orders.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('orders-create')
  async handleOrderCreated(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-shopify-hmac-sha256') hmac: string,
  ) {
    const secret = process.env.SHOPIFY_CLIENT_SECRET;
    const rawBody = req.rawBody;

    if (!secret || !hmac || !rawBody) {
      throw new UnauthorizedException('Invalid Shopify webhook');
    }

    const digest = createHmac('sha256', secret)
      .update(rawBody)
      .digest('base64');

    const expected = Buffer.from(digest);
    const received = Buffer.from(hmac);

    if (
      expected.length !== received.length ||
      !timingSafeEqual(expected, received)
    ) {
      throw new UnauthorizedException(
        'Webhook signature verification failed',
      );
    }

    let order: any;

    try {
      order = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new UnauthorizedException('Invalid webhook JSON');
    }

    await this.ordersService.saveShopifyWebhookOrder(order);

    return { received: true };
  }
}

