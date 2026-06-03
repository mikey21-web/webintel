'use client';

import { Trash2, Globe, Clock, AlertCircle } from 'lucide-react';

type Props = {
  monitor: {
    id: string;
    name: string;
    urls: string[];
    interval: string;
    lastChecked: string;
    active: boolean;
    alertCount: number;
  };
  onDelete: (id: string) => void;
  onClick: (id: string | null) => void;
};

export default function MonitorCard({ monitor, onDelete, onClick }: Props) {
  const alertColor = monitor.alertCount > 5 ? 'text-red-500' : monitor.alertCount > 0 ? 'text-orange-500' : 'text-gray-300';

  return (
    <div
      className="bg-white rounded-xl border p-5 hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onClick(monitor.id)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${monitor.active ? 'bg-green-400' : 'bg-gray-300'}`} />
          <h3 className="font-semibold text-sm">{monitor.name}</h3>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(monitor.id); }}
          className="text-gray-300 hover:text-red-500 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2 text-xs text-gray-500 mb-3">
        <div className="flex items-center gap-2">
          <Globe className="w-3 h-3" />
          <span>{monitor.urls.length} URL{monitor.urls.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-3 h-3" />
          <span>Every {monitor.interval}</span>
        </div>
        <div className="flex items-center gap-2">
          <AlertCircle className={`w-3 h-3 ${alertColor}`} />
          <span>{monitor.alertCount} alert{monitor.alertCount !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          monitor.active ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
        }`}>
          {monitor.active ? 'Active' : 'Paused'}
        </span>
        <span className="text-xs text-gray-400">Checked {monitor.lastChecked}</span>
      </div>
    </div>
  );
}
