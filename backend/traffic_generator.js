const http = require('http');

const GATEWAY_URL = 'http://localhost:4000/api';
const ENDPOINTS = ['/posts', '/users', '/comments', '/todos'];

function makeRequest() {
    const endpoint = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];
    const url = `${GATEWAY_URL}${endpoint}`;

    const start = Date.now();
    http.get(url, (res) => {
        const duration = Date.now() - start;
        console.log(`[${res.statusCode}] ${endpoint} - ${duration}ms`);

        // Schedule next request
        setTimeout(makeRequest, Math.random() * 1000 + 500); // Random delay between 0.5s and 1.5s
    }).on('error', (err) => {
        console.error(`Error requesting ${url}:`, err.message);
        setTimeout(makeRequest, 2000); // Retry after 2s on error
    });
}

console.log('Starting traffic generator...');
console.log(`Targeting: ${GATEWAY_URL}`);
console.log('Press Ctrl+C to stop.');

// Start a few concurrent "users"
for (let i = 0; i < 3; i++) {
    makeRequest();
}
