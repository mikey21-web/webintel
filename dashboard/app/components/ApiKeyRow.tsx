'use client';

import { Trash2 } from 'lucide-react';

type Props = {
  keyObj: {
    id: string;
    name: string;
    prefix: string;
    created_at: string;
    last_used_at: string | null;
    status: 'active' | 'revoked';
  };
  onRevoke: (id: string) => void;
};

export default function ApiKeyRow({ keyObj, onRevoke }: Props) {
  return (
    <tr className="text-sm hover:bg-gray-50">
      <td className="px-5 py-3 font-medium">{keyObj.name}</td>
      <td className="px-5 py-3">
        <code className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono">
          {keyObj.prefix}...{keyObj.id.slice(-4)}
        </code>
      </td>
      <td className="px-5 py-3 text-gray-500">
        {new Date(keyObj.created_at).toLocaleDateString()}
      </td>
      <td className="px-5 py-3 text-gray-500">
        {keyObj.last_used_at
          ? new Date(keyObj.last_used_at).toLocaleDateString()
          : 'Never'}
      </td>
      <td className="px-5 py-3">
        <span
          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
            keyObj.status === 'active'
              ? 'bg-green-50 text-green-600'
              : 'bg-gray-100 text-gray-400'
          }`}
        >
          {keyObj.status}
        </span>
      </td>
      <td className="px-5 py-3 text-right">
        {keyObj.status === 'active' && (
          <button
            onClick={() => onRevoke(keyObj.id)}
            className="text-gray-400 hover:text-red-500 transition-colors"
            title="Revoke key"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </td>
    </tr>
  );
}
