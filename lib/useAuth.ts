// Hook de autenticación para componentes client-side.
// Expone el user actual + su perfil (con role) + helpers de logout.

'use client';

import { useEffect, useState, useCallback } from 'react';
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { getSupabaseBrowser } from './supabase';

export type UserRole = 'admin' | 'vendedor';

export interface UserProfile {
  user_id: string;
  email: string;
  name: string | null;
  role: UserRole;
}

export interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Cargar user + profile al montar y suscribir a cambios de auth
  useEffect(() => {
    const sb = getSupabaseBrowser();
    if (!sb) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadSession() {
      if (!sb) return;
      const { data } = await sb.auth.getUser();
      if (cancelled) return;
      setUser(data.user);
      if (data.user) {
        const { data: profileData } = await sb
          .from('user_profiles')
          .select('user_id, email, name, role')
          .eq('user_id', data.user.id)
          .maybeSingle();
        if (cancelled) return;
        setProfile(profileData as UserProfile | null);
      } else {
        setProfile(null);
      }
      setLoading(false);
    }

    loadSession();

    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setUser(session?.user ?? null);
      if (!session?.user) setProfile(null);
      else loadSession();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    const sb = getSupabaseBrowser();
    if (!sb) return;
    await sb.auth.signOut();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }, []);

  return {
    user,
    profile,
    loading,
    isAdmin: profile?.role === 'admin',
    signOut,
  };
}
