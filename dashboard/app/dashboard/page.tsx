'use client';

import { useSupabase } from '@/components/SupabaseProvider';
import CreditsGauge from '@/components/CreditsGauge';
import UsageChart from '@/components/UsageChart';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PlusCircle, Activity, FileText, Clock, Loader2 } from 'lucide-react';

const quickActions = [
  { label: 'New Intel Job', icon: PlusCircle, href: '/dashboard/monitors', color: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' },
  { label: 'Create Monitor', icon: Activity, href: '/dashboard/monitors', color: 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' },
  { label: 'View Reports', icon: FileText, href: '/dashboard/reports', color: 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400' },
];

type UsageLog = { id: string; date: string; endpoint: string; credits: number; status: string; duration: string };

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 dark:bg-gray-800 rounded ${className ?? ''}`} />;
}

export default function DashboardHome() {
  const router = useRouter();
  const { user, isLoading, credits } = useSupabase();
  const [activity, setActivity] = useState<UsageLog[]>([]);
  const [chartData, setChartData] = useState<{ date: string; credits: number }[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }

    async function fetchData() {
      try {
        const [usageRes, historyRes] = await Promise.all([
          fetch('/api/webintel?path=v1/usage'),
          fetch('/api/webintel?path=v1/usage/history'),
        ]);

        if (usageRes.ok) {
          const usageData = await usageRes.json();
          if (usageData.recent) setActivity(usageData.recent);
        }

        if (historyRes.ok) {
          const historyData = await historyRes.json();
          if (historyData.daily) setChartData(historyData.daily);
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        setLoadingData(false);
      }
    }

    fetchData();
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="animate-fade-in">
      <h1 className="text-xl font-bold mb-6 dark:text-white">Dashboard</h1>

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-1">
          {loadingData ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <CreditsGauge used={credits.total - credits.remaining} total={credits.total} />
          )}
        </div>
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-4">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Usage (Last 7 Days)</h3>
          {loadingData ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <UsageChart data={chartData} />
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        {quickActions.map((action) => (
          <button
            key={action.label}
            onClick={() => router.push(action.href)}
            className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800 p-5 text-left hover:shadow-md dark:hover:shadow-gray-900/50 transition-shadow"
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${action.color}`}>
              <action.icon className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm dark:text-white">{action.label}</h3>
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-800">
        <div className="px-5 py-4 border-b dark:border-gray-800 flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" />
          <h3 className="font-medium text-sm dark:text-white">Recent Activity</h3>
        </div>
        <div className="divide-y dark:divide-gray-800">
          {loadingData ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-2 h-2 rounded-full" />
                  <Skeleton className="h-4 w-40" />
                </div>
                <div className="flex items-center gap-4">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </div>
            ))
          ) : activity.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-400 dark:text-gray-500">No activity yet</p>
          ) : (
            activity.map((log) => (
              <div key={log.id} className="px-5 py-3 flex items-center justify-between text-sm dark:text-gray-300">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${log.status === 'success' ? 'bg-green-400' : 'bg-red-400'}`} />
                  <span className="text-gray-700 dark:text-gray-300 font-mono text-xs">{log.endpoint}</span>
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
