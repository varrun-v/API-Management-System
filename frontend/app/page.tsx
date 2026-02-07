// frontend/app/page.tsx
"use client"

import { useEffect, useState } from 'react';
import io from 'socket.io-client';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';

type Metric = {
  totalRequests: number;
  totalErrors: number;
  recent: Array<any>;
};

export default function Home() {
  const [metrics, setMetrics] = useState<Metric | null>(null);
  const [env, setEnv] = useState('Production');
  const [connected, setConnected] = useState(false); // Connection state

  useEffect(() => {
    const socket = io('http://localhost:4000', {
      transports: ['websocket'], // Force websocket to avoid polling issues
    });

    socket.on('connect', () => {
      console.log('Socket Connected:', socket.id);
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Socket Disconnected');
      setConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('Socket Connection Error:', err);
    });

    socket.on('metrics:update', (payload) => {
      console.log('Received metrics:', payload); // DEBUG LOG
      setMetrics(prev => {
        if (!prev) return {
          totalRequests: payload.totalRequests,
          totalErrors: payload.totalErrors,
          recent: [payload.lastRequest]
        };
        const newRecent = [payload.lastRequest, ...prev.recent].slice(0, 10);
        return {
          totalRequests: payload.totalRequests,
          totalErrors: payload.totalErrors,
          recent: newRecent
        };
      });
    });

    return () => { socket.disconnect(); };
  }, []);

  // Fetch initial state
  useEffect(() => {
    fetch('http://localhost:4000/metrics')
      .then(res => res.json())
      .then(data => setMetrics(data))
      .catch(err => console.error(err));
  }, []);

  if (!metrics) return <div className="p-10">Loading Gateway Dashboard...</div>;

  const errorRate = metrics.totalRequests > 0
    ? ((metrics.totalErrors / metrics.totalRequests) * 100).toFixed(2)
    : "0.00";

  const chartData = metrics.recent.map((r, i) => ({
    name: new Date(r.time).toLocaleTimeString(),
    latency: r.latency,
    status: r.status
  })).reverse();

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-8 font-sans">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-indigo-700">API Observability Gateway</h1>
          <p className="text-gray-500">Real-time Integration Monitoring</p>
        </div>
        <div className="flex gap-4 items-center">
          <select
            className="bg-white border border-gray-300 text-gray-700 py-2 px-4 rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={env}
            onChange={(e) => setEnv(e.target.value)}
          >
            <option>Development</option>
            <option>Staging</option>
            <option>Production</option>
          </select>
          <div className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span className="text-sm font-medium">{connected ? 'Live' : 'Disconnected'}</span>
          </div>
          <div className="flex items-center gap-2 border-l pl-4 ml-2">
            <span className={`h-3 w-3 rounded-full ${env === 'Production' ? 'bg-blue-500' : 'bg-yellow-500'}`}></span>
            <span className="text-sm font-medium">{env}</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500">
          <h3 className="text-gray-500 text-sm uppercase font-bold">Total Requests</h3>
          <p className="text-4xl font-bold mt-2">{metrics.totalRequests.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-red-500">
          <h3 className="text-gray-500 text-sm uppercase font-bold">Total Errors</h3>
          <p className="text-4xl font-bold mt-2 text-red-600">{metrics.totalErrors.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-purple-500">
          <h3 className="text-gray-500 text-sm uppercase font-bold">Error Rate</h3>
          <p className="text-4xl font-bold mt-2">{errorRate}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* CHARTS */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4">Latency Trend (ms)</h3>
          <div className="h-64 w-full"> {/* Added w-full */}
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" fontSize={12} tick={{ fill: '#888' }} />
                <YAxis fontSize={12} tick={{ fill: '#888' }} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                />
                <Line type="monotone" dataKey="latency" stroke="#6366f1" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* LOGS */}
        <div className="bg-white p-6 rounded-lg shadow-md overflow-hidden">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Live Request Log</h3>
            <span className="text-xs text-gray-400">Streaming via WebSocket</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="py-2 px-3 text-left font-semibold text-gray-600">Time</th>
                  <th className="py-2 px-3 text-left font-semibold text-gray-600">Method</th>
                  <th className="py-2 px-3 text-left font-semibold text-gray-600">Path</th>
                  <th className="py-2 px-3 text-left font-semibold text-gray-600">Status</th>
                  <th className="py-2 px-3 text-right font-semibold text-gray-600">Latency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {metrics.recent.map((r, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="py-2 px-3 text-gray-500 whitespace-nowrap">{new Date(r.time).toLocaleTimeString()}</td>
                    <td className="py-2 px-3 font-mono text-xs">
                      <span className={`px-2 py-1 rounded ${r.method === 'GET' ? 'bg-blue-100 text-blue-700' :
                        r.method === 'POST' ? 'bg-green-100 text-green-700' :
                          'bg-gray-200 text-gray-700'
                        }`}>{r.method}</span>
                    </td>
                    <td className="py-2 px-3 text-gray-700 truncate max-w-[150px]" title={r.path}>{r.path}</td>
                    <td className="py-2 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${r.status >= 500 ? 'bg-red-100 text-red-800' :
                        r.status >= 400 ? 'bg-orange-100 text-orange-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-gray-600 font-mono">{r.latency}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
