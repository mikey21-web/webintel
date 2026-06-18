'use client';

import { useState } from 'react';
import { Copy, CheckCircle, AlertTriangle, X } from 'lucide-react';

type Props = {
  onClose: () => void;
  onCreated: (key: any) => void;
};

export default function CreateKeyModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [createdKeyData, setCreatedKeyData] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/webintel?path=v1/auth/keys', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create key');
      }

      const data = await res.json();
      setCreatedKey(data.key || data.apiKey);
      setCreatedKeyData(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (createdKey) {
      await navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDone = () => {
    if (!acknowledged) return;
    onCreated({
      id: createdKeyData?.id || createdKeyData?.key_id || 'temp',
      name: createdKeyData?.name || name.trim(),
      prefix: (createdKeyData?.key || createdKeyData?.apiKey || '').slice(0, 8),
      created_at: createdKeyData?.created_at || new Date().toISOString(),
      last_used_at: null,
      status: 'active',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">
            {createdKey ? 'API Key Created' : 'Create API Key'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!createdKey ? (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Key Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Production API Key"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                autoFocus
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded mb-4">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 border py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={loading || !name.trim()}
                className="flex-1 bg-gray-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Key'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-800">Key created successfully</p>
                <p className="text-xs text-green-600 mt-1">Make sure to copy your key now. You won't be able to see it again.</p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Your API Key</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-gray-50 border rounded-lg px-3 py-2 text-xs font-mono break-all">
                  {createdKey}
                </code>
                <button
                  onClick={handleCopy}
                  className="shrink-0 p-2 border rounded-lg hover:bg-gray-50 transition-colors"
                  title="Copy to clipboard"
                >
                  <Copy className={`w-4 h-4 ${copied ? 'text-green-500' : 'text-gray-400'}`} />
                </button>
              </div>
              {copied && <p className="text-xs text-green-600 mt-1">Copied to clipboard!</p>}
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-700">
                This key will not be shown again. Store it securely. If you lose it, you'll need to create a new one.
              </p>
            </div>

            <label className="flex items-start gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-xs text-gray-600">
                I understand that I won't be able to see this key again
              </span>
            </label>

            <button
              onClick={handleDone}
              disabled={!acknowledged}
              className="w-full bg-gray-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              Done
            </button>
          </>
        )}
      </div>
    </div>
  );
}
