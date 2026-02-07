"use client";

import { useEffect, useMemo, useState } from "react";
import io from "socket.io-client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

type RequestLog = {
  time: string;
  latency: number;
  status: number;
  path: string;
  method: string;
  requestId?: string;
};

type Metric = {
  totalRequests: number;
  totalErrors: number;
  recent: RequestLog[];
  lastError?: RequestLog;
};

export default function Home() {
  const [metrics, setMetrics] = useState<Metric>({
    totalRequests: 0,
    totalErrors: 0,
    recent: [],
    lastError: undefined
  });
  const [env, setEnv] = useState("Production");
  const [connected, setConnected] = useState(false);

  /* ---------------- WebSocket ---------------- */
  useEffect(() => {
    const socket = io("http://localhost:4000", {
      transports: ["websocket"],
    });

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("metrics:update", (payload) => {
      setMetrics((prev) => {
        // Since we now have a default state, prev is never null, but let's be safe if logic changes
        const current = prev || { totalRequests: 0, totalErrors: 0, recent: [] };

        const recent = [payload.lastRequest, ...current.recent].slice(0, 20);

        return {
          totalRequests: payload.totalRequests,
          totalErrors: payload.totalErrors,
          recent,
          lastError: payload.lastError ?? current.lastError,
        };
      });
    });

    return () => { socket.disconnect(); };
  }, []);

  /* ---------------- Initial Fetch ---------------- */
  useEffect(() => {
    fetch("http://localhost:4000/metrics")
      .then((res) => res.json())
      .then(setMetrics)
      .catch(console.error);
  }, []);

  // Removed early return to prevent Hook Error
  // if (!metrics) { return ... }  <-- DELETE

  /* ---------------- Derived Metrics ---------------- */
  const errorRate =
    metrics.totalRequests > 0
      ? ((metrics.totalErrors / metrics.totalRequests) * 100).toFixed(2)
      : "0.00";

  const chartData = useMemo(() => {
    return metrics.recent
      .map((r) => ({
        time: new Date(r.time).toLocaleTimeString(),
        successLatency: r.status < 400 ? r.latency : null,
        errorLatency: r.status >= 400 ? r.latency : null,
      }))
      .reverse();
  }, [metrics.recent]);

  /* ---------------- UI ---------------- */
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-8">
      {/* HEADER */}
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-indigo-700">
            API Observability Gateway
          </h1>
          <p className="text-gray-500">
            Real-time Integration Monitoring
          </p>
        </div>

        <div className="flex gap-4 items-center">
          <select
            value={env}
            onChange={(e) => setEnv(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option>Development</option>
            <option>Staging</option>
            <option>Production</option>
          </select>

          <div className="flex items-center gap-2">
            <span
              className={`h-3 w-3 rounded-full ${connected ? "bg-green-500" : "bg-red-500"
                }`}
            />
            <span className="text-sm">
              {connected ? "Live" : "Disconnected"}
            </span>
          </div>
        </div>
      </header>

      {/* METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <MetricCard title="Total Requests" value={metrics.totalRequests} />
        <MetricCard
          title="Total Errors"
          value={metrics.totalErrors}
          color="red"
        />
        <MetricCard title="Error Rate" value={`${errorRate}%`} />
        <div className="bg-white p-6 rounded shadow border-l-4 border-orange-500">
          <h3 className="text-sm text-gray-500 uppercase font-bold">
            Last Error
          </h3>
          {metrics.lastError ? (
            <>
              <p className="font-mono text-sm mt-2">
                {metrics.lastError.path}
              </p>
              <p className="text-xs text-gray-500">
                {metrics.lastError.status} ·{" "}
                {new Date(metrics.lastError.time).toLocaleTimeString()}
              </p>
            </>
          ) : (
            <p className="text-sm mt-2 text-gray-400">No errors yet</p>
          )}
        </div>
      </div>

      {/* CHART + LOGS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* LATENCY CHART */}
        <div className="bg-white p-6 rounded shadow">
          <h3 className="font-semibold mb-4">
            Latency Trend (Last 20 Requests)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" fontSize={10} />
                <YAxis fontSize={10} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="successLatency"
                  stroke="#22c55e"
                  dot={false}
                  name="Success (2xx)"
                />
                <Line
                  type="monotone"
                  dataKey="errorLatency"
                  stroke="#ef4444"
                  dot={false}
                  name="Errors (4xx/5xx)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* LOG TABLE */}
        <div className="bg-white p-6 rounded shadow overflow-hidden">
          <h3 className="font-semibold mb-4">
            Live Request Log
          </h3>

          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-2 text-left">Time</th>
                <th className="px-3 py-2 text-left">Method</th>
                <th className="px-3 py-2 text-left">Path</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Latency</th>
              </tr>
            </thead>
            <tbody>
              {metrics.recent.map((r, i) => (
                <tr
                  key={i}
                  className={`border-t ${r.status >= 500
                      ? "bg-red-50"
                      : r.status >= 400
                        ? "bg-orange-50"
                        : ""
                    }`}
                >
                  <td className="px-3 py-2">
                    {new Date(r.time).toLocaleTimeString()}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {r.method}
                  </td>
                  <td className="px-3 py-2 truncate max-w-[160px]">
                    {r.path}
                  </td>
                  <td className="px-3 py-2">{r.status}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {r.latency}ms
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Small Helper ---------------- */
function MetricCard({
  title,
  value,
  color = "blue",
}: {
  title: string;
  value: number | string;
  color?: string;
}) {
  return (
    <div className={`bg-white p-6 rounded shadow border-l-4 border-${color}-500`}>
      <h3 className="text-sm text-gray-500 uppercase font-bold">
        {title}
      </h3>
      <p className="text-3xl font-bold mt-2">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}
