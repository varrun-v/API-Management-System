// frontend/pages/index.tsx
import { useEffect, useState } from 'react';
import io from 'socket.io-client';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

type Metric = {
  totalRequests: number;
  byPath: Record<string, number>;
  recent: Array<any>;
};

export default function Home() {
  const [metrics, setMetrics] = useState<Metric | null>(null);
  useEffect(() => {
    const socket = io('http://localhost:4000'); // gateway address
    socket.on('connect', () => console.log('connected to gateway'));
    socket.on('metrics:update', (payload: { metrics: Metric }) => {
      setMetrics(payload.metrics);
    });
    return () => { socket.disconnect(); };
  }, []);

  if (!metrics) return <div>Loading dashboard...</div>;

  // prepare data for a simple line chart: recent request counts per time
  const chartData = metrics.recent.slice(0, 20).map((r, i) => ({
    name: (new Date(r.time)).toLocaleTimeString(),
    latency: r.latency
  })).reverse();

  return (
    <div style={{ padding: 20 }}>
      <h1>Mini API Management — Dashboard</h1>
      <div>
        <strong>Total requests:</strong> {metrics.totalRequests}
      </div>

      <div style={{ marginTop: 20 }}>
        <h3>Recent latencies (ms)</h3>
        <LineChart width={700} height={250} data={chartData}>
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <CartesianGrid stroke="#eee" />
          <Line type="monotone" dataKey="latency" stroke="#8884d8" />
        </LineChart>
      </div>

      <div style={{ marginTop: 20 }}>
        <h3>Recent requests</h3>
        <table>
          <thead><tr><th>time</th><th>method</th><th>path</th><th>status</th><th>latency</th></tr></thead>
          <tbody>
            {metrics.recent.slice(0, 10).map((r, idx) => (
              <tr key={idx}>
                <td>{new Date(r.time).toLocaleTimeString()}</td>
                <td>{r.method}</td>
                <td>{r.path}</td>
                <td>{r.status}</td>
                <td>{r.latency} ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
