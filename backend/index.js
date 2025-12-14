// backend/index.js
const fs = require('fs');
const https = require('https'); // optional for HTTPS
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { Server } = require('socket.io');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./openapi.json'); // or .yaml processed to JSON
const cors = require('cors');
const morgan = require('morgan');

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('tiny')); // logs to console

// In-memory metrics store (simple)
const metrics = {
  totalRequests: 0,
  byPath: {},
  recent: []
};

// Socket.IO setup — attach to HTTP(S) server later
let io; // defined after server creation

// Proxy middleware: forward /api/* to a target backend
app.use('/api', (req, res, next) => {
  const start = Date.now();
  // attach a small hook to capture response status & latency
  res.on('finish', () => {
    const latency = Date.now() - start;
    const path = req.path;
    metrics.totalRequests++;
    metrics.byPath[path] = (metrics.byPath[path] || 0) + 1;
    metrics.recent.unshift({
      method: req.method,
      path,
      status: res.statusCode,
      latency,
      time: new Date().toISOString()
    });
    // keep recent small
    if (metrics.recent.length > 100) metrics.recent.pop();

    // emit to dashboard via socket if connected
    if (io) io.emit('metrics:update', { metrics });
  });
  next();
});

// example proxying to a public API (placeholder)
// change target to whichever backend you want to expose
app.use('/api', createProxyMiddleware({
  target: 'https://jsonplaceholder.typicode.com',
  changeOrigin: true,
  pathRewrite: { '^/api': '' }, // /api/posts -> /posts on target
  onProxyReq: (proxyReq, req, res) => {
    // add headers or API key handling here
    proxyReq.setHeader('x-forwarded-host', req.headers.host);
  }
}));

// Serve Swagger UI at /docs
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Small endpoint to fetch aggregated metrics (for non-realtime clients)
app.get('/metrics', (req, res) => res.json(metrics));

const PORT = process.env.PORT || 4000;

// Optional HTTPS dev cert (uncomment to use)
// const server = https.createServer({
//   key: fs.readFileSync('./certs/key.pem'),
//   cert: fs.readFileSync('./certs/cert.pem')
// }, app);

// Use HTTP server for dev; swap above for HTTPS if you have certs
const server = app.listen(PORT, () => {
  console.log(`Gateway listening on http://localhost:${PORT}`);
});

// Attach socket.io to server
io = new Server(server, {
  cors: { origin: '*' }
});
io.on('connection', (socket) => {
  console.log('Dashboard connected:', socket.id);
  // send initial metrics
  socket.emit('metrics:update', { metrics });
  socket.on('disconnect', () => console.log('Dashboard disconnected', socket.id));
});
