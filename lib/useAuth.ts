// Hook de autenticación para componentes client-side.
// Expone el user actual + su perfil (con role) + helpers de logout.

'use client';

import { useEffect, useState, useCallback } from 'react';
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { getSupabaseBrowser } from './supabase';
import { isAdminEmail } from './adminEmails';
import { clearPriceCache } from './dataStore';

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
  // Re-lee el perfil desde Supabase sin recargar la página. Lo usa el modal
  // de nombre tras guardar, en vez de window.location.reload() (que perdía
  // cualquier trabajo dentro de la ventana de debounce del autosave).
  refreshProfile: () => Promise<void>;
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

  // Re-lee user + profile bajo demanda (sin reload de página).
  const refreshProfile = useCallback(async () => {
    const sb = getSupabaseBrowser();
    if (!sb) return;
    const { data } = await sb.auth.getUser();
    setUser(data.user);
    if (!data.user) {
      setProfile(null);
      return;
    }
    const { data: profileData } = await sb
      .from('user_profiles')
      .select('user_id, email, name, role')
      .eq('user_id', data.user.id)
      .maybeSingle();
    setProfile(profileData as UserProfile | null);
  }, []);

  const signOut = useCallback(async () => {
    const sb = getSupabaseBrowser();
    if (!sb) return;
    // Precios = confidenciales: el cache local no sobrevive al logout
    // (equipos compartidos).
    clearPriceCache();
    await sb.auth.signOut();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }, []);

  // isAdmin: principal por profile.role, fallback por email match.
  // El fallback resuelve el caso donde el trigger no creó el profile (usuarios
  // anteriores a la migración 002, o si el trigger falló silenciosamente).
  // La BD sigue siendo la fuente de verdad — los writes admin pasan por RLS
  // que verifica el role real en user_profiles, NO este flag UI.
  const isAdmin = profile?.role === 'admin' || isAdminEmail(user?.email);

  return {
    user,
    profile,
    loading,
    isAdmin,
    signOut,
    refreshProfile,
  };
}
