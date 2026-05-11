import { Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import LoginPage from './LoginPage';
import Dashboard from './Dashboard';
import DealersPage from './DealersPage';
import FarmersPage from './FarmersPage';
import DistributorsPage from './DistributorsPage';
import SEsPage from './SEsPage';
import SettingsPage from './SettingsPage';
import SettingsTemplatePage from './SettingsTemplatePage';
import NotFound from './NotFound';

const Index = () => {
  const { session, loading } = useAuth();
  const logout = async () => { await supabase.auth.signOut(); };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const guard = (el: JSX.Element) => (session ? el : <Navigate to="/login" replace />);

  return (
    <Routes>
      <Route path="/" element={<Navigate to={session ? '/dashboard' : '/login'} replace />} />
      <Route path="/login" element={session ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/dashboard" element={guard(<Dashboard onLogout={logout} />)} />
      <Route path="/sales-executives" element={guard(<SEsPage onLogout={logout} />)} />
      <Route path="/dealers" element={guard(<DealersPage onLogout={logout} />)} />
      <Route path="/farmers" element={guard(<FarmersPage onLogout={logout} />)} />
      <Route path="/distributors" element={guard(<DistributorsPage onLogout={logout} />)} />
      <Route path="/settings" element={guard(<Navigate to="/settings/dealer" replace />)} />
      <Route path="/settings/dealer" element={guard(<SettingsTemplatePage type="dealer" onLogout={logout} />)} />
      <Route path="/settings/farmer" element={guard(<SettingsTemplatePage type="farmer" onLogout={logout} />)} />
      <Route path="/settings/distributor" element={guard(<SettingsTemplatePage type="distributor" onLogout={logout} />)} />
      <Route path="/settings/legacy" element={guard(<SettingsPage onLogout={logout} />)} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default Index;
