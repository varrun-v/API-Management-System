"use client"
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

export default function TestSocket() {
    const [logs, setLogs] = useState<string[]>([]);
    const [status, setStatus] = useState('Disconnected');

    const addLog = (msg: string) => setLogs(prev => [msg, ...prev]);

    useEffect(() => {
        const socket = io('http://localhost:4000', {
            transports: ['websocket', 'polling']
        });

        socket.on('connect', () => {
            setStatus('Connected');
            addLog(`Connected with ID: ${socket.id}`);
        });

        socket.on('disconnect', () => {
            setStatus('Disconnected');
            addLog('Disconnected from server');
        });

        socket.on('connect_error', (err) => {
            setStatus('Error');
            addLog(`Connection Error: ${err.message}`);
        });

        socket.on('metrics:update', (data) => {
            addLog(`Received metrics: ${JSON.stringify(data).slice(0, 50)}...`);
        });

        return () => { socket.disconnect(); };
    }, []);

    return (
        <div style={{ padding: 20 }}>
            <h1>Socket Test</h1>
            <h2>Status: {status}</h2>
            <h3>Logs:</h3>
            <ul>
                {logs.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
        </div>
    );
}
