'use client';

import { useSupabase } from '@/components/SupabaseProvider';
import CreditsGauge from '@/components/CreditsGauge';
import UsageChart from '@/components/UsageChart';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PlusCircle, Activity, FileText, Clock } from 'lucide-react';

const quickActions = [
  { label: 'New Intel Job', icon: PlusCircle, href: '/dashboard/monitors', color: 'bg-blue-50 text-blue-600' },
  { label: 'Create Monitor', icon: Activity, href: '/dashboard/monitors', color: 'bg-purple-50 text-purple-600' },
  { label: 'View Reports', icon: FileText, href: '/dashboard/reports', color: 'bg-green-50 text-green-600' },
];

type UsageLog = { id: string; date: string; endpoint: string; credits: number; status: string; duration: string };

function generateActivity(userEmail?: string): UsageLog[] {
  const endpoints = ['/v1/monitor/check', '/v1/intel/search', '/v1/reports/generate', '/v1/market/map', '/v1/competitor/analyze'];
  const statuses = ['success', 'success', 'success', 'success', 'error'];
  const logs: UsageLog[] = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    logs.push({
      id: `log-${i}`,
      date: d.toISOString().split('T')[0],
      endpoint: endpoints[i % endpoints.length],
      credits: Math.floor(Math.random() * 50) + 5,
      status: statuses[i % statuses.length],
      duration: `${(Math.random() * 2 + 0.1).toFixed(1)}s`,
    });
  }
  return logs;
}

function generateChartData() {
  const data: { date: string; credits: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    data.push({
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      credits: Math.floor(Math.random() * 200) + 50,
    });
  }
  return data;
}

export default function DashboardHome() {
  const router = useRouter();
  const { user, isLoading, credits } = useSupabase();
  const [activity] = useState(() => generateActivity(user?.email));
  const [chartData] = useState(() => generateChartData());

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [user, isLoading, router]);

  if (isLoading || !user) return null;

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Dashboard</h1>

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-1">
          <CreditsGauge used={credits.total - credits.remaining} total={credits.total} />
        </div>
        <div className="lg:col-span-2 bg-white rounded-xl border p-4">
          <h3 className="text-sm font-medium text-gray-500 mb-3">Usage (Last 7 Days)</h3>
          <UsageChart data={chartData} />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        {quickActions.map((action) => (
          <button
            key={action.label}
            onClick={() => router.push(action.href)}
            className="bg-white rounded-xl border p-5 text-left hover:shadow-md transition-shadow"
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${action.color}`}>
              <action.icon className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm">{action.label}</h3>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" />
          <h3 className="font-medium text-sm">Recent Activity</h3>
        </div>
        <div className="divide-y">
          {activity.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-400">No activity yet</p>
          ) : (
            activity.map((log) => (
              <div key={log.id} className="px-5 py-3 flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${log.status === 'success' ? 'bg-green-400' : 'bg-red-400'}`} />
                  <span className="text-gray-700 font-mono text-xs">{log.endpoint}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span>{log.date}</span>
                  <span>{log.credits} credits</span>
                  <span>{log.duration}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
