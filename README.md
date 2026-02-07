# Lightweight API Observability and Integration Gateway

It focuses on **observability** (real-time metrics), **reliability** (error tracking), and **infrastructure awareness** (environment separation).

## Features
- **Traffic Proxying**: Proxies requests to downstream services (JsonPlaceholder).
- **Authentication**: Validates `x-api-key` header for all integration requests.
- **Real-time Observability**: 
    - **Redis** backed counters for high-speed metrics.
    - **Postgres** backed audit logging for compliance and debugging.
    - **WebSocket** dashboard for live traffic visualization.
- **Infrastructure**: Fully containerized dependencies (Redis/Postgres) using Podman/Docker.

## Architecture
- **Backend**: Node.js, Express, `http-proxy-middleware`, `redis`, `pg`.
- **Frontend**: Next.js (App Router), TailwindCSS, Recharts.
- **Data**: Redis (Hot storage), Postgres (Cold/Audit storage).

## Design Decisions & Tradeoffs
- **Why Redis?**: Integration gateways often handle high throughput. Writing every request status to disk (SQL) is slow. Redis atomic counters allow us to track "Total Requests" with <1ms latency overhead.
- **Why Postgres?**: We need granular logs (who accessed what and when) for debugging failures. Postgres provides structured query capabilities for these logs.
- **Middleware Approach**: Using Express middleware allows us to "intercept" traffic transparently. We measure latency *including* the proxy overhead, giving a realistic view of system performance.

## Prerequisites
- Node.js & npm
- Podman (or Docker) + podman-compose

## Getting Started

1. **Start Infrastructure**
   ```bash
   podman-compose up -d
   ```

2. **Start Backend**
   ```bash
   cd backend
   npm install
   node index.js
   ```

3. **Start Frontend**
   ```bash
   cd frontend
   npm run dev
   ```

4. **Generate Traffic**
   ```bash
   cd backend
   node traffic_generator.js
   ```

## Verification
- Visit `http://localhost:3000` to see the Real-time Dashboard.
- Try `curl -H "x-api-key: secret_integration_key_123" http://localhost:4000/api/posts` to verify manually.
- Try `curl http://localhost:4000/api/posts` (no key) to verify 401 Unauthorized.
