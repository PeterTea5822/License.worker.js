import { fromBase64, stableStringify, toBase64Url } from "./utils";

const encoder = new TextEncoder();

export async function signPayload(payload: unknown, env: Env): Promise<string> {
  const privateKeyBytes = fromBase64(env.SIGNING_PRIVATE_KEY_PKCS8_B64);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBytes as Uint8Array<ArrayBuffer>,
    { name: "Ed25519" },
    false,
    ["sign"]
  );
  const canonical = stableStringify(payload);
  const signature = await crypto.subtle.sign("Ed25519", key, encoder.encode(canonical));
  return toBase64Url(signature);
}
