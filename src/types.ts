export type VerifyLicenseBody = {
  license?: string;
  licenseKey?: string;
  deviceId: string;
  appVersion: string;
  timestamp: number;
  nonce: string;
};

export type SignedVerifyResponse = {
  apiVersion: string;
  keyId: string;
  algorithm: "Ed25519";
  payload: {
    verdict: "ALLOW" | "DENY";
    reasonCode: string;
    serverTime: number;
    license: {
      id: number;
      status: string;
      expiresAt: number;
      boundDeviceId: string | null;
    } | null;
  };
  signature: string;
};
