import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, ShieldCheck, Edit2, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const WEB_MODULES = [
  { key: 'dashboard', label: 'Dashboard Overview' },
  { key: 'sales_executives', label: 'Sales Executives Directory' },
  { key: 'distributors', label: 'Distributors Directory' },
  { key: 'dealers', label: 'Dealers Directory' },
  { key: 'farmers', label: 'Farmers Directory' },
  { key: 'fpos', label: 'FPOs Directory' },
  { key: 'routes', label: 'Territory Routes' },
  { key: 'attendance', label: 'Attendance & Timelines' },
  { key: 'expenses', label: 'Expenses Management' },
  { key: 'locations', label: 'Location Master' },
  { key: 'shifts', label: 'Shift Management' },
  { key: 'farm_diary_masters', label: 'Farm Diary & SOPs' },
  { key: 'fspp_approvals', label: 'FSPP Approvals' },
  { key: 'retail', label: 'Retail & Inventory' },
];

const MOBILE_MODULES = [
  { key: 'mobile_distributor', label: 'Distributor Module' },
  { key: 'mobile_dealer', label: 'Dealer Module' },
  { key: 'mobile_farmer', label: 'Farmer Module (Includes Farm Card, Diary, FSPP, etc.)' },
  { key: 'mobile_farmer_onboard', label: 'Farmer Onboarding (Profiles & General Visits Only)' },
  { key: 'mobile_fpo', label: 'FPO Module' },
  { key: 'mobile_travel_activity', label: 'Executive Travel Activity (Attendance, Reports, Expenses)' },
  { key: 'mobile_retail', label: 'Retail & Inventory' },
];

