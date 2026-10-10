import {
  ElectricityMeter,
  MonthlyRecord,
  MeterReading,
  AppNotification,
  AuditLog,
  UserProfile,
} from '../types';

export function createDefaultUserProfile(
  userId: string,
  name: string = '',
  email: string = ''
): UserProfile {
  return {
    userId,
    name: name.trim().slice(0, 100) || 'User',
    email: email.trim().slice(0, 254),
    currency: 'PKR',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Karachi',
    inAppNotifications: true,
    browserPushNotifications: true,
    emailNotifications: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
    readingReminderDays: 3,
    setupCompleted: false,
  };
}

export function createEmptyDataset(): {
  meters: ElectricityMeter[];
  months: MonthlyRecord[];
  readings: MeterReading[];
  notifications: AppNotification[];
  auditLogs: AuditLog[];
} {
  return {
    meters: [],
    months: [],
    readings: [],
    notifications: [],
    auditLogs: [],
  };
}
