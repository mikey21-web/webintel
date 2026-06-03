'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/utils/supabase-client';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';

type SupabaseContextType = {
  supabase: SupabaseClient;
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  credits: { total: number; remaining: number };
  refreshCredits: () => Promise<void>;
};

const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);

export function useSupabase() {
  const ctx = useContext(SupabaseContext);
  if (!ctx) throw new Error('useSupabase must be used within SupabaseProvider');
  return ctx;
}

export default function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [credits, setCredits] = useState({ total: 1000, remaining: 842 });

  const refreshCredits = useCallback(async () => {
    try {
      const res = await fetch('/api/webintel?path=v1/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.credits) setCredits(data.credits);
      }
    } catch {}
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      setIsLoading(false);
      if (s) refreshCredits();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s) refreshCredits();
    });

    return () => subscription.unsubscribe();
  }, [supabase, refreshCredits]);

  return (
    <SupabaseContext.Provider value={{ supabase, session, user, isLoading, credits, refreshCredits }}>
      {children}
    </SupabaseContext.Provider>
  );
}
