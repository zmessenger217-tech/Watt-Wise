import React, { useState, useEffect } from 'react';
import {
  Menu,
  Bell,
  ChevronDown,
  X,
  CheckCircle2,
  AlertTriangle,
  Info,
  LogOut,
  User,
  Settings,
  Clock,
} from 'lucide-react';
import { WattWiseProvider, useWattWise } from './context/WattWiseContext';
import { formatLiveDateTime } from './utils/calculations';
import { AuthScreen } from './components/AuthScreen';
import { Sidebar } from './components/Sidebar';
import { SetupWizardModal } from './components/SetupWizardModal';
import { DashboardView } from './components/DashboardView';
import { MyMetersView } from './components/MyMetersView';
import { AddMeterView } from './components/AddMeterView';
import { EnterReadingView } from './components/EnterReadingView';
import { MonthlyLimitsView } from './components/MonthlyLimitsView';
import { NotificationsView } from './components/NotificationsView';
import { StartNewMonthView } from './components/StartNewMonthView';
import { HistoryView } from './components/HistoryView';
import { ReportsExportView } from './components/ReportsExportView';
import { BillEstimatorView } from './components/BillEstimatorView';
import { SettingsProfileView } from './components/SettingsProfileView';
import { PWAInstallButton } from './components/PWAInstallButton';

const MainWorkspace: React.FC = () => {
  const {
    isAuthReady,
    isAuthenticated,
    userProfile,
    activePage,
    setActivePage,
    notifications,
    toasts,
    dismissToast,
    firebaseConsoleNotice,
    dismissFirebaseConsoleNotice,
    logoutUser,
  } = useWattWise();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const liveClock = formatLiveDateTime(now);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen w-full bg-[#F4F7FB] flex items-center justify-center">
        <div className="text-sm font-semibold text-slate-600">
          Loading WattWise workspace...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardView />;
      case 'meters':
        return <MyMetersView />;
      case 'add-meter':
        return <AddMeterView />;
      case 'enter-reading':
        return <EnterReadingView />;
      case 'monthly-limits':
        return <MonthlyLimitsView />;
      case 'notifications':
        return <NotificationsView />;
      case 'history':
        return <HistoryView />;
      case 'reports':
        return <ReportsExportView />;
      case 'bill-estimator':
        return <BillEstimatorView />;
      case 'start-new-month':
        return <StartNewMonthView />;
      case 'settings':
        return <SettingsProfileView mode="settings" />;
      case 'profile':
        return <SettingsProfileView mode="profile" />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="h-screen w-full flex overflow-hidden bg-[#F4F7FB]">
      {/* Left Sidebar Navigation */}
      <Sidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        mobileOpen={mobileMenuOpen}
        setMobileOpen={setMobileMenuOpen}
      />

      {/* Right Workspace Column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200/90 px-4 md:px-8 flex items-center justify-between gap-8 shrink-0">
          {/* Left Zone: Mobile Menu + Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-xs font-semibold text-slate-500 whitespace-nowrap truncate">
              WattWise /{' '}
              <span className="text-slate-900 capitalize">
                {activePage.replace(/-/g, ' ')}
              </span>
            </span>
          </div>

          {/* Right Zone: Real-Time Clock, PWA Install, Notification Bell & User Account Menu */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs font-medium text-slate-600 tabular-nums">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <Clock className="w-3.5 h-3.5 text-[#1D63ED] shrink-0" />
              <span className="font-semibold text-slate-800">
                {liveClock.dayName}, {liveClock.dateFormatted}
              </span>
              <span className="text-slate-300">|</span>
              <span className="font-mono font-bold text-[#1D63ED]">
                {liveClock.timeFormatted}
              </span>
            </div>

            <PWAInstallButton />

            <button
              type="button"
              onClick={() => setActivePage('notifications')}
              aria-label="View notifications"
              className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {unreadCount}
                </span>
              )}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 py-1.5 px-3 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <span className="text-xs font-semibold text-slate-800 whitespace-nowrap">
                  {userProfile?.name || 'Account'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-30">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      setActivePage('profile');
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                  >
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>My Profile</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      setActivePage('settings');
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-400" />
                    <span>Settings</span>
                  </button>
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      logoutUser();
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Optional Firebase Console Guide Banner */}
        {firebaseConsoleNotice && (
          <div className="bg-blue-50 border-b border-blue-200 px-6 py-2.5 flex items-center justify-between gap-4 text-xs text-blue-900">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-[#1D63ED] shrink-0" />
              <span>{firebaseConsoleNotice}</span>
            </div>
            <button
              type="button"
              onClick={dismissFirebaseConsoleNotice}
              className="text-blue-600 hover:text-blue-900 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main Content Viewport */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">{renderPage()}</div>
        </main>
      </div>

      {/* First-Time Setup Wizard */}
      <SetupWizardModal />

      {/* Floating In-App Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed bottom-5 right-5 z-50 space-y-2.5 max-w-sm w-full pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="pointer-events-auto bg-slate-900 text-white rounded-xl shadow-xl border border-slate-700 p-4 flex items-start justify-between gap-3"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                {toast.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : toast.type === 'warning' ? (
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <div className="text-xs font-bold">{toast.title}</div>
                  <div className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                    {toast.message}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="text-slate-400 hover:text-white shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <WattWiseProvider>
      <MainWorkspace />
    </WattWiseProvider>
  );
}
