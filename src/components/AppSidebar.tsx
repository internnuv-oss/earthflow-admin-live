import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Wheat,
  Truck,
  Sprout,
  Settings,
  ChevronDown,
  UserCog,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/sales-executives', label: 'Sales Executives', icon: UserCog },
  { to: '/distributors', label: 'Distributors', icon: Truck },
  { to: '/dealers', label: 'Dealers', icon: Users },
  { to: '/farmers', label: 'Farmers', icon: Wheat },
];

const settingsChildren = [
  { to: '/settings/dealer', label: 'Dealer Onboarding' },
  { to: '/settings/farmer', label: 'Farmer Onboarding' },
  { to: '/settings/distributor', label: 'Distributor Onboarding' },
];

interface AppSidebarProps {
  onNavigate?: () => void;
}

const AppSidebar = ({ onNavigate }: AppSidebarProps) => {
  const location = useLocation();
  const settingsActive = location.pathname.startsWith('/settings');
  const [settingsOpen, setSettingsOpen] = useState(settingsActive);

  const renderLink = (item: { to: string; label: string; icon: typeof Users; end?: boolean }) => {
    const active = item.end
      ? location.pathname === item.to
      : location.pathname.startsWith(item.to);
    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        onClick={onNavigate}
        className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
          active
            ? 'bg-accent text-primary'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        <span>{item.label}</span>
      </NavLink>
    );
  };

  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-card">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
          <Sprout className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-bold leading-tight truncate">AgriDealer Admin</h1>
          <p className="text-xs text-muted-foreground truncate">Territory Head</p>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {(navItems || []).map(renderLink)}
      </nav>

      <div className="p-3 space-y-1 border-t border-border">
        <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
          <CollapsibleTrigger
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              settingsActive
                ? 'bg-accent text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            <Settings className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">Settings</span>
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 transition-transform',
                settingsOpen && 'rotate-180',
              )}
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1 ml-4 pl-3 border-l border-border space-y-1">
            {(settingsChildren || []).map(child => {
              const active = location.pathname === child.to;
              return (
                <NavLink
                  key={child.to}
                  to={child.to}
                  onClick={onNavigate}
                  className={cn(
                    'block px-3 py-1.5 rounded-md text-sm transition-colors',
                    active
                      ? 'bg-accent text-primary font-medium'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  {child.label}
                </NavLink>
              );
            })}
          </CollapsibleContent>
        </Collapsible>
      </div>
    </aside>
  );
};

export default AppSidebar;
