const http = require('http');

const GATEWAY_URL = 'http://localhost:4000/api';
const ENDPOINTS = ['/posts', '/users', '/comments', '/todos', '/invalid-endpoint']; // Added invalid endpoint to generate errors
const API_KEY = 'secret_integration_key_123'; // Matches .env

function makeRequest() {
    const endpoint = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];
    const url = `${GATEWAY_URL}${endpoint}`;

    const options = {
        headers: {
            'x-api-key': API_KEY
        }
    };

    const start = Date.now();
    http.get(url, options, (res) => {
        const duration = Date.now() - start;
        console.log(`[${res.statusCode}] ${endpoint} - ${duration}ms`);

        // Schedule next request
        setTimeout(makeRequest, Math.random() * 1000 + 500);
    }).on('error', (err) => {
        console.error(`Error requesting ${url}:`, err.message);
        setTimeout(makeRequest, 2000);
    });
}

console.log('Starting traffic generator (Auth enabled)...');
console.log(`Targeting: ${GATEWAY_URL}`);
console.log(`Using Key: ${API_KEY}`);
console.log('Press Ctrl+C to stop.');

// Start a few concurrent "users"
for (let i = 0; i < 3; i++) {
    makeRequest();
}
