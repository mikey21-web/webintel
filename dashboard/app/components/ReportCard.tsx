'use client';

import { FileText, Download, ChevronDown, ChevronUp } from 'lucide-react';

type Props = {
  report: {
    id: string;
    title: string;
    type: string;
    date: string;
    data: Record<string, any>;
  };
  onDownload: (id: string) => void;
  onDownloadPDF: (id: string) => void;
  onView: () => void;
  isExpanded: boolean;
};

const typeColors: Record<string, string> = {
  'market-map': 'bg-blue-50 text-blue-600',
  'battle-card': 'bg-purple-50 text-purple-600',
  brief: 'bg-green-50 text-green-600',
};

export default function ReportCard({ report, onDownload, onDownloadPDF, onView, isExpanded }: Props) {
  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-gray-600" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm truncate">{report.title}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeColors[report.type] || 'bg-gray-100 text-gray-600'}`}>
                  {report.type.replace('-', ' ')}
                </span>
                <span className="text-xs text-gray-400">{report.date}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onDownload(report.id)}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              title="Download JSON"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onView}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          onClick={() => onDownloadPDF(report.id)}
          className="w-full text-xs text-gray-500 border border-gray-200 rounded-lg py-1.5 hover:bg-gray-50 transition-colors"
        >
          Download PDF
        </button>
      </div>

      {isExpanded && (
        <div className="border-t bg-gray-50 px-5 py-4">
          <pre className="text-xs overflow-auto max-h-60">{JSON.stringify(report.data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
