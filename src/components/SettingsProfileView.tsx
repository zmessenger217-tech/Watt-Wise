import React, { useState, useEffect } from 'react';
import {
  BellRing,
  KeyRound,
  Trash2,
  Shield,
  CheckCircle2,
} from 'lucide-react';
import { useWattWise } from '../context/WattWiseContext';
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
} from '../utils/notifications';

const CURRENCIES = [
  { code: 'PKR', label: 'PKR - Pakistani Rupee' },
  { code: 'USD', label: 'USD - US Dollar' },
  { code: 'EUR', label: 'EUR - Euro' },
  { code: 'GBP', label: 'GBP - British Pound' },
  { code: 'INR', label: 'INR - Indian Rupee' },
  { code: 'AED', label: 'AED - UAE Dirham' },
];

const TIMEZONES = [
  'Asia/Karachi',
  'UTC',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
];

export const SettingsProfileView: React.FC<{ mode?: 'settings' | 'profile' }> = ({
  mode = 'settings',
}) => {
  const {
    userProfile,
    updateUserProfile,
    resetPasswordForEmail,
    triggerDeviceTestNotification,
    clearAllUserData,
    deleteCurrentAccount,
    meters,
    months,
    readings,
    isFirestoreBacked,
  } = useWattWise();

  const [name, setName] = useState(userProfile?.name || '');
  const [email, setEmail] = useState(userProfile?.email || '');
  const [currency, setCurrency] = useState(userProfile?.currency || 'PKR');
  const [timezone, setTimezone] = useState(userProfile?.timezone || 'Asia/Karachi');
  const [inAppNotifications, setInAppNotifications] = useState(
    userProfile?.inAppNotifications ?? true
  );
  const [browserPushNotifications, setBrowserPushNotifications] = useState(
    userProfile?.browserPushNotifications ?? true
  );
  const [emailNotifications, setEmailNotifications] = useState(
    userProfile?.emailNotifications ?? false
  );
  const [quietHoursStart, setQuietHoursStart] = useState(
    userProfile?.quietHoursStart || '22:00'
  );
  const [quietHoursEnd, setQuietHoursEnd] = useState(
    userProfile?.quietHoursEnd || '07:00'
  );
  const [readingReminderDays, setReadingReminderDays] = useState(
    String(userProfile?.readingReminderDays || 3)
  );
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  useEffect(() => {
    if (userProfile) {
      setName(userProfile.name);
      setEmail(userProfile.email);
      setCurrency(userProfile.currency);
      setTimezone(userProfile.timezone);
      setInAppNotifications(userProfile.inAppNotifications);
      setBrowserPushNotifications(userProfile.browserPushNotifications);
      setEmailNotifications(userProfile.emailNotifications);
      setQuietHoursStart(userProfile.quietHoursStart);
      setQuietHoursEnd(userProfile.quietHoursEnd);
      setReadingReminderDays(String(userProfile.readingReminderDays));
    }
  }, [userProfile]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateUserProfile({
      name,
      email,
      currency,
      timezone,
      inAppNotifications,
      browserPushNotifications,
      emailNotifications,
      quietHoursStart,
      quietHoursEnd,
      readingReminderDays: Number(readingReminderDays) || 3,
    });
  };

  const handleTogglePush = async (nextVal: boolean) => {
    setBrowserPushNotifications(nextVal);
    if (nextVal && getBrowserNotificationPermission() !== 'granted') {
      await requestBrowserNotificationPermission();
    }
    await updateUserProfile({ browserPushNotifications: nextVal });
  };

  const handlePasswordReset = async () => {
    if (!email) return;
    const msg = await resetPasswordForEmail(email);
    setResetMessage(msg);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          {mode === 'profile' ? 'User Profile & Account' : 'Settings'}
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Manage your account, currency, timezone, and notification preferences
        </p>
      </div>

      {/* Profile Summary Banner (No Profile Picture) */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{name || 'User'}</h2>
          <p className="text-xs text-slate-500">{email}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              {isFirestoreBacked
                ? 'Synced with Firebase Auth & Cloud Firestore'
                : 'Isolated Account Workspace Active'}
            </span>
            <span>·</span>
            <span>{meters.length} Meters</span>
            <span>·</span>
            <span>{months.length} Monthly Records</span>
            <span>·</span>
            <span>{readings.length} Readings</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
          {(meters.length > 0 || months.length > 0 || readings.length > 0) && (
            <button
              type="button"
              onClick={clearAllUserData}
              className="px-3.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete All Data</span>
            </button>
          )}
          <button
            type="button"
            onClick={deleteCurrentAccount}
            className="px-3.5 py-2 rounded-lg border border-red-200 bg-red-50/50 hover:bg-red-50 text-xs font-semibold text-red-600 flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Account</span>
          </button>
        </div>
      </div>

      {/* Account Settings Form */}
      <form
        onSubmit={handleSaveSettings}
        className="bg-white rounded-xl border border-slate-200/90 p-6 md:p-8 shadow-2xs space-y-6"
      >
        <div>
          <h2 className="text-base font-bold text-slate-900 mb-4">Account Settings</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:border-[#1D63ED] outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:border-[#1D63ED] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:border-[#1D63ED] outline-none bg-white"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Timezone (Monthly Boundary)
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:border-[#1D63ED] outline-none bg-white"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Reading Entry Reminder Interval (Days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={readingReminderDays}
                  onChange={(e) => setReadingReminderDays(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:border-[#1D63ED] outline-none tabular-nums"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="mt-5 w-full py-2.5 px-4 rounded-lg bg-[#1D63ED] hover:bg-[#1652C8] text-white text-sm font-semibold shadow-sm transition-colors cursor-pointer"
          >
            Save Changes
          </button>
        </div>

        {/* Notification Preferences */}
        <div className="pt-6 border-t border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              Notification Preferences
            </h2>
            <button
              type="button"
              onClick={triggerDeviceTestNotification}
              className="text-xs font-semibold text-[#1D63ED] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <BellRing className="w-3.5 h-3.5" />
              <span>Test Device Bar Notification</span>
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            <div className="py-3.5 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-800">
                  In-app notifications
                </div>
                <div className="text-[11px] text-slate-500">
                  Real-time banner alerts and badge updates inside WattWise
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={inAppNotifications}
                onClick={() => {
                  const next = !inAppNotifications;
                  setInAppNotifications(next);
                  updateUserProfile({ inAppNotifications: next });
                }}
                className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer ${
                  inAppNotifications ? 'bg-[#1D63ED]' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                    inAppNotifications ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="py-3.5 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-800">
                  Browser push notifications (Device Notification Bar)
                </div>
                <div className="text-[11px] text-slate-500">
                  Sends threshold alerts directly to your device OS notification bar
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={browserPushNotifications}
                onClick={() => handleTogglePush(!browserPushNotifications)}
                className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer ${
                  browserPushNotifications ? 'bg-[#1D63ED]' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                    browserPushNotifications ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="py-3.5 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-800">
                  Email notifications
                </div>
                <div className="text-[11px] text-slate-500">
                  Receive monthly consumption summary and critical 90%+ alerts via email
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={emailNotifications}
                onClick={() => {
                  const next = !emailNotifications;
                  setEmailNotifications(next);
                  updateUserProfile({ emailNotifications: next });
                }}
                className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer ${
                  emailNotifications ? 'bg-[#1D63ED]' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                    emailNotifications ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Quiet Hours */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Quiet Hours Start
              </label>
              <input
                type="time"
                value={quietHoursStart}
                onChange={(e) => setQuietHoursStart(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Quiet Hours End
              </label>
              <input
                type="time"
                value={quietHoursEnd}
                onChange={(e) => setQuietHoursEnd(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
              />
            </div>
          </div>
        </div>

        {/* Security & Password Reset */}
        <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold text-slate-900">Password & Security</h3>
            <p className="text-[11px] text-slate-500">
              Send a password reset link to your registered email address
            </p>
          </div>
          <button
            type="button"
            onClick={handlePasswordReset}
            className="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer self-start"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Reset Password</span>
          </button>
        </div>

        {resetMessage && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-800">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{resetMessage}</span>
          </div>
        )}
      </form>
    </div>
  );
};
