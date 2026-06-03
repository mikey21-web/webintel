'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, KeyRound, BarChart3, Activity, FileText, CreditCard, LogOut, User } from 'lucide-react';
import { useSupabase } from '@/components/SupabaseProvider';
import { useState, useRef, useEffect } from 'react';

const navItems = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/dashboard/keys', label: 'API Keys', icon: KeyRound },
  { href: '/dashboard/usage', label: 'Usage', icon: BarChart3 },
  { href: '/dashboard/monitors', label: 'Monitors', icon: Activity },
  { href: '/dashboard/reports', label: 'Reports', icon: FileText },
  { href: '/dashboard/billing', label: 'Billing', icon: CreditCard },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { supabase, user, credits } = useSupabase();
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
  };

  const pct = credits.total > 0 ? Math.round((credits.remaining / credits.total) * 100) : 0;
  const gaugeColor = pct > 60 ? 'text-green-500' : pct > 20 ? 'text-yellow-500' : 'text-red-500';

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 bg-white border-r shrink-0 flex flex-col">
        <Link href="/dashboard" className="h-14 flex items-center px-5 border-b font-bold text-base">
          WebIntel
        </Link>
        <nav className="flex-1 py-3">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                  active
                    ? 'bg-gray-100 text-gray-900 font-medium'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t px-5 py-3">
          <span className="text-xs text-gray-400">Credits</span>
          <p className={`text-sm font-medium ${gaugeColor}`}>{credits.remaining} / {credits.total}</p>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b flex items-center justify-end px-6 gap-4 shrink-0">
          <Link
            href="/dashboard/usage"
            className={`text-xs font-medium px-2.5 py-1 rounded-full ${gaugeColor} bg-opacity-10 ${gaugeColor.replace('text', 'bg')}/10`}
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
                  <p className="text-sm font-medium truncate">{user?.email}</p>
                </div>
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
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
