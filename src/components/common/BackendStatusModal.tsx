import React, { useState, useEffect } from 'react';
import {
  Server,
  Database,
  Radio,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Shield,
  Layers,
  Cpu,
  Clock,
  Terminal,
  Activity
} from 'lucide-react';
import { api } from '../../services/api';
import { socket } from '../../services/socket';

export const BackendStatusModal: React.FC = () => {
  const [healthData, setHealthData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [socketStatus, setSocketStatus] = useState(socket.getStatus());

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const data = await api.checkHealth();
      setHealthData(data);
    } catch (err: any) {
      setHealthData({ status: 'error', error: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const unsub = socket.onStatusChange(setSocketStatus);
    const interval = setInterval(fetchHealth, 10000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  const apiUrl = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? `${window.location.origin}/api` : 'http://localhost:3000/api');
  const wsUrl = import.meta.env.VITE_WS_URL || (typeof window !== 'undefined' ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws` : 'ws://localhost:3000/ws');

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Top Banner */}
      <div className="border-b border-slate-800 pb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <Server className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              System Architecture & Health Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Live monitoring for Railway Node.js backend, PostgreSQL connection, and persistent WebSocket server.
            </p>
          </div>
        </div>
      </div>

      {/* Live System Metrics Cards */}
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
        {/* Node.js API Service */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>NODE.JS REST API</span>
            <Activity className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span
              className={`h-3 w-3 rounded-full ${
                healthData?.status === 'ok' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="font-mono text-xl font-black text-white uppercase">
              {healthData?.status || 'CHECKING...'}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400 font-mono truncate">
            {apiUrl}
          </p>
        </div>

        {/* PostgreSQL Database */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>POSTGRESQL DATABASE</span>
            <Database className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span
              className={`h-3 w-3 rounded-full ${
                healthData?.database?.connected ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span className="font-mono text-xl font-black text-white uppercase">
              {healthData?.database?.connected ? 'CONNECTED' : 'IN-MEMORY STORE'}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400 font-mono">
            Mode: {healthData?.database?.type || 'PostgreSQL'} • {healthData?.database?.latencyMs ?? 0}ms latency
          </p>
        </div>

        {/* WebSocket Realtime */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg backdrop-blur-md">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>WEBSOCKET REALTIME (WS)</span>
            <Radio className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span
              className={`h-3 w-3 rounded-full ${
                socketStatus === 'CONNECTED' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
              }`}
            />
            <span className="font-mono text-xl font-black text-white">
              {socketStatus}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400 font-mono truncate">
            {wsUrl}
          </p>
        </div>
      </div>

      {/* Manual Refresh Action */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-800 border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh System Health</span>
        </button>
      </div>

      {/* Railway & Vercel Production Deployment Instructions */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Railway Backend Guide */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 backdrop-blur-md">
          <div className="flex items-center gap-2 text-sm font-bold text-white mb-3">
            <Server className="h-4 w-4 text-indigo-400" />
            <span>Railway Backend Deployment (Node.js + PostgreSQL)</span>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Host the persistent Express REST API and WebSocket (<code className="text-indigo-300">/ws</code>) server on Railway:
          </p>
          <div className="space-y-3 text-xs text-slate-300">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <span className="font-bold text-white">1. Provision PostgreSQL</span>
              <p className="text-slate-400 mt-1">
                In your Railway project, click <b>+ New</b> &rarr; <b>Database</b> &rarr; <b>Add PostgreSQL</b>. Railway sets <code className="text-indigo-300">DATABASE_URL</code> automatically.
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <span className="font-bold text-white">2. Environment Variables in Railway</span>
              <pre className="mt-2 font-mono text-[11px] text-indigo-300 overflow-x-auto p-2 bg-slate-900 rounded">
{`PORT=3000
DATABASE_URL=postgresql://...
JWT_SECRET=production-secret-key-2026
FRONTEND_URL=https://your-quiz.vercel.app
NODE_ENV=production`}
              </pre>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <span className="font-bold text-white">3. Auto Migrations & Start</span>
              <p className="text-slate-400 mt-1">
                Railway starts using <code className="text-indigo-300">npm start</code>, which executes migrations in <code className="text-indigo-300">database/migrations/001_init.sql</code>, provisions tables, indexes, and seeds 200 questions.
              </p>
            </div>
          </div>
        </div>

        {/* Vercel Frontend Guide */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 backdrop-blur-md">
          <div className="flex items-center gap-2 text-sm font-bold text-white mb-3">
            <Layers className="h-4 w-4 text-indigo-400" />
            <span>Vercel Frontend Deployment (React + Vite)</span>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Deploy the responsive mobile-friendly React frontend to Vercel for high-speed edge delivery:
          </p>
          <div className="space-y-3 text-xs text-slate-300">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <span className="font-bold text-white">1. Configure Environment Variables</span>
              <pre className="mt-2 font-mono text-[11px] text-indigo-300 overflow-x-auto p-2 bg-slate-900 rounded">
{`VITE_API_URL=https://your-railway-app.up.railway.app
VITE_WS_URL=wss://your-railway-app.up.railway.app`}
              </pre>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <span className="font-bold text-white">2. SPA Routing Configuration</span>
              <p className="text-slate-400 mt-1">
                Preconfigured with <code className="text-indigo-300">vercel.json</code> to route all paths (<code className="text-indigo-300">/join</code>, <code className="text-indigo-300">/play</code>, <code className="text-indigo-300">/admin</code>, <code className="text-indigo-300">/leaderboard</code>) smoothly without 404s.
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <span className="font-bold text-white">3. 200+ Students Concurrency</span>
              <p className="text-slate-400 mt-1">
                Mobile students open the Vercel URL, join via 6-digit PIN, and connect to Railway's persistent WebSocket server with zero polling overhead.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
