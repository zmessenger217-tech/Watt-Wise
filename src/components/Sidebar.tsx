import React from 'react';
import {
  LayoutDashboard,
  Gauge,
  PlusCircle,
  ClipboardEdit,
  Sliders,
  Bell,
  History,
  FileSpreadsheet,
  Calculator,
  CalendarPlus,
  Settings,
  UserCircle,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { PageId } from '../types';
import { useWattWise } from '../context/WattWiseContext';
import { WattWiseLogo } from './MeterIconBadge';

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (val: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (val: boolean) => void;
}

interface NavItem {
  id: PageId;
  label: string;
  icon: React.FC<{ className?: string }>;
  badge?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
}) => {
  const { activePage, setActivePage, setEditingMeter, notifications, logoutUser } = useWattWise();

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'meters', label: 'My Meters', icon: Gauge },
    { id: 'add-meter', label: 'Add Meter', icon: PlusCircle },
    { id: 'enter-reading', label: 'Enter Reading', icon: ClipboardEdit },
    { id: 'monthly-limits', label: 'Monthly Limits', icon: Sliders },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadCount },
    { id: 'history', label: 'History', icon: History },
    { id: 'reports', label: 'Reports & Export', icon: FileSpreadsheet },
    { id: 'bill-estimator', label: 'Bill Estimator', icon: Calculator },
    { id: 'start-new-month', label: 'Start New Month', icon: CalendarPlus },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'profile', label: 'Profile', icon: UserCircle },
  ];

  const handleSelectPage = (page: PageId) => {
    if (page === 'add-meter') {
      setEditingMeter(null);
    }
    setActivePage(page);
    setMobileOpen(false);
  };

  const sidebarContent = (
    <div className="h-full flex flex-col bg-gradient-to-b from-[#081C3E] via-[#0B234C] to-[#0D2B5C] text-white select-none">
      {/* Brand Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-white/10 shrink-0">
        {!collapsed ? (
          <button
            type="button"
            onClick={() => handleSelectPage('dashboard')}
            className="flex items-center gap-2.5 text-left cursor-pointer"
          >
            <WattWiseLogo size="sm" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => handleSelectPage('dashboard')}
            className="mx-auto cursor-pointer"
            title="WattWise"
          >
            <div className="w-8 h-8 rounded-full bg-[#1D63ED] flex items-center justify-center font-bold text-white">
              ⚡
            </div>
          </button>
        )}

        {/* Desktop collapse button */}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label="Toggle sidebar width"
          className="hidden lg:flex w-7 h-7 rounded-md items-center justify-center text-blue-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        {/* Mobile close button */}
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation menu"
          className="lg:hidden w-8 h-8 rounded-md flex items-center justify-center text-blue-200 hover:text-white hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectPage(item.id)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#1D63ED] text-white shadow-sm font-semibold'
                  : 'text-blue-100/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="truncate whitespace-nowrap">{item.label}</span>}
              </div>

              {!collapsed && item.badge !== undefined && item.badge > 0 && (
                <span className="ml-2 px-1.5 py-0.5 text-[11px] font-bold rounded-full bg-red-500 text-white tabular-nums shrink-0">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Logout Button */}
      <div className="p-2.5 border-t border-white/10 shrink-0">
        <button
          type="button"
          onClick={logoutUser}
          title={collapsed ? 'Logout' : undefined}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium text-blue-100/80 hover:bg-red-500/20 hover:text-red-200 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span className="whitespace-nowrap">Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 transition-all duration-200 ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Slide-Out Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-64 max-w-[80vw] h-full z-10 shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
};
