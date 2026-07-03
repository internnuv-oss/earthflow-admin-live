import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';

interface Permission {
  id?: string;
  module_name: string;
  can_view: boolean;
  can_edit: boolean;
}

// 🚀 FIXED: Added 'routes' to your modules matrix array
const MODULES = ['farmers', 'dealers', 'distributors', 'fpos', 'sales_executives', 'routes','attendance','expenses','locations','shifts'];

export const PermissionEditor = ({ userId, onSave }: { userId: string, onSave: () => void }) => {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchPermissions();
  }, [userId]);

  const fetchPermissions = async () => {
    const { data } = await supabase.from('user_permissions').select('*').eq('user_id', userId);
    // Initialize if empty
    const initial = MODULES.map(mod => 
      data?.find(p => p.module_name === mod) || { module_name: mod, can_view: false, can_edit: false }
    );
    setPermissions(initial);
    setLoading(false);
  };

  const updatePerm = (module: string, field: 'can_view' | 'can_edit', value: boolean) => {
    setPermissions(prev => prev.map(p => 
      p.module_name === module ? { ...p, [field]: value } : p
    ));
  };

  const save = async () => {
    setLoading(true);
    
    // 🚀 FIXED: Create a perfectly uniform array without any 'id' keys.
    // Postgres will automatically generate IDs for new rows and use the 
    // user_id + module_name to update existing ones.
    const toUpsert = permissions.map(p => ({
      user_id: userId,
      module_name: p.module_name,
      can_view: p.can_view,
      can_edit: p.can_edit
    }));

    // 🚀 Supabase handles the matching automatically using our unique constraint
    const { error } = await supabase
      .from('user_permissions')
      .upsert(toUpsert, { onConflict: 'user_id,module_name' });
    
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Access Updated!" });
      onSave();
    }
    setLoading(false);
  };

  if (loading) return <Loader2 className="animate-spin" />;

  return (
    <div className="space-y-4">
      {permissions.map(p => (
        <div key={p.module_name} className="flex items-center justify-between border-b pb-2">
          <span className="capitalize font-medium">{p.module_name.replace('_', ' ')}</span>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={p.can_view} onCheckedChange={(v: boolean) => updatePerm(p.module_name, 'can_view', v)} /> View
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={p.can_edit} onCheckedChange={(v: boolean) => updatePerm(p.module_name, 'can_edit', v)} /> Edit
            </label>
          </div>
        </div>
      ))}
      <Button onClick={save} className="w-full">Save Permissions</Button>
    </div>
  );
};