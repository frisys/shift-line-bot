import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

/**
 * サーバー専用シークレットの取得ヘルパー。
 *
 * - ローカル開発 (.env) では process.env に直接値が入っているのでそれを使う。
 * - AWS Amplify本番環境では process.env に生の値を入れない運用のため、
 *   AWS Systems Manager Parameter Store (SecureString) から実行時に取得する。
 *   パラメータ名は `${envVarName}_SSM_PATH` で上書き可能。デフォルトは
 *   `/shift-line-bot/${envVarName}`。
 *
 * コールドスタート後はコンテナ内でメモリキャッシュされる（TTL付き）。
 */

const DEFAULT_PARAM_PREFIX = '/shift-line-bot';
const CACHE_TTL_MS = 5 * 60 * 1000;

let ssmClient: SSMClient | null = null;
function getSsmClient(): SSMClient {
  if (!ssmClient) {
    ssmClient = new SSMClient({});
  }
  return ssmClient;
}

const cache = new Map<string, { value: string; expiresAt: number }>();
const inFlight = new Map<string, Promise<string>>();

async function fetchFromParameterStore(paramName: string): Promise<string> {
  const cached = cache.get(paramName);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const existing = inFlight.get(paramName);
  if (existing) {
    return existing;
  }

  const promise = (async () => {
    try {
      const result = await getSsmClient().send(
        new GetParameterCommand({ Name: paramName, WithDecryption: true })
      );
      const value = result.Parameter?.Value;
      if (!value) {
        throw new Error(`SSMパラメータが空です: ${paramName}`);
      }
      cache.set(paramName, { value, expiresAt: Date.now() + CACHE_TTL_MS });
      return value;
    } finally {
      inFlight.delete(paramName);
    }
  })();

  inFlight.set(paramName, promise);
  return promise;
}

/**
 * サーバー専用シークレットを取得する。
 * ローカル開発では process.env[envVarName] があればそれを優先して使う。
 * 本番 (Amplify) では process.env に値がないため SSM Parameter Store から取得する。
 */
export async function getServerSecret(envVarName: string): Promise<string> {
  const direct = process.env[envVarName];
  if (direct) {
    return direct;
  }

  const paramName =
    process.env[`${envVarName}_SSM_PATH`] ?? `${DEFAULT_PARAM_PREFIX}/${envVarName}`;

  const value = await fetchFromParameterStore(paramName);
  return value;
}
