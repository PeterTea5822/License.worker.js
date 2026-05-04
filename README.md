# License.worker.js

> Cloudflare Worker + D1 软件许可证校验服务，Ed25519 签名，零依赖部署。
> A self-hosted license verification service on Cloudflare Workers + D1, with Ed25519 signed responses.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Deploy](https://img.shields.io/badge/Deploy-Cloudflare%20Workers-orange)](https://workers.cloudflare.com)

> **警告：** 100% 纯 Vibe Coding 项目，在用于生产环境前请自行确认！
>
> **警告：** `/admin` 默认无身份鉴权功能，请自行使用 Cloudflare Access 保护端点。

---

## Features / 特性

- Ed25519 签名响应，客户端可独立验签 / Ed25519 signed responses, client-side verification
- 单个许可证绑定 1 台设备 / Single device binding per license
- 版本白名单控制 / App version whitelist
- 防重放攻击（nonce + 时间窗口）/ Replay protection (nonce + timestamp window)
- 内置管理面板 (Dashboard) / Built-in admin dashboard
- 零依赖，仅需 Cloudflare 账号 / Zero dependencies, only a Cloudflare account needed

---

## Quick Start / 快速开始

### 1. Fork & Configure Secrets / Fork 并配置 Secrets

Fork 本仓库，然后在 GitHub repo **Settings > Secrets and variables > Actions** 中添加：

| Secret | Description / 说明 |
|--------|-------------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token (Workers 编辑权限) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |
| `SIGNING_PRIVATE_KEY_PKCS8_B64` | Ed25519 私钥 (base64 PKCS8) |
| `SIGNING_PUBLIC_KEY_SPKI_B64` | Ed25519 公钥 (base64 SPKI) |

生成密钥对：

```bash
node scripts/generate-secrets.mjs
```

`DATABASE_ID` / `DATABASE_ID_PREVIEW` **无需手动设置** — 首次部署时 workflow 会自动创建 D1 数据库并保存 ID。

### 2. Push to Deploy / 推送即部署

**Push to `main`** → 生产部署 / Production deploy

首次部署会自动：创建 D1 数据库 → 执行迁移 → 注入 Secrets → 部署 Worker。

### 3. 访问管理面板 / Access Dashboard

部署后访问 `https://<your-worker>.workers.dev/admin`。

---

### Optional: Preview Deploy / 可选：预览部署

默认不启用。如需在 PR 时自动部署预览环境：

1. 在 GitHub repo **Settings > Variables > Actions** 中添加 `ENABLE_PREVIEW`，值设为 `true`
2. 之后每个 Pull Request 将自动部署一个独立的预览 Worker

Preview disabled by default. To enable PR preview deployments:

1. Add variable `ENABLE_PREVIEW` = `true` in **Settings > Variables > Actions**
2. Each Pull Request will auto-deploy a preview Worker

---

## API Reference

### `POST /api/v1/license/verify`

校验许可证 / Verify a license.

**Request:**

```json
{
  "license": "ABCD2-EFGH3-JKLM4-NPQR5",
  "deviceId": "39beec2f-7b04-4d54-8fb3-5d063e68c875",
  "appVersion": "2.3.11",
  "timestamp": 1766666666,
  "nonce": "b531f6fe-2f6a-4820-bfc3-f6f3dc628e43"
}
```

**Response (Ed25519 signed):**

```json
{
  "apiVersion": "v1",
  "keyId": "main-ed25519-1",
  "algorithm": "Ed25519",
  "payload": {
    "verdict": "ALLOW",
    "reasonCode": "OK",
    "serverTime": 1766666666,
    "license": {
      "id": 12,
      "status": "active",
      "expiresAt": 1770000000,
      "boundDeviceId": "39beec2f-7b04-4d54-8fb3-5d063e68c875"
    }
  },
  "signature": "base64url-signature"
}
```

**Reason Codes:**

| Code | 含义 |
|------|------|
| `OK` | 验证通过 / Verified |
| `INVALID_KEY` | 无效许可证 / Invalid license key |
| `REVOKED` | 已吊销 / Revoked |
| `SUSPENDED` | 已暂停 / Suspended |
| `EXPIRED` | 已过期 / Expired |
| `VERSION_NOT_ALLOWED` | 版本不在白名单 / Version not whitelisted |
| `DEVICE_MISMATCH` | 设备不匹配 / Device mismatch |
| `TIMESTAMP_OUT_OF_WINDOW` | 时间戳超时 / Timestamp out of window |
| `REPLAY_DETECTED` | 重放攻击 / Replay detected |

---

## Client SDK / 客户端 SDK

`src/sdk/license-client.js` — 浏览器/Node.js 通用。

```js
import { verifyLicense } from "./license-client.js";

const result = await verifyLicense({
  endpoint: "https://your-worker.workers.dev/api/v1/license/verify",
  licenseKey: "ABCD2-EFGH3-JKLM4-NPQR5",
  deviceId: "39beec2f-7b04-4d54-8fb3-5d063e68c875",
  appVersion: "2.3.11",
  publicKey: "<SIGNING_PUBLIC_KEY_SPKI_B64>"
});

if (result.ok) {
  // Licensed / 已授权
} else {
  // Unlicensed / 未授权: result.reasonCode
}
```

---

## Admin API / 管理接口

| Method | Endpoint | Description / 说明 |
|--------|----------|-------------------|
| `GET` | `/admin/api/settings` | 获取全局设置 |
| `PUT` | `/admin/api/settings` | 更新全局设置 |
| `GET` | `/admin/api/versions` | 获取版本白名单 |
| `POST` | `/admin/api/versions` | 添加版本 |
| `DELETE` | `/admin/api/versions/:version` | 删除版本 |
| `GET` | `/admin/api/licenses` | 获取许可证列表 |
| `POST` | `/admin/api/licenses` | 创建许可证 |
| `PATCH` | `/admin/api/licenses/:id` | 修改许可证 |
| `GET` | `/admin/api/audits` | 审计日志 |
| `GET` | `/admin/api/license-events` | 认证事件 |

---

## Local Development / 本地开发

```bash
# 1. Install / 安装依赖
pnpm install

# 2. Generate signing keys / 生成签名密钥
pnpm run secrets:generate

# 3. Create .dev.vars with the keys / 将密钥写入 .dev.vars
cat > .dev.vars << 'EOF'
SIGNING_PRIVATE_KEY_PKCS8_B64=<your-private-key>
SIGNING_PUBLIC_KEY_SPKI_B64=<your-public-key>
EOF

# 4. Create D1 database & update wrangler.toml / 创建 D1 数据库并更新 wrangler.toml
npx wrangler d1 create license-worker-db
# Paste the returned database_id into wrangler.toml

# 5. Apply migrations / 执行迁移
pnpm run db:migrate:local

# 6. Start dev server / 启动本地服务
pnpm run dev
```

Dashboard: `http://127.0.0.1:8787/admin`

---

## GitHub Secrets / GitHub 密钥

**Settings > Secrets and variables > Actions > Secrets**

| Secret | Required | Auto-created | Description |
|--------|----------|-------------|-------------|
| `CLOUDFLARE_API_TOKEN` | Yes | No | Cloudflare API Token |
| `CLOUDFLARE_ACCOUNT_ID` | Yes | No | Cloudflare Account ID |
| `DATABASE_ID` | No | Yes | 生产 D1 数据库 ID |
| `SIGNING_PRIVATE_KEY_PKCS8_B64` | Yes | No | Ed25519 私钥 |
| `SIGNING_PUBLIC_KEY_SPKI_B64` | Yes | No | Ed25519 公钥 |
| `DATABASE_ID_PREVIEW` | No | Yes | 预览 D1 数据库 ID (启用预览后自动创建) |

## GitHub Variables / GitHub 变量

**Settings > Secrets and variables > Actions > Variables**

| Variable | Required | Description |
|----------|----------|-------------|
| `ENABLE_PREVIEW` | No | 设为 `true` 启用 PR 预览部署 |

---

## Project Structure / 项目结构

```
├── .github/workflows/deploy.yml   # GitHub Actions CI/CD
├── migrations/                    # D1 SQL 迁移文件
├── scripts/generate-secrets.mjs   # 密钥生成脚本
├── src/
│   ├── index.ts                   # Worker 入口 & 路由
│   ├── types.ts                   # TypeScript 类型
│   ├── dashboard/assets.ts        # 管理面板 HTML/CSS/JS
│   ├── lib/
│   │   ├── security.ts            # CSRF (Origin) 校验
│   │   ├── signing.ts             # Ed25519 签名
│   │   └── utils.ts               # 工具函数
│   └── sdk/license-client.js      # 客户端 SDK
├── wrangler.toml                  # Wrangler 配置
├── package.json
├── tsconfig.json
└── LICENSE                        # MIT
```

---

## License / 协议

[MIT](LICENSE)
