
import { messagingApi, middleware } from '@line/bot-sdk';

export const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET!,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
};

export const client = new messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken!,
});