export type JsonRecord = Record<string, unknown>;

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function jsonResponse(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export async function readJsonBody<T>(request: Request): Promise<T> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new HttpError(400, "BAD_REQUEST", "content-type must be application/json");
  }
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, "BAD_REQUEST", "invalid json body");
  }
}

export function getClientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") || "0.0.0.0";
}

export function isValidUuid(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

export function isSafeVersion(value: string): boolean {
  return /^[0-9A-Za-z._-]{1,64}$/.test(value);
}

export function randomLicenseKey(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const parts: string[] = [];
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  for (let i = 0; i < 4; i += 1) {
    let part = "";
    for (let j = 0; j < 5; j += 1) {
      part += alphabet[bytes[i * 5 + j] % alphabet.length];
    }
    parts.push(part);
  }
  return parts.join("-");
}

export class HttpError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export class Base64DecodeError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export function toBase64Url(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function fromBase64Url(input: string): Uint8Array {
  if (typeof input !== "string") {
    throw new Base64DecodeError("missing base64url input");
  }
  const compact = input.trim().replace(/\s+/g, "");
  if (!/^[A-Za-z0-9_-]*$/.test(compact)) {
    throw new Base64DecodeError("invalid base64url characters");
  }
  const normalized = compact.replace(/-/g, "+").replace(/_/g, "/");
  if (normalized.length % 4 === 1) {
    throw new Base64DecodeError("invalid base64url length");
  }
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  let binary = "";
  try {
    binary = atob(padded);
  } catch {
    throw new Base64DecodeError("invalid base64url payload");
  }
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export function fromBase64(input: string): Uint8Array {
  if (typeof input !== "string") {
    throw new Base64DecodeError("missing base64 input");
  }
  const compact = input.trim().replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(compact)) {
    throw new Base64DecodeError("invalid base64 characters");
  }
  if (compact.length % 4 !== 0) {
    throw new Base64DecodeError("invalid base64 length");
  }
  let binary = "";
  try {
    binary = atob(compact);
  } catch {
    throw new Base64DecodeError("invalid base64 payload");
  }
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const chunks = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`);
  return `{${chunks.join(",")}}`;
}
