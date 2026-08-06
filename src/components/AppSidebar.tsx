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
  MapPin,
  Map, 
  FileText, 
  CalendarDays,
  Clock ,
  Receipt,
  ShieldCheck,
  Store
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true, module: 'dashboard' },
  { to: '/roles', label: 'Roles & Access', icon: ShieldCheck, module: 'role_management' },
  { to: '/sales-executives', label: 'Sales Executives', icon: UserCog, module: 'sales_executives' },
  { to: '/distributors', label: 'Distributors', icon: Truck, module: 'distributors' },
  { to: '/dealers', label: 'Dealers', icon: Users, module: 'dealers' },
  { to: '/farmers', label: 'Farmers', icon: Wheat, module: 'farmers' },
  { to: '/fpos', label: 'FPOs', icon: Sprout, module: 'fpos' },
  { to: '/routes', label: 'Territory Routes', icon: MapPin, module: 'routes' },
  { to: '/attendance', label: 'Attendance', icon: Clock, module: 'attendance' }, 
  { to: '/expenses', label: 'Expenses', icon: Receipt, module: 'expenses' },
  { to: '/locations', label: 'Location Master', icon: Map, module: 'locations' },
  { to: '/shifts', label: 'Shifts', icon: CalendarDays, module: 'shifts' },
  { to: '/farm-diary-masters', label: 'Farm Diary Masters', icon: FileText, module: 'farm_diary_masters' },
  { to: '/fspp-approvals', label: 'FSPP Approvals', icon: FileText, module: 'fspp_approvals' },
  { to: '/retail', label: 'Retail & Inventory', icon: Store, module: 'retail' },
  { to: '/farm-diary', label: 'Farm Diary', icon: FileText, module: 'farm_diary' },
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
  
  // 1. FETCH CURRENT AUTH USER
  const { session, role } = useAuth(); 

  // 2. FETCH RELEVANT DYNAMIC PERMISSIONS FOR THIS USER
  const { getModulePerm } = usePermissions(session?.user?.id);

  // 3. FILTER NAV ITEMS DYNAMICALLY BASED ON PERMISSIONS
  const filteredNavItems = navItems.filter((item) => {
    // Dashboard is always visible to everyone
    if (item.label === 'Dashboard') return true;

    // For all other pages, read permissions dynamically from user_permissions table
    const perm = getModulePerm(item.module || '');
    return perm.can_view;
  });

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
    <aside className="flex h-screen w-full flex-col border-r border-border bg-card overflow-hidden">
      {/* 1. Logo Header (Always stays at top) */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border flex-shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
          <Sprout className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-bold leading-tight truncate">Field Commander Admin</h1>
          <p className="text-xs text-muted-foreground truncate uppercase">
            {role || 'Staff'}
          </p>
        </div>
      </div>

      {/* 2. Unified Scroll Window (Links and Settings roll inside here) */}
      <div className="flex-1 p-3 space-y-4 overflow-y-auto">
        <nav className="space-y-1">
          {filteredNavItems.map(renderLink)}
        </nav>

        {/* Only show global settings to the Super Admin */}
        {role === 'Super Admin' && (
          <div className="pt-3 border-t border-border">
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
        )}
      </div>
    </aside>
  );
};

export default AppSidebar;