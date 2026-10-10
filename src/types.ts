export type PageId =
  | 'dashboard'
  | 'meters'
  | 'add-meter'
  | 'enter-reading'
  | 'monthly-limits'
  | 'notifications'
  | 'history'
  | 'reports'
  | 'bill-estimator'
  | 'start-new-month'
  | 'settings'
  | 'profile';

export type MeterIconType = 'home' | 'office' | 'shop' | 'factory' | 'apartment';

export type NotificationSeverityType =
  | 'usage_update'
  | 'warning'
  | 'strong_warning'
  | 'high_alert'
  | 'critical'
  | 'limit_reached'
  | 'limit_exceeded'
  | 'reminder'
  | 'month_started'
  | 'meter_added'
  | 'report_ready';

export type NotificationCategory = 'alert' | 'reminder' | 'system';

export interface UserProfile {
  userId: string;
  name: string;
  email: string;
  currency: string;
  timezone: string;
  inAppNotifications: boolean;
  browserPushNotifications: boolean;
  emailNotifications: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  readingReminderDays: number;
  setupCompleted: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ElectricityMeter {
  meterId: string;
  userId: string;
  meterName: string;
  meterNumber: string;
  ownerName: string;
  location: string;
  provider: string;
  iconType: MeterIconType;
  monthlyLimit: number;
  estimatedRate: number;
  fixedCharges: number;
  additionalCharges: number;
  taxPercentage: number;
  currentMonthId: string;
  openingReading: number;
  previousReading: number;
  previousReadingDate: string;
  currentReading: number;
  lastReadingDate: string;
  unitsConsumed: number;
  lastClosingReading: number;
  lastAlertThreshold: number;
  lastAlertSentAt: string;
  isActive: boolean;
  isArchived: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface MonthlyRecord {
  monthId: string;
  meterId: string;
  userId: string;
  meterName: string;
  meterNumber: string;
  openingReading: number;
  currentReading: number;
  closingReading: number;
  unitsConsumed: number;
  monthlyLimitSnapshot: number;
  estimatedRateSnapshot: number;
  fixedChargesSnapshot: number;
  estimatedCost: number;
  status: 'active' | 'finalized';
  readingsCount: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface MeterReading {
  readingId: string;
  meterId: string;
  monthId: string;
  userId: string;
  readingValue: number;
  previousReadingValue: number;
  unitsSincePreviousReading: number;
  totalMonthUnits: number;
  readingDate: string;
  note: string;
  isRolloverOrCorrection: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AppNotification {
  notificationId: string;
  userId: string;
  meterId: string;
  meterName: string;
  monthId: string;
  type: NotificationSeverityType;
  category: NotificationCategory;
  title: string;
  message: string;
  threshold: number;
  isRead: boolean;
  deliveryChannel: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  timestampIso?: string;
}

export interface AuditLog {
  logId: string;
  userId: string;
  meterId: string;
  monthId: string;
  action: string;
  previousValue: string;
  newValue: string;
  reason: string;
  createdAt?: unknown;
  timestampIso?: string;
}

export const VALIDATION_CONSTRAINTS = {
  ID_REGEX: /^[a-zA-Z0-9_\-]+$/,
  MONTH_ID_REGEX: /^[0-9]{4}-[0-9]{2}$/,
  MAX_ID_LEN: 128,
  MAX_NAME_LEN: 100,
  MAX_EMAIL_LEN: 254,
  MAX_METER_NAME_LEN: 80,
  MAX_METER_NUMBER_LEN: 60,
  MAX_LOCATION_LEN: 160,
  MAX_PROVIDER_LEN: 80,
  MAX_NOTE_LEN: 200,
  MAX_TITLE_LEN: 120,
  MAX_MESSAGE_LEN: 400,
  MAX_AUDIT_LEN: 300,
} as const;
