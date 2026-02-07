// backend/index.js
require('dotenv').config();
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { Server } = require('socket.io');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./openapi.json');
const cors = require('cors');
const morgan = require('morgan');
const { createClient } = require('redis');
const { Client } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('tiny'));

// --- MIDDLEWARE SETUP ---

// 1. Request Timing (Must be first)
app.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

// --- INFRASTRUCTURE SETUP ---

// 2. Redis Client
const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.on('error', (err) => console.error('Redis Client Error', err));

// 3. Postgres Client
const pgClient = new Client({ connectionString: process.env.DATABASE_URL });

// Initialize Connections
(async () => {
  try {
    await redisClient.connect();
    console.log('Connected to Redis');

    await pgClient.connect();
    console.log('Connected to Postgres');

    // Create Table if not exists
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS request_logs (
        id SERIAL PRIMARY KEY,
        method TEXT,
        path TEXT,
        status INT,
        latency INT,
        time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Postgres Table Verified');
  } catch (err) {
    console.error('Failed to connect to DBs:', err);
  }
})();

// Auth Middleware
const authMiddleware = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    // Optional: Allow public access to specific paths if needed
    if (req.path.startsWith('/docs')) return next();
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid x-api-key' });
  }
  next();
};

// --- ROUTES ---

// Metrics Endpoint
app.get('/metrics', async (req, res) => {
  try {
    const total = await redisClient.get('totalRequests') || 0;
    const errors = await redisClient.get('totalErrors') || 0;
    const result = await pgClient.query('SELECT * FROM request_logs ORDER BY time DESC LIMIT 10');
    res.json({
      totalRequests: parseInt(total),
      totalErrors: parseInt(errors),
      recent: result.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// --- API GATEWAY ---

// Apply Auth globally to /api/*
// --- API GATEWAY & OBSERVABILITY ---

// Apply Auth globally to /api/*
app.use('/api', authMiddleware);

// Observability Middleware (The core logic)
app.use('/api', (req, res, next) => {
  // Hook into response finish
  res.on('finish', async () => {
    const duration = Date.now() - req.startTime;
    const status = res.statusCode;
    const path = req.path; // Note: req.path removes '/api' prefix because this middleware is mounted at '/api'
    const method = req.method;

    // console.log(`[Observability] Request finished: ${method} ${path} ${status} (${duration}ms)`);

    // Update Redis
    try {
      await redisClient.incr('totalRequests');
      if (status >= 400) await redisClient.incr('totalErrors');
      // console.log(`[Redis] Updated`); 
    } catch (err) {
      console.error('[Redis] Error:', err);
    }

    // Log to Postgres
    try {
      // Note: req.originalUrl gives full path including /api if needed. specific req.path depends on mount.
      // Let's use req.originalUrl for clarity in logs, or keep req.path (which is just /posts)
      await pgClient.query(
        'INSERT INTO request_logs (method, path, status, latency) VALUES ($1, $2, $3, $4)',
        [method, req.originalUrl, status, duration]
      );
      // console.log(`[Postgres] Logged`);
    } catch (e) {
      console.error('[Postgres] Error:', e);
    }

    // Emit Real-time Update
    if (io) {
      const total = await redisClient.get('totalRequests');
      const errors = await redisClient.get('totalErrors');
      // console.log('Emitting update:', { total, errors, path });
      io.emit('metrics:update', {
        totalRequests: parseInt(total || 0),
        totalErrors: parseInt(errors || 0),
        lastRequest: { method, path: req.originalUrl, status, latency: duration, time: new Date() }
      });
    } else {
      console.error('Socket.io not initialized');
    }
  });
  next();
});

// Proxy Logic (Simplified)
app.use('/api', createProxyMiddleware({
  target: 'https://jsonplaceholder.typicode.com',
  changeOrigin: true,
  pathRewrite: { '^/api': '' },
  // No complex hooks needed here anymore
}));

// --- SERVER START ---
const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
  console.log(`Gateway listening on http://localhost:${PORT}`);
});

// --- SOCKET.IO ---
// Initialize Socket.IO *after* the server is created
let io = new Server(server, {
  cors: {
    origin: "*", // Allow any origin for this demo
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('Dashboard connected:', socket.id);
});
