import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sprout, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface RegisterPageProps {
  onRegistered: () => void;
}

const RegisterPage = ({ onRegistered }: RegisterPageProps) => {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'TH'>('TH');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

   // Add this import at the top

// ... inside RegisterPage component:

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !mobile || !password) {
      toast({ title: 'Missing fields', description: 'Please fill all fields.', variant: 'destructive' });
      return;
    }
    if (password.length < 6) {
      toast({ title: 'Weak password', description: 'Password must be at least 6 characters.', variant: 'destructive' });
      return;
    }
    setLoading(true);

    // 🚀 CONNECTED TO SUPABASE: Uses the exact same logic as your mobile app
    const { data, error } = await supabase.auth.signUp({
      email: `${mobile.trim()}@gmail.com`,
      password: password,
      options: {
        data: {
          name: name.trim(),
          first_name: name.trim().split(' ')[0],
          last_name: name.trim().split(' ').slice(1).join(' '),
          mobile: mobile.trim(),
          role: role // 'TH'
        }
      }
    });

    setLoading(false);

    if (error) {
      toast({ title: 'Registration Failed', description: error.message, variant: 'destructive' });
      return;
    }

    toast({
      title: 'Account created',
      description: `Welcome ${name}! Registered as ${role}.`,
    });
    
    onRegistered();
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md shadow-lg border-border">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
            <Sprout className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
          <CardDescription>Register as a Territory Head</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Jane Doe" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobile">Mobile</Label>
              <Input
                id="mobile"
                type="tel"
                value={mobile}
                onChange={e => setMobile(e.target.value)}
                placeholder="+91 98xxxxxxxx"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={v => setRole(v as 'TH')}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TH">Territory Head (TH)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create Account
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Already have an account?{' '}
              <Link to="/" className="text-primary font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default RegisterPage;
