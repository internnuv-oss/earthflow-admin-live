import React, { useState, useEffect } from 'react';
import { PermissionEditor } from './PermissionEditor';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Shield, User, Mail, Phone } from 'lucide-react';
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
  created_at: string;
}

const AdminUserManagement = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Separate individual states just like SEsPage.tsx
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('CO'); // Default role is Coordinator

  // 1. Fetch Existing Users
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['TH', 'CO']) // Only show Admin and Coordinator
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error loading users', description: error.message, variant: 'destructive' });
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  };

  const handleMobileChange = (val: string) => {
    const onlyNums = val.replace(/\D/g, '');
    if (onlyNums.length <= 10) {
      setMobile(onlyNums);
    }
  };

  // 3. Handle Submit
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 🚀 FIXED: Run all validation logic immediately before hitting the server
    if (!name.trim() || !mobile.trim() || !password.trim()) {
      toast({ title: 'Validation Error', description: 'Please fill all required fields.', variant: 'destructive' });
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
        role: role 
      },
      headers: {
        Authorization: `Bearer ${session?.access_token}` // Inject the token here
      }
    });

    setIsSubmitting(false);

    if (error || data?.error) {
      toast({ 
        title: 'Could not create user', 
        description: error?.message || data?.error, 
        variant: 'destructive' 
      });
      return;
    }
      
    toast({
      title: "User Created!",
      description: `${name} has been successfully added as a ${role === 'TH' ? 'Admin' : 'Coordinator'}.`,
    });
    
    // Reset form states
    setName('');
    setEmail('');
    setMobile('');
    setPassword('');
    setRole('CO');
    setIsModalOpen(false);
    fetchUsers(); 
  };

  return (
    <div className="space-y-6">
      {/* Header & Action Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold">Team Management</h2>
          <p className="text-sm text-muted-foreground">Manage roles and access for your staff.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Add New User
        </Button>
      </div>

      {/* Users List Table */}
      <div className="rounded-md border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
              <tr>
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Contact Details</th>
                <th className="px-6 py-3 font-medium">Role</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-muted-foreground">No users found.</td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-6 py-4 font-medium">{user.name || '—'}</td>
                    <td className="px-6 py-4 text-muted-foreground">
                      <div className="flex items-center gap-2"><Mail className="h-3 w-3" /> {user.email}</div>
                      <div className="flex items-center gap-2 mt-1"><Phone className="h-3 w-3" /> {user.mobile || '—'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${user.role === 'TH' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {user.role === 'TH' ? 'Admin' : 'Coordinator'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {user.role === 'CO' ? (
                        <Button variant="ghost" size="sm" onClick={() => setSelectedUserId(user.id)}>
                          Edit Access
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground pr-4">Full Access</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleCreateUser}>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Add a new Admin or Coordinator to the system.
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
                <Label htmlFor="admin-role">Initial System Role</Label>
                <div className="relative">
                  <Shield className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground z-10" />
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger className="pl-9">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TH">Admin (TH)</SelectItem>
                      <SelectItem value="CO">Coordinator (CO)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create Account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Permissions Modal */}
      <Dialog open={!!selectedUserId} onOpenChange={(open) => !open && setSelectedUserId(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Coordinator Access</DialogTitle>
          </DialogHeader>
          {selectedUserId && <PermissionEditor userId={selectedUserId} onSave={() => setSelectedUserId(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUserManagement;