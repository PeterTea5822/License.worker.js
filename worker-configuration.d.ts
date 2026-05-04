interface D1ResultMeta {
  duration?: number;
  changes?: number;
  last_row_id?: number;
}

interface D1RunResult {
  success: boolean;
  meta: D1ResultMeta;
}

interface D1AllResult<T = Record<string, unknown>> {
  success: boolean;
  results?: T[];
  meta: D1ResultMeta;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1AllResult<T>>;
  run(): Promise<D1RunResult>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface Env {
  LICENSE_DB: D1Database;
  API_VERSION: string;
  NONCE_WINDOW_SECONDS: string;
  PUBLIC_KEY_ID: string;
  SIGNING_PRIVATE_KEY_PKCS8_B64: string;
  SIGNING_PUBLIC_KEY_SPKI_B64: string;
  ORIGIN_ALLOWLIST?: string;
}
