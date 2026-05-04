const encoder = new TextEncoder();

class Base64DecodeError extends Error {
  constructor(message) {
    super(message);
  }
}

function fromBase64Url(input) {
  const compact = String(input).trim().replace(/\s+/g, "");
  if (!/^[A-Za-z0-9_-]*$/.test(compact)) {
    throw new Base64DecodeError("invalid base64url characters");
  }
  const normalized = compact.replace(/-/g, "+").replace(/_/g, "/");
  if (normalized.length % 4 === 1) {
    throw new Base64DecodeError("invalid base64url length");
  }
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  let raw = "";
  try {
    raw = atob(padded);
  } catch {
    throw new Base64DecodeError("invalid base64url payload");
  }
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    out[i] = raw.charCodeAt(i);
  }
  return out;
}

function fromBase64(input) {
  const compact = String(input).trim().replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(compact) || compact.length % 4 !== 0) {
    throw new Base64DecodeError("invalid base64 data");
  }
  let raw = "";
  try {
    raw = atob(compact);
  } catch {
    throw new Base64DecodeError("invalid base64 payload");
  }
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    out[i] = raw.charCodeAt(i);
  }
  return out;
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

async function verifySignature(payload, signatureB64Url, publicKeySpkiB64) {
  const key = await crypto.subtle.importKey(
    "spki",
    fromBase64(publicKeySpkiB64),
    { name: "Ed25519" },
    false,
    ["verify"]
  );
  const data = encoder.encode(stableStringify(payload));
  return crypto.subtle.verify("Ed25519", key, fromBase64Url(signatureB64Url), data);
}

export async function verifyLicense({ endpoint, licenseKey, deviceId, appVersion, publicKey }) {
  if (!licenseKey || !deviceId || !appVersion || !publicKey) {
    return { ok: false, reasonCode: "BAD_INPUT", raw: { message: "missing required verify fields" } };
  }
  const body = {
    license: licenseKey,
    licenseKey,
    deviceId,
    appVersion,
    timestamp: Math.floor(Date.now() / 1000),
    nonce: crypto.randomUUID()
  };
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const result = await response.json();
  if (!response.ok) {
    return { ok: false, reasonCode: result.code || "UNKNOWN_ERROR", raw: result };
  }

  if (!result.payload || !result.signature) {
    return { ok: false, reasonCode: "BAD_RESPONSE", raw: result };
  }

  let signatureOk = false;
  try {
    signatureOk = await verifySignature(result.payload, result.signature, publicKey);
  } catch {
    return { ok: false, reasonCode: "BAD_SIGNATURE_FORMAT", raw: result };
  }
  if (!signatureOk) {
    return { ok: false, reasonCode: "BAD_SIGNATURE", raw: result };
  }

  if (result.payload.verdict !== "ALLOW") {
    return { ok: false, reasonCode: result.payload.reasonCode || "DENIED", raw: result };
  }

  return { ok: true, reasonCode: "OK", raw: result };
}
