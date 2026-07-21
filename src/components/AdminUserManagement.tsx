import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Shield, User, Mail, Phone, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  mobile: string;
  role: string;
  role_id: string;
  created_at: string;
  roles?: { name: string };
}

const AdminUserManagement = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Form States
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');

  // Dynamic Web Roles States
  const [webRoles, setWebRoles] = useState<any[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');

  // Fetch Roles on Mount
  useEffect(() => {
    const fetchWebRoles = async () => {
      const { data } = await supabase
        .from('roles')
        .select('*')
        .in('platform', ['Web', 'Both'])
        .order('name');
      if (data) setWebRoles(data);
    };
    fetchWebRoles();
  }, []);

  // Fetch Existing Users
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    // Fetch users and JOIN with the roles table to get the dynamic role name
    const { data, error } = await supabase
      .from('profiles')
      .select('*, roles(name)')
      .in('role', ['TH', 'CO']) 
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error loading users', description: error.message, variant: 'destructive' });
    } else {
      setUsers(data as UserProfile[] || []);
    }
    setLoading(false);
  };

  const handleMobileChange = (val: string) => {
    const onlyNums = val.replace(/\D/g, '');
    if (onlyNums.length <= 10) {
      setMobile(onlyNums);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !mobile.trim() || !password.trim() || !selectedRoleId) {
      toast({ title: 'Validation Error', description: 'Please fill all required fields and select a role.', variant: 'destructive' });
      return;
    }

    if (mobile.trim().length !== 10) {
      toast({ title: 'Validation Error', description: 'Mobile number must be exactly 10 digits.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);

    // 1. Explicitly grab the current user's active session token
    const { data: { session } } = await supabase.auth.getSession();

    // 2. Invoke the function and forcefully pass the Authorization header
    const { data, error } = await supabase.functions.invoke('create-se', {
      body: {
        name: name.trim(), 
        mobile: mobile.trim(),
        email: email.trim(),
        password: password,
        role: 'CO' // Keep legacy role for backward compatibility in Edge Function
      },
      headers: { Authorization: `Bearer ${session?.access_token}` }
    });

    if (error || data?.error) {
      setIsSubmitting(false);
      toast({ title: 'Could not create user', description: error?.message || data?.error, variant: 'destructive' });
      return;
    }

    // 3. Immediately link the dynamic role_id to the created profile
    await supabase
      .from('profiles')
      .update({ role_id: selectedRoleId })
      .eq('mobile', mobile.trim());

    setIsSubmitting(false);
    toast({ title: "User Created!", description: `${name} has been successfully added.` });
    
    // Reset form states
    setName('');
    setEmail('');
    setMobile('');
    setPassword('');
    setSelectedRoleId('');
    setIsModalOpen(false);
    fetchUsers(); 
  };

  // Pagination Logic
  const totalPages = Math.ceil(users.length / ITEMS_PER_PAGE) || 1;
  const paginatedUsers = users.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      {/* Header & Action Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold">Team Management</h2>
          <p className="text-sm text-muted-foreground">Manage dynamic roles and access for your web staff.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Add New User
        </Button>
      </div>

      {/* Users List Table */}
      <div className="rounded-md border bg-card flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
              <tr>
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Contact Details</th>
                <th className="px-6 py-3 font-medium">Assigned Role</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-8 text-muted-foreground">No users found.</td>
                </tr>
              ) : (
                paginatedUsers.map((user) => (
                  <tr key={user.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-6 py-4 font-medium">{user.name || '—'}</td>
                    <td className="px-6 py-4 text-muted-foreground">
                      <div className="flex items-center gap-2"><Mail className="h-3 w-3" /> {user.email}</div>
                      <div className="flex items-center gap-2 mt-1"><Phone className="h-3 w-3" /> {user.mobile || '—'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${user.roles?.name === 'Super Admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {user.roles?.name || (user.role === 'TH' ? 'Super Admin' : 'Unassigned')}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {!loading && users.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-3 border-t bg-muted/20 gap-3">
            <div className="text-xs text-muted-foreground font-medium">
              Showing <span className="text-foreground">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="text-foreground">{Math.min(currentPage * ITEMS_PER_PAGE, users.length)}</span> of <span className="text-foreground">{users.length}</span> entries
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Prev
              </Button>
              <div className="text-xs font-semibold px-2">Page {currentPage} of {totalPages}</div>
              <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleCreateUser}>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Add a new team member and assign them a dynamic role.
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="admin-name">Full Name *</Label>
                <div className="relative">
                  <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input id="admin-name" value={name} onChange={e => setName(e.target.value)} required className="pl-9" placeholder="John Doe" />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="admin-email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input id="admin-email" type="email" value={email} onChange={e => setEmail(e.target.value)} className="pl-9" placeholder="john@example.com" />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="admin-mobile">Mobile Number *</Label>
                <div className="relative">
                  <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="admin-mobile" 
                    type="tel"
                    inputMode="numeric"
                    value={mobile} 
                    onChange={e => handleMobileChange(e.target.value)} 
                    required 
                    maxLength={10}
                    className="pl-9" 
                    placeholder="10-digit number" 
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="admin-password">Temporary Password *</Label>
                <Input 
                  id="admin-password" 
                  type="text" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  required 
                  placeholder="Minimum 6 characters" 
                  minLength={6} 
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="admin-role">Assigned Web Role *</Label>
                <div className="relative">
                  <Shield className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground z-10" />
                  <Select value={selectedRoleId} onValueChange={setSelectedRoleId} required>
                    <SelectTrigger className="pl-9 bg-white">
                      <SelectValue placeholder="Select a role..." />
                    </SelectTrigger>
                    <SelectContent>
                      {webRoles.map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting || !selectedRoleId}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create Account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUserManagement;