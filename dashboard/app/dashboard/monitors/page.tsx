'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/components/SupabaseProvider';
import MonitorCard from '@/components/MonitorCard';
import AlertFeed from '@/components/AlertFeed';
import { Plus, Activity, Loader2 } from 'lucide-react';

type Monitor = {
  id: string;
  name: string;
  urls: string[];
  interval: string;
  lastChecked: string;
  active: boolean;
  alertCount: number;
};

type Alert = {
  id: string;
  timestamp: string;
  summary: string;
  severity: 'high' | 'medium' | 'low';
  url: string;
  seen: boolean;
};

function generateMockMonitors(): Monitor[] {
  return [
    { id: 'm1', name: 'Competitor A Tracking', urls: ['competitor-a.com/pricing', 'competitor-a.com/blog'], interval: '15m', lastChecked: '2 min ago', active: true, alertCount: 3 },
    { id: 'm2', name: 'Market News Monitoring', urls: ['techcrunch.com', 'theverge.com'], interval: '1h', lastChecked: '12 min ago', active: true, alertCount: 0 },
    { id: 'm3', name: 'Competitor B Product Page', urls: ['competitor-b.com/products'], interval: '5m', lastChecked: '1 hour ago', active: false, alertCount: 1 },
  ];
}

function generateMockAlerts(): Alert[] {
  return [
    { id: 'a1', timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), summary: 'Pricing page changed — new "Enterprise" plan added at $999/mo', severity: 'high', url: 'competitor-a.com/pricing', seen: false },
    { id: 'a2', timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), summary: 'New blog post: "Why we switched to microservices"', severity: 'low', url: 'competitor-a.com/blog', seen: false },
    { id: 'a3', timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(), summary: 'Product page updated — feature list reorganized', severity: 'medium', url: 'competitor-b.com/products', seen: true },
    { id: 'a4', timestamp: new Date(Date.now() - 1000 * 60 * 240).toISOString(), summary: 'Meta description changed for homepage', severity: 'low', url: 'competitor-a.com', seen: true },
  ];
}

export default function MonitorsPage() {
  const router = useRouter();
  const { user, isLoading } = useSupabase();
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [alerts] = useState<Alert[]>(() => generateMockAlerts());
  const [selectedMonitor, setSelectedMonitor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
    if (user) {
      setMonitors(generateMockMonitors());
      setLoading(false);
    }
  }, [user, isLoading, router]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this monitor?')) return;
    setMonitors((prev) => prev.filter((m) => m.id !== id));
  };

  const handleMarkSeen = (alertId: string) => {
    // In a real app, this would call the API
  };

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    );
  }

  const selectedData = monitors.find((m) => m.id === selectedMonitor);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Monitors</h1>
        <button
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Monitor
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border p-8 text-center text-sm text-gray-400">Loading monitors...</div>
      ) : monitors.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-medium mb-1">No monitors yet</h3>
          <p className="text-sm text-gray-400 mb-4">Create your first monitor to start tracking competitors.</p>
          <button className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
            Create Monitor
          </button>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className={selectedMonitor ? 'lg:col-span-2' : 'lg:col-span-3'}>
            <div className="grid md:grid-cols-2 gap-4">
              {monitors.map((m) => (
                <MonitorCard
                  key={m.id}
                  monitor={m}
                  onDelete={handleDelete}
                  onClick={setSelectedMonitor}
                />
              ))}
            </div>
          </div>

          {selectedMonitor && selectedData && (
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl border p-5 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">{selectedData.name}</h3>
                  <button
                    onClick={() => setSelectedMonitor(null)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Close
                  </button>
                </div>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-gray-400 text-xs">URLs</span>
                    <ul className="mt-1 space-y-1">
                      {selectedData.urls.map((url) => (
                        <li key={url} className="font-mono text-xs text-gray-600">{url}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex gap-4">
                    <div>
                      <span className="text-gray-400 text-xs">Interval</span>
                      <p className="font-medium">{selectedData.interval}</p>
                    </div>
                    <div>
                      <span className="text-gray-400 text-xs">Last Checked</span>
                      <p className="font-medium">{selectedData.lastChecked}</p>
                    </div>
                    <div>
                      <span className="text-gray-400 text-xs">Alerts</span>
                      <p className="font-medium">{selectedData.alertCount}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="lg:col-span-3">
            <h3 className="font-medium mb-3">Recent Alerts</h3>
            <AlertFeed alerts={alerts} onMarkSeen={handleMarkSeen} />
          </div>
        </div>
      )}
    </div>
  );
}