export default function RolesPage({ onLogout }: { onLogout: () => void }) {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Form States
  const [editRoleId, setEditRoleId] = useState<string | null>(null);
  const [roleName, setRoleName] = useState('');
  const [platform, setPlatform] = useState('Both');
  const [permissions, setPermissions] = useState<Record<string, { can_view: boolean, can_edit: boolean }>>({});

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    setLoading(true);
    const { data: rolesData, error } = await supabase.from('roles').select('*, role_permissions(*)').order('created_at', { ascending: true });
    if (error) {
      toast({ title: 'Error fetching roles', description: error.message, variant: 'destructive' });
    } else {
      setRoles(rolesData || []);
    }
    setLoading(false);
  };

  const handleOpenModal = (role: any = null) => {
    if (role) {
      setEditRoleId(role.id);
      setRoleName(role.name);
      setPlatform(role.platform);
      
      const permMap: Record<string, { can_view: boolean, can_edit: boolean }> = {};
      (role.role_permissions || []).forEach((p: any) => {
        permMap[p.module_name] = { can_view: p.can_view, can_edit: p.can_edit };
      });
      setPermissions(permMap);
    } else {
      setEditRoleId(null);
      setRoleName('');
      setPlatform('Both');
      setPermissions({});
    }
    setIsModalOpen(true);
  };

  const handleTogglePermission = (moduleKey: string, field: 'can_view' | 'can_edit') => {
    setPermissions(prev => {
      const current = prev[moduleKey] || { can_view: false, can_edit: false };
      const updated = { ...current, [field]: !current[field] };
      // If setting edit to true, force view to true
      if (field === 'can_edit' && updated.can_edit) updated.can_view = true;
      // If setting view to false, force edit to false
      if (field === 'can_view' && !updated.can_view) updated.can_edit = false;
      return { ...prev, [moduleKey]: updated };
    });
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName.trim()) return;
    setSaving(true);

    try {
      let currentRoleId = editRoleId;

      if (editRoleId) {
        // Update Role
        const { error } = await supabase.from('roles').update({ name: roleName, platform }).eq('id', editRoleId);
        if (error) throw error;
      } else {
        // Insert Role
        const { data, error } = await supabase.from('roles').insert([{ name: roleName, platform }]).select('id').single();
        if (error) throw error;
        currentRoleId = data.id;
      }

      // Handle Permissions
      if (currentRoleId) {
        // Wipe existing permissions to start fresh
        await supabase.from('role_permissions').delete().eq('role_id', currentRoleId);
        
        const permsToInsert = Object.entries(permissions)
          .filter(([_, perms]) => perms.can_view || perms.can_edit)
          .map(([moduleName, perms]) => ({
            role_id: currentRoleId,
            module_name: moduleName,
            can_view: perms.can_view,
            can_edit: perms.can_edit
          }));

        if (permsToInsert.length > 0) {
          const { error: permError } = await supabase.from('role_permissions').insert(permsToInsert);
          if (permError) throw permError;
        }
      }

      toast({ title: 'Success', description: `Role ${editRoleId ? 'updated' : 'created'} successfully.` });
      setIsModalOpen(false);
      fetchRoles();
    } catch (error: any) {
      toast({ title: 'Failed to save', description: error.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDeleteRole = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the role "${name}"?`)) return;
    const { error } = await supabase.from('roles').delete().eq('id', id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else fetchRoles();
  };

  const renderModuleToggles = (modules: any[], title: string) => (
    <div className="space-y-3">
      <h4 className="font-bold text-sm text-primary uppercase tracking-wider">{title}</h4>
      <div className="border rounded-md divide-y bg-slate-50">
        {modules.map(mod => {
          const perm = permissions[mod.key] || { can_view: false, can_edit: false };
          return (
            <div key={mod.key} className="flex items-center justify-between p-3 bg-white">
              <span className="text-sm font-medium">{mod.label}</span>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={perm.can_view} onCheckedChange={() => handleTogglePermission(mod.key, 'can_view')} />
                  <span className="text-xs font-semibold text-muted-foreground">View</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={perm.can_edit} onCheckedChange={() => handleTogglePermission(mod.key, 'can_edit')} />
                  <span className="text-xs font-semibold text-muted-foreground">Edit</span>
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <AppLayout onLogout={onLogout}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Role & Access Management
            </h2>
            <p className="text-sm text-muted-foreground">Define global roles and their granular module permissions for Web and Mobile.</p>
          </div>
          <Button onClick={() => handleOpenModal()} className="gap-2">
            <Plus className="h-4 w-4" /> Create New Role
          </Button>
        </div>

        <div className="rounded-md border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                <tr>
                  <th className="px-6 py-3 font-medium">Role Name</th>
                  <th className="px-6 py-3 font-medium">Platform Access</th>
                  <th className="px-6 py-3 font-medium">Active Permissions</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr><td colSpan={4} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></td></tr>
                ) : roles.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-12 text-muted-foreground">No roles configured yet.</td></tr>
                ) : (
                  roles.map(role => (
                    <tr key={role.id} className="hover:bg-muted/30">
                      <td className="px-6 py-4 font-bold text-foreground">{role.name}</td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className={role.platform === 'Both' ? 'bg-purple-50 text-purple-700' : 'bg-slate-50 text-slate-700'}>
                          {role.platform}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-semibold text-muted-foreground bg-muted px-2 py-1 rounded">
                          {(role.role_permissions || []).length} Modules Granted
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenModal(role)} className="h-8 w-8 text-primary">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteRole(role.id, role.name)} className="h-8 w-8 text-red-500 hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
            <DialogHeader className="px-6 py-4 border-b bg-muted/30 shrink-0">
              <DialogTitle>{editRoleId ? 'Edit Role Permissions' : 'Create New Role'}</DialogTitle>
              <DialogDescription>Select which modules this role is allowed to view and modify.</DialogDescription>
            </DialogHeader>
            
            <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-lg border shadow-sm">
                <div className="space-y-2">
                  <Label>Role Name *</Label>
                  <Input placeholder="e.g. Field Executive" value={roleName} onChange={e => setRoleName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Platform Reach *</Label>
                  <Select value={platform} onValueChange={setPlatform}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Mobile">Mobile App Only</SelectItem>
                      <SelectItem value="Web">Web Dashboard Only</SelectItem>
                      <SelectItem value="Both">Both Mobile & Web</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {(platform === 'Web' || platform === 'Both') && renderModuleToggles(WEB_MODULES, 'Web Dashboard Modules')}
              {(platform === 'Mobile' || platform === 'Both') && renderModuleToggles(MOBILE_MODULES, 'Mobile App Modules')}
            </div>

            <DialogFooter className="px-6 py-4 border-t bg-muted/30 shrink-0">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveRole} disabled={saving || !roleName.trim()}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Save Role
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}