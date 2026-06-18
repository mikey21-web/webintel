'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, KeyRound, BarChart3, Activity, FileText, CreditCard, LogOut, User, Menu, X, Sun, Moon } from 'lucide-react';
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setDarkMode(isDark);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('darkMode', String(next));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const pct = credits.total > 0 ? Math.round((credits.remaining / credits.total) * 100) : 0;
  const gaugeColor = pct > 60 ? 'text-green-500' : pct > 20 ? 'text-yellow-500' : 'text-red-500';

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[200] focus:px-4 focus:py-2 focus:bg-white dark:focus:bg-gray-900 focus:border focus:rounded-lg focus:text-sm">
        Skip to content
      </a>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-56 bg-white dark:bg-gray-900 border-r dark:border-gray-800 shrink-0 flex flex-col transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-14 flex items-center justify-between px-5 border-b dark:border-gray-800">
          <Link href="/dashboard" className="font-bold text-base dark:text-white" onClick={() => setSidebarOpen(false)}>
            WebIntel
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <nav className="flex-1 py-3">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                  active
                    ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 font-medium'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t dark:border-gray-800 px-5 py-3">
          <span className="text-xs text-gray-400 dark:text-gray-500">Credits</span>
          <p className={`text-sm font-medium ${gaugeColor}`}>{credits.remaining} / {credits.total}</p>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white dark:bg-gray-900 border-b dark:border-gray-800 flex items-center justify-between px-4 lg:px-6 gap-4 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5 dark:text-white" />
          </button>

          <div className="flex items-center gap-4 ml-auto">
            <button
              onClick={toggleDarkMode}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? <Sun className="w-4 h-4 dark:text-gray-300" /> : <Moon className="w-4 h-4" />}
            </button>

            <Link
              href="/dashboard/usage"
              className={`text-xs font-medium px-2.5 py-1 rounded-full ${gaugeColor} ${gaugeColor.replace('text', 'bg')}/10`}
            >
              {credits.remaining} credits
            </Link>
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                aria-label="User menu"
              >
                <User className="w-4 h-4 text-gray-600 dark:text-gray-300" />
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 top-10 w-48 bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-lg shadow-lg py-1 z-50">
                  <div className="px-4 py-2 border-b dark:border-gray-800">
                    <p className="text-sm font-medium truncate dark:text-white">{user?.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main id="main-content" className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
