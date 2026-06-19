import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type Permission = Database['public']['Tables']['user_permissions']['Row'];

export const usePermissions = (userId: string | undefined) => {
  const [perms, setPerms] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false); // Track if user is Admin

  useEffect(() => {
    if (!userId) return;

    const fetchPerms = async () => {
      // 1. Check if the user is a TH (Admin)
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (profile?.role === 'TH') {
        setIsAdmin(true);
        setLoading(false);
        return; // Admins don't need user_permissions entries!
      }

      // 2. If they are a CO, fetch their specific permissions
      const { data } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', userId);
      
      if (data) setPerms(data);
      setLoading(false);
    };

    fetchPerms();
  }, [userId]);

  // Helper to get permission for a specific module
  const getModulePerm = (moduleName: string) => {
    // 🚀 If Admin, ALWAYS return true!
    if (isAdmin) return { can_view: true, can_edit: true };
    
    // Otherwise, check the specific permissions table
    return perms.find(p => p.module_name === moduleName) || { can_view: false, can_edit: false };
  };

  return { permissions: perms, loading, getModulePerm };
};