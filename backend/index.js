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
app.use('/api', authMiddleware);

// Proxy Logic
app.use('/api', createProxyMiddleware({
  target: 'https://jsonplaceholder.typicode.com',
  changeOrigin: true,
  pathRewrite: { '^/api': '' },
  onProxyReq: (proxyReq, req, res) => {
    // Log proxy attempt
  },
  onProxyRes: (proxyRes, req, res) => {
    const start = req.startTime || Date.now();
    let body = [];
    proxyRes.on('data', (chunk) => body.push(chunk));
    proxyRes.on('end', async () => {
      const duration = Date.now() - start;
      const status = proxyRes.statusCode;
      const path = req.path;
      const method = req.method;

      // Update Redis
      await redisClient.incr('totalRequests');
      if (status >= 400) await redisClient.incr('totalErrors');

      // Log to Postgres
      try {
        await pgClient.query(
          'INSERT INTO request_logs (method, path, status, latency) VALUES ($1, $2, $3, $4)',
          [method, path, status, duration]
        );
      } catch (e) {
        console.error('PG Log Error:', e);
      }

      // Emit Real-time Update
      if (io) {
        const total = await redisClient.get('totalRequests');
        const errors = await redisClient.get('totalErrors');
        console.log('Emitting update:', { total, errors, path }); // DEBUG LOG
        io.emit('metrics:update', {
          totalRequests: parseInt(total || 0),
          totalErrors: parseInt(errors || 0),
          lastRequest: { method, path, status, latency: duration, time: new Date() }
        });
      } else {
        console.error('Socket.io not initialized, cannot emit update');
      }
    });
  }
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
