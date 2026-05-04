import { generateKeyPairSync } from "node:crypto";

const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
  privateKeyEncoding: { type: "pkcs8", format: "der" },
  publicKeyEncoding: { type: "spki", format: "der" }
});

console.log("SIGNING_PRIVATE_KEY_PKCS8_B64=" + privateKey.toString("base64"));
console.log("SIGNING_PUBLIC_KEY_SPKI_B64=" + publicKey.toString("base64"));
