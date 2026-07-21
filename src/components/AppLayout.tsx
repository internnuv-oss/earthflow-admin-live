import { ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Menu, Sprout } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import AppSidebar from './AppSidebar';
import { useAuth } from '@/hooks/useAuth'; 

interface AppLayoutProps {
  children: ReactNode;
  onLogout: () => void;
}

const AppLayout = ({ children, onLogout }: AppLayoutProps) => {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { role, platform, loading } = useAuth();

  if (loading) return null;

  const handleLogout = () => {
    onLogout();
    navigate('/');
  };

  if (platform === 'Mobile' || role === 'SE') {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center p-4">
        <h2 className="text-2xl font-bold text-red-600 mb-2">Mobile App Only</h2>
        <p className="text-muted-foreground mb-6">
          Your assigned role ({role}) is restricted to the Earthflow Mobile Application. Web access is denied.
        </p>
        <Button onClick={onLogout}>Sign Out</Button>
      </div>
    );
  }

  return (
    // 🚀 FIXED: Changed min-h-screen to h-screen and forced absolute screen overflow layout containment
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      
      {/* Desktop sidebar */}
      {/* 🚀 FIXED: Added h-full and overflow-hidden to keep sidebar locked to view height */}
      <div className="hidden md:flex w-[250px] shrink-0 h-full overflow-hidden">
        <AppSidebar />
      </div>

      {/* 🚀 FIXED: Added h-full and overflow-hidden to isolate the header + main content view */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        
        {/* Mobile header */}
        <header className="md:hidden flex-shrink-0 flex h-14 items-center justify-between gap-2 border-b border-border bg-card/80 backdrop-blur-sm px-4">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[260px]">
              <AppSidebar onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Sprout className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-semibold">Field Commander Admin</span>
          </div>

          <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Logout">
            <LogOut className="h-4 w-4" />
          </Button>
        </header>

        {/* Desktop top bar with logout */}
        <header className="hidden md:flex flex-shrink-0 h-14 items-center justify-end border-b border-border bg-card/80 backdrop-blur-sm px-6">
          <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2 text-muted-foreground">
            <LogOut className="h-4 w-4" />
            <span>Log Out</span>
          </Button>
        </header>

        {/* 🚀 FIXED: Added flex-1 and overflow-y-auto. This is now the ONLY container that scrolls! */}
        <main className="flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-6 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;