import { ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Menu, Sprout } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import AppSidebar from './AppSidebar';

interface AppLayoutProps {
  children: ReactNode;
  onLogout: () => void;
}

const AppLayout = ({ children, onLogout }: AppLayoutProps) => {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    onLogout();
    navigate('/');
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:flex w-[250px] shrink-0">
        <AppSidebar />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b border-border bg-card/80 backdrop-blur-sm px-4">
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
            <span className="text-sm font-semibold">AgriDealer Admin</span>
          </div>

          <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Logout">
            <LogOut className="h-4 w-4" />
          </Button>
        </header>

        {/* Desktop top bar with logout */}
        <header className="hidden md:flex sticky top-0 z-40 h-14 items-center justify-end border-b border-border bg-card/80 backdrop-blur-sm px-6">
          <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2 text-muted-foreground">
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </Button>
        </header>

        <main className="flex-1 px-4 md:px-6 py-6 space-y-6 max-w-[1400px] w-full">{children}</main>
      </div>
    </div>
  );
};

export default AppLayout;
