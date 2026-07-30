import type { Client } from './generated/client/index.js';
import { createClient } from './generated/client/index.js';
import { issueOAuth2Token } from './generated/sdk.gen.js';

const BASE_URL = 'https://openapi.tossinvest.com';
const EXPIRY_BUFFER_MS = 30_000;

export interface TossInvestClientOptions {
  clientId: string;
  clientSecret: string;
}

export type TossInvestClient = Client;

export function createTossInvestClient({
  clientId,
  clientSecret,
}: TossInvestClientOptions): TossInvestClient {
  if (!clientId.trim() || !clientSecret.trim()) {
    throw new TypeError('clientId and clientSecret are required');
  }

  const client = createClient({ baseUrl: BASE_URL });
  let cachedToken: { accessToken: string; expiresAt: number } | undefined;
  let issuingToken: Promise<string> | undefined;

  const issueToken = async (): Promise<string> => {
    const { data: token } = await issueOAuth2Token({
      body: {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
      },
      client,
      throwOnError: true,
    });

    if (!token.access_token || !Number.isFinite(token.expires_in) || token.expires_in <= 0) {
      throw new Error('Token endpoint returned an invalid response');
    }

    cachedToken = {
      accessToken: token.access_token,
      expiresAt: Date.now() + Math.max(0, token.expires_in * 1_000 - EXPIRY_BUFFER_MS),
    };
    return cachedToken.accessToken;
  };

  const getAccessToken = (): Promise<string> | string => {
    if (cachedToken && Date.now() < cachedToken.expiresAt) {
      return cachedToken.accessToken;
    }

    issuingToken ??= issueToken().finally(() => {
      issuingToken = undefined;
    });
    return issuingToken;
  };

  client.setConfig({ auth: getAccessToken });
  client.interceptors.error.use((error, response) => {
    if (response?.status === 401) {
      cachedToken = undefined;
    }
    return error;
  });

  return client;
}
