'use client';

import { Bell } from 'lucide-react';

type Alert = {
  id: string;
  timestamp: string;
  summary: string;
  severity: 'high' | 'medium' | 'low';
  url: string;
  seen: boolean;
};

type Props = {
  alerts: Alert[];
  onMarkSeen: (id: string) => void;
};

const severityConfig = {
  high: { icon: '🔴', bg: 'bg-red-50 border-red-200', text: 'text-red-700', label: 'High' },
  medium: { icon: '🟠', bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700', label: 'Medium' },
  low: { icon: '🟡', bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700', label: 'Low' },
};

export default function AlertFeed({ alerts, onMarkSeen }: Props) {
  if (alerts.length === 0) {
    return (
      <div className="bg-white rounded-xl border p-8 text-center">
        <Bell className="w-10 h-10 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400">No alerts</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert) => {
        const cfg = severityConfig[alert.severity];
        return (
          <div
            key={alert.id}
            onClick={() => onMarkSeen(alert.id)}
            className={`rounded-xl border p-4 cursor-pointer transition-opacity ${
              alert.seen ? 'opacity-50' : cfg.bg
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <span className="text-base shrink-0 mt-0.5">{cfg.icon}</span>
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${cfg.text}`}>{alert.summary}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400">
                      {new Date(alert.timestamp).toLocaleString()}
                    </span>
                    <span className="text-xs text-gray-300">·</span>
                    <span className="text-xs font-mono text-gray-400 truncate">{alert.url}</span>
                  </div>
                </div>
              </div>
              <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                {cfg.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
