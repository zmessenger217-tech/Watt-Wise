import React, { useState, useMemo } from 'react';
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Home,
  Check,
  Trash2,
  BellRing,
} from 'lucide-react';
import { useWattWise } from '../context/WattWiseContext';
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
} from '../utils/notifications';
import { AppNotification } from '../types';

export const NotificationsView: React.FC = () => {
  const {
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    triggerDeviceTestNotification,
  } = useWattWise();

  const [filterTab, setFilterTab] = useState<'all' | 'unread' | 'alert' | 'reminder'>('all');
  const [permissionState, setPermissionState] = useState<string>(
    getBrowserNotificationPermission()
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (filterTab === 'unread') return !n.isRead;
      if (filterTab === 'alert') return n.category === 'alert';
      if (filterTab === 'reminder') return n.category === 'reminder';
      return true;
    });
  }, [notifications, filterTab]);

  const handleEnableDeviceNotifications = async () => {
    const res = await requestBrowserNotificationPermission();
    setPermissionState(res);
    if (res === 'granted') {
      await triggerDeviceTestNotification();
    }
  };

  const renderIcon = (notif: AppNotification) => {
    if (notif.type === 'reminder') {
      return (
        <div className="w-11 h-11 rounded-full bg-red-500 text-white flex items-center justify-center shrink-0">
          <Bell className="w-5 h-5" />
        </div>
      );
    }
    if (
      notif.type === 'warning' ||
      notif.type === 'strong_warning' ||
      notif.type === 'high_alert' ||
      notif.type === 'critical' ||
      notif.type === 'limit_reached' ||
      notif.type === 'limit_exceeded'
    ) {
      return (
        <div className="w-11 h-11 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </div>
      );
    }
    if (notif.type === 'report_ready' || notif.type === 'month_started') {
      return (
        <div className="w-11 h-11 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5" />
        </div>
      );
    }
    if (notif.meterName.toLowerCase().includes('home')) {
      return (
        <div className="w-11 h-11 rounded-full bg-orange-500 text-white flex items-center justify-center shrink-0">
          <Home className="w-5 h-5" />
        </div>
      );
    }
    return (
      <div className="w-11 h-11 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
        <CheckCircle2 className="w-5 h-5" />
      </div>
    );
  };

  const formatTimestamp = (iso?: string) => {
    if (!iso) return 'Just now';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Notifications</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Stay updated with your per-meter electricity alerts and reminders
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={triggerDeviceTestNotification}
            className="px-3.5 py-2 rounded-lg bg-[#1D63ED] hover:bg-[#1652C8] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer whitespace-nowrap"
          >
            <BellRing className="w-3.5 h-3.5" />
            <span>Send Test to Device Bar</span>
          </button>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllNotificationsRead}
              className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Mark All Read</span>
            </button>
          )}
        </div>
      </div>

      {/* Browser / OS Device Notification Bar Permission Banner */}
      {permissionState !== 'granted' && (
        <div className="bg-blue-50/90 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs text-blue-950">
            <BellRing className="w-5 h-5 text-[#1D63ED] shrink-0" />
            <div>
              <div className="font-bold">Enable Device Notification Bar Alerts</div>
              <div className="text-blue-800/80 mt-0.5">
                Allow browser push notifications so WattWise can send consumption warnings directly to your device notification bar.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleEnableDeviceNotifications}
            className="px-4 py-2 rounded-lg bg-[#1D63ED] text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            Allow Device Notifications
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setFilterTab('all')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            filterTab === 'all'
              ? 'bg-[#1D63ED] text-white shadow-2xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setFilterTab('unread')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            filterTab === 'unread'
              ? 'bg-[#1D63ED] text-white shadow-2xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Unread ({unreadCount})
        </button>
        <button
          type="button"
          onClick={() => setFilterTab('alert')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            filterTab === 'alert'
              ? 'bg-[#1D63ED] text-white shadow-2xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Alerts
        </button>
        <button
          type="button"
          onClick={() => setFilterTab('reminder')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            filterTab === 'reminder'
              ? 'bg-[#1D63ED] text-white shadow-2xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Reminders
        </button>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-500">
            No notifications in this view.
          </div>
        ) : (
          filteredNotifications.map((notif) => (
            <div
              key={notif.notificationId}
              className={`bg-white rounded-xl border p-4 sm:p-5 flex items-start justify-between gap-4 transition-all ${
                !notif.isRead
                  ? 'border-blue-200 shadow-xs'
                  : 'border-slate-200/80 opacity-90'
              }`}
            >
              <div className="flex items-start gap-4 min-w-0">
                {renderIcon(notif)}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-slate-900">{notif.title}</h3>
                    {notif.threshold > 0 && (
                      <span className="text-[11px] font-mono font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                        {notif.threshold}% Threshold
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {notif.message}
                  </p>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-2">
                    <span>{formatTimestamp(notif.timestampIso)}</span>
                    <span>·</span>
                    <span>Meter: {notif.meterName}</span>
                    <span>·</span>
                    <span>Channels: {notif.deliveryChannel}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => markNotificationRead(notif.notificationId, !notif.isRead)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                    !notif.isRead
                      ? 'bg-red-50 text-red-600 hover:bg-red-100'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {!notif.isRead ? 'Unread' : 'Read'}
                </button>
                <button
                  type="button"
                  onClick={() => deleteNotification(notif.notificationId)}
                  aria-label="Delete notification"
                  className="p-1 text-slate-300 hover:text-red-500 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
