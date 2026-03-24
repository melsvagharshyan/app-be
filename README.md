# App backend (NestJS)

REST API for tracking Google Play Store listings: store apps to monitor, capture full-page screenshots on a schedule (or on demand), and persist images on Cloudinary with metadata in MongoDB.

## Requirements

- **Node.js** (LTS recommended)
- **pnpm** (`corepack enable` or install from [pnpm.io](https://pnpm.io))
- **MongoDB Atlas** credentials (the app connects using the URI configured in `src/app.module.ts`)
- **Cloudinary** account (upload/delete API)
- **Chrome or Chromium** for Puppeteer (or set `PUPPETEER_EXECUTABLE_PATH` to a browser binary)

## Environment variables

Create a `.env` file in the project root (same folder as `package.json`):

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_USER` | Yes | MongoDB Atlas username |
| `MONGODB_PASS` | Yes | MongoDB Atlas password |
| `CLOUDINARY_CLOUD_NAME` | Yes | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Yes | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Yes | Cloudinary API secret |
| `PORT` | No | HTTP port (default `3000`) |
| `MONITOR_INTERVAL_MINUTES` | No | How often the global scheduler wakes for active apps (default `30`; minimum `1`) |
| `PUPPETEER_EXECUTABLE_PATH` | No | Optional path to Chrome/Chromium (useful in Docker/Linux) |

The server uses `dotenv` and `@nestjs/config` with `envFilePath: '.env'`.

## Install and run

```bash
pnpm install
```

Development (watch mode):

```bash
pnpm run start:dev
```

Production build and run:

```bash
pnpm run build
pnpm run start:prod
```

The app listens on `http://localhost:<PORT>` (default `3000`). CORS is enabled for browser clients. Requests are validated with `class-validator` (`whitelist` + `forbidNonWhitelisted`).

## How monitoring works

- On startup, a **background job** runs immediately and then every `MONITOR_INTERVAL_MINUTES` minutes.
- For each **active** tracked app, the service checks the **last screenshot time** in the database. A new capture runs only if at least `intervalMinutes` (per app, default 30) have passed since that time.
- **Manual capture** (`POST /apps/:id/capture`) bypasses that interval and captures immediately.

Screenshots are taken with Puppeteer (Play Store URL → PNG → Cloudinary). The browser is shared across captures and is restarted on certain transient connection errors.

## HTTP API

Base URL: `http://localhost:<PORT>` (no global prefix).

### Root

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Simple health/hello response |

### Tracked apps (`apps`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/apps` | List all tracked apps (newest first) |
| `POST` | `/apps` | Create a tracked app |
| `PATCH` | `/apps/:id` | Update tracked app fields |
| `DELETE` | `/apps/:id` | Delete app and its screenshots (Cloudinary + DB) |
| `POST` | `/apps/:id/capture` | Capture screenshot now for this app |
| `GET` | `/apps/:id/screenshots` | List screenshots for this app (newest first) |

### `POST /apps` body (JSON)

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| `name` | string | Yes | Display name |
| `playStoreUrl` | string | Yes | Valid URL (Play Store listing) |
| `isActive` | boolean | No | Default `true` |
| `intervalMinutes` | integer | No | Per-app minimum interval between automatic captures (default `30`, min `1`, max `1440`) |

### `PATCH /apps/:id` body (JSON)

All fields optional: `name`, `playStoreUrl`, `isActive`, `intervalMinutes` (same constraints as above).

### Example: create and trigger capture

```bash
curl -s -X POST http://localhost:3000/apps \
  -H "Content-Type: application/json" \
  -d '{"name":"My App","playStoreUrl":"https://play.google.com/store/apps/details?id=com.example.app"}'

curl -s -X POST http://localhost:3000/apps/<APP_ID>/capture
```

Replace `<APP_ID>` with the `_id` returned from the create response.

## Tests and lint

```bash
pnpm run test
pnpm run test:e2e
pnpm run lint
```

## Project layout (monitoring)

- `src/monitoring/monitoring.controller.ts` — HTTP routes under `/apps`
- `src/monitoring/monitoring.service.ts` — Scheduler and orchestration
- `src/monitoring/services/` — Browser (Puppeteer), Play Store capture, screenshots DB, tracked apps CRUD

## License

Private / UNLICENSED (see `package.json`).
