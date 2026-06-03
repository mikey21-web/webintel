'use client';

import Link from 'next/link';
import { useSupabase } from '@/components/SupabaseProvider';
import { useState, useRef, useEffect } from 'react';
import { User, LogOut, Zap } from 'lucide-react';

export default function Navbar() {
  const { user, credits, supabase } = useSupabase();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setDropdownOpen(false);
  };

  const pct = credits.total > 0 ? Math.round((credits.remaining / credits.total) * 100) : 0;
  const gaugeColor = pct > 60 ? 'text-green-600 bg-green-50' : pct > 20 ? 'text-yellow-600 bg-yellow-50' : 'text-red-600 bg-red-50';

  return (
    <nav className="h-14 bg-white border-b flex items-center justify-between px-6 shrink-0">
      <Link href={user ? '/dashboard' : '/'} className="font-bold text-base flex items-center gap-2">
        <Zap className="w-5 h-5" />
        WebIntel
      </Link>

      <div className="flex items-center gap-3">
        {user && (
          <>
            <Link
              href="/dashboard/usage"
              className={`text-xs font-medium px-2.5 py-1 rounded-full ${gaugeColor}`}
            >
              {credits.remaining} credits
            </Link>

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 transition-colors"
              >
                <User className="w-4 h-4 text-gray-600" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 top-10 w-48 bg-white border rounded-lg shadow-lg py-1 z-50">
                  <div className="px-4 py-2 border-b">
                    <p className="text-sm font-medium truncate">{user.email}</p>
                  </div>
                  <Link
                    href="/dashboard"
                    className="block px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                    onClick={() => setDropdownOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </nav>
  );
}
