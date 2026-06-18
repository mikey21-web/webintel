'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/components/SupabaseProvider';
import ApiKeyRow from '@/components/ApiKeyRow';
import CreateKeyModal from '@/components/CreateKeyModal';
import { Plus, KeyRound, Loader2 } from 'lucide-react';

type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  status: 'active' | 'revoked';
};

export default function KeysPage() {
  const router = useRouter();
  const { user, isLoading } = useSupabase();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchKeys = async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/webintel?path=v1/auth/keys', { credentials: 'include', signal });
      if (!res.ok) throw new Error('Failed to fetch keys');
      const data = await res.json();
      setKeys(data.keys ?? []);
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
    if (!user) return;
    const controller = new AbortController();
    fetchKeys(controller.signal);
    return () => controller.abort();
  }, [user, isLoading, router]);

  const handleRevoke = async (keyId: string) => {
    if (!window.confirm('Are you sure you want to revoke this API key? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/webintel?path=v1/auth/keys/${keyId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to revoke key');
      setKeys((prev) => prev.map((k) => (k.id === keyId ? { ...k, status: 'revoked' } : k)));
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">API Keys</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-4 h-4" /> Create Key
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg">{error}</div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border p-8 text-center text-sm text-gray-400">Loading keys...</div>
      ) : keys.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <KeyRound className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="font-medium mb-1">No API keys yet</h3>
          <p className="text-sm text-gray-400 mb-4">Create your first key to start using the WebIntel API.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            Create Your First Key
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Name</th>
                <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Key</th>
                <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Created</th>
                <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Last Used</th>
                <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Status</th>
                <th className="text-right text-xs font-medium text-gray-500 px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {keys.map((key) => (
                <ApiKeyRow key={key.id} keyObj={key} onRevoke={handleRevoke} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateKeyModal
          onClose={() => setShowCreate(false)}
          onCreated={(newKey) => {
            setKeys((prev) => [newKey, ...prev]);
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}
