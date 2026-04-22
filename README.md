# Orvio Backend

Node.js + Express backend for the Orvio Project. Handles session events, inventory updates, and device communication.


## Tech Stack
- Node.js, Express  
- PostgreSQL (pg)  
- dotenv, cors, morgan  


## Setup
npm install
npm run dev

Optional environment variables for QR targets:
- `HOST` (default: `0.0.0.0`)
- `QR_FRONTEND_BASE_URL` (recommended on local network: `http://192.168.1.50:5174`)
- `QR_FRONTEND_PORT` (default: `5174`, ignored if `QR_FRONTEND_BASE_URL` is set)

If `QR_FRONTEND_BASE_URL` is not set, `/qr/:device_id` will try to build the URL from request host.
When request host is `localhost` or `127.0.0.1`, backend falls back to detected LAN IP so phones on the same Wi-Fi can open the QR link.


## Related Repos
- orvio-frontend
- orvio-ai-model
- orvio-device  


## http://localhost:3000/qr/0f8322a5-9e63-4eb5-b7fa-4b0f98e11b1a

http://localhost:3000/qr/44444444-4444-4444-4444-444444444444

http://localhost:5174/cooler/44444444-4444-4444-4444-444444444444

## Smoke Test

Backend için çalıştırılabilir smoke test scripti:

```bash
npm run smoke:test
```

Script aşağıdaki kontrolleri yapar:
- API root/health
- Unauthorized erişim kontrolü
- Admin login + /auth/me
- Dashboard summary + device list
- Session start/current/cart snapshot/heartbeat/end
- Socket.IO `door_event` yayını

Önerilen ortam değişkenleri:

```bash
SMOKE_BASE_URL=http://localhost:3000
SMOKE_ADMIN_EMAIL=admin@example.com
SMOKE_ADMIN_PASSWORD=your-password
SMOKE_DEVICE_ID=your-device-uuid
SMOKE_DEVICE_TOKEN=smoke-test-device-token
SMOKE_AI_LABEL=coke_330ml
SMOKE_TIMEOUT_MS=8000
SMOKE_RUN_SESSION=true
SMOKE_RUN_SOCKET=true
```

Notlar:
- `SMOKE_ADMIN_EMAIL` ve `SMOKE_ADMIN_PASSWORD` zorunludur.
- Session/Socket adımları için `SMOKE_DEVICE_ID` gerekir.
- Session adımlarını kapatmak için `SMOKE_RUN_SESSION=false` kullanabilirsiniz.
- Socket adımını kapatmak için `SMOKE_RUN_SOCKET=false` kullanabilirsiniz.
