import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export const useAuth = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null>(null); // Dynamic role name
  const [platform, setPlatform] = useState<string | null>(null); // 'Web', 'Mobile', 'Both'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async (userId: string) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, roles(name, platform)')
        .eq('id', userId)
        .single();

      if (data && !error) {
        // Prefer the dynamic role name and platform, fallback to legacy
        const dynamicRoleName = (data.roles as any)?.name;
        const dynamicPlatform = (data.roles as any)?.platform;
        
        setRole(dynamicRoleName || data.role);
        setPlatform(dynamicPlatform || (data.role === 'SE' ? 'Mobile' : 'Both'));
      } else {
        setRole(null);
        setPlatform(null);
      }
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user?.id) fetchRole(s.user.id);
      else {
        setRole(null);
        setPlatform(null);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user?.id) fetchRole(s.user.id);
      else setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { session, role, platform, loading };
};