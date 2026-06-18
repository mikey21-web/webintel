'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/components/SupabaseProvider';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Download, Calendar, Loader2 } from 'lucide-react';

type UsageEntry = {
  id: string;
  date: string;
  endpoint: string;
  credits: number;
  status: string;
  duration: string;
};

function generateUsageData(days: number): UsageEntry[] {
  const endpoints = ['/v1/monitor/check', '/v1/intel/search', '/v1/reports/generate', '/v1/market/map', '/v1/competitor/analyze', '/v1/auth/me'];
  const data: UsageEntry[] = [];
  for (let i = 0; i < days * 3; i++) {
    const d = new Date();
    d.setDate(d.getDate() - Math.floor(i / 3));
    data.push({
      id: `usage-${i}`,
      date: d.toISOString().split('T')[0],
      endpoint: endpoints[Math.floor(Math.random() * endpoints.length)],
      credits: Math.floor(Math.random() * 30) + 1,
      status: Math.random() > 0.1 ? 'success' : 'error',
      duration: `${(Math.random() * 3 + 0.05).toFixed(2)}s`,
    });
  }
  return data.sort((a, b) => b.date.localeCompare(a.date));
}

function aggregateByDate(data: UsageEntry[], days: number) {
  const map = new Map<string, number>();
  for (const entry of data) {
    map.set(entry.date, (map.get(entry.date) || 0) + entry.credits);
  }
  const result: { date: string; credits: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    result.push({ date: key, credits: map.get(key) || 0 });
  }
  return result;
}

const RANGES = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
];

export default function UsagePage() {
  const router = useRouter();
  const { user, isLoading, credits } = useSupabase();
  const [range, setRange] = useState(30);
  const [rawData, setRawData] = useState<UsageEntry[]>([]);

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
    if (user) setRawData(generateUsageData(range));
  }, [user, isLoading, router, range]);

  const chartData = useMemo(() => aggregateByDate(rawData, range), [rawData, range]);
  const totalCredits = useMemo(() => rawData.reduce((s, e) => s + e.credits, 0), [rawData]);

  const resetDate = new Date();
  resetDate.setMonth(resetDate.getMonth() + 1);
  resetDate.setDate(1);

  const handleCSV = useCallback(() => {
    const header = 'Date,Endpoint,Credits,Status,Duration\n';
    const rows = rawData.map((e) => `${e.date},${e.endpoint},${e.credits},${e.status},${e.duration}`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `webintel-usage-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [rawData]);

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Usage</h1>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-5">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Credits Remaining</span>
          <p className="text-2xl font-bold mt-1">{credits.remaining}</p>
          <p className="text-xs text-gray-400">of {credits.total} total</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Used This Period</span>
          <p className="text-2xl font-bold mt-1">{totalCredits}</p>
          <p className="text-xs text-gray-400">{credits.total - credits.remaining} total used</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <span className="text-xs text-gray-400 uppercase tracking-wide">Reset Date</span>
          <p className="text-2xl font-bold mt-1">{resetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
          <p className="text-xs text-gray-400">Next billing cycle</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-sm">Credit Consumption</h3>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <div className="flex gap-1">
              {RANGES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setRange(r.value)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    range === r.value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button
              onClick={handleCSV}
              className="flex items-center gap-1 px-3 py-1 text-xs rounded-md border hover:bg-gray-50 transition-colors ml-2"
            >
              <Download className="w-3 h-3" /> CSV
            </button>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorCredits" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                formatter={(value: number) => [`${value} credits`, 'Credits']}
              />
              <Area type="monotone" dataKey="credits" stroke="#6366f1" strokeWidth={2} fill="url(#colorCredits)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="font-medium text-sm">Usage History</h3>
          <span className="text-xs text-gray-400">{rawData.length} entries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Date</th>
                <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Endpoint</th>
                <th className="text-right text-xs font-medium text-gray-500 px-5 py-3">Credits</th>
                <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Status</th>
                <th className="text-right text-xs font-medium text-gray-500 px-5 py-3">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rawData.slice(0, 50).map((entry) => (
                <tr key={entry.id} className="text-sm hover:bg-gray-50">
                  <td className="px-5 py-3 text-gray-600">{entry.date}</td>
                  <td className="px-5 py-3 font-mono text-xs text-gray-700">{entry.endpoint}</td>
                  <td className="px-5 py-3 text-right">{entry.credits}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      entry.status === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                    }`}>
                      {entry.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-gray-500">{entry.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
