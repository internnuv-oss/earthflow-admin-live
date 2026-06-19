import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export const useAuth = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null>(null); // 🚀 Track user role
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 🚀 Helper function to fetch role from profiles table based on secure UUID
    const fetchRole = async (userId: string) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId) // Using the UUID
        .single();
      
      if (data && !error) {
        setRole(data.role);
      } else {
        // Fallback: If no profile is found, default to viewer for safety
        setRole('CO'); 
      }
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user?.id) { // Check for ID instead of email
        fetchRole(s.user.id); // Pass the ID
      } else {
        setRole(null);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user?.id) { // Check for ID instead of email
        fetchRole(s.user.id); // Pass the ID
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return { session, role, loading };
};