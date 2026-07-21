import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type Permission = {
  module_name: string;
  can_view: boolean | null;
  can_edit: boolean | null;
};

export const usePermissions = (userId: string | undefined) => {
  const [perms, setPerms] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchPerms = async () => {
      // 1. Fetch user profile and JOIN the new roles table
      const { data: profile } = await supabase
        .from('profiles')
        .select(`
          role, 
          role_id,
          roles (name)
        `)
        .eq('id', userId)
        .single();

      // 2. GOD MODE: If they are a 'TH' or assigned the 'Super Admin' role
      if (profile?.role === 'TH' || (profile?.roles as any)?.name === 'Super Admin') {
        setIsAdmin(true);
        setLoading(false);
        return; 
      }

      // 3. PURE RBAC: Fetch permissions tied to their role_id
      if (profile?.role_id) {
        const { data } = await supabase
          .from('role_permissions')
          .select('module_name, can_view, can_edit')
          .eq('role_id', profile.role_id);
        
        if (data) {
          setPerms(data);
        }
      }

      setLoading(false);
    };

    fetchPerms();
  }, [userId]);

  const getModulePerm = (moduleName: string) => {
    // Admins always bypass checks
    if (isAdmin) return { can_view: true, can_edit: true };
    
    // Normal users check their role's module array
    const p = perms.find(p => p.module_name === moduleName);
    return { 
      can_view: !!p?.can_view, 
      can_edit: !!p?.can_edit 
    };
  };

  return { permissions: perms, loading, getModulePerm };
};