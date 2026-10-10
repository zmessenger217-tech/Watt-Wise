import { NotificationSeverityType } from '../types';

export interface ThresholdAnalysis {
  threshold: number;
  statusLabel: 'Active' | 'Normal' | 'Warning' | 'High Alert' | 'Critical' | 'Limit Reached' | 'Exceeded';
  historyStatus: 'Normal' | 'Warning' | 'Reached' | 'Exceeded';
  notificationType: NotificationSeverityType | null;
  reminderIntervalHours: number | null;
  colorHex: string;
  bgClass: string;
  textClass: string;
  barClass: string;
  description: string;
}

export function calculateUnitsConsumed(openingReading: number, currentReading: number): number {
  const diff = currentReading - openingReading;
  return diff >= 0 ? Math.round(diff * 100) / 100 : 0;
}

export function calculateRemainingUnits(unitsConsumed: number, monthlyLimit: number): number {
  const diff = monthlyLimit - unitsConsumed;
  return diff >= 0 ? Math.round(diff * 100) / 100 : 0;
}

export function calculateUsagePercentage(unitsConsumed: number, monthlyLimit: number): number {
  if (monthlyLimit <= 0) return 0;
  return Math.round((unitsConsumed / monthlyLimit) * 100);
}

export interface ReadingValidationResult {
  isValid: boolean;
  error?: string;
}

export function validateReadingEntry(
  openingReading: number,
  previousReading: number,
  newReading: number,
  isRolloverOrCorrection: boolean
): ReadingValidationResult {
  if (Number.isNaN(newReading) || !Number.isFinite(newReading)) {
    return { isValid: false, error: 'Please enter a valid numeric meter reading.' };
  }
  if (newReading < 0) {
    return { isValid: false, error: 'Meter readings cannot be negative.' };
  }
  if (newReading > 999999999) {
    return { isValid: false, error: 'Meter reading exceeds maximum allowed digits.' };
  }
  if (!isRolloverOrCorrection) {
    if (newReading < openingReading) {
      return {
        isValid: false,
        error: `Current reading (${newReading.toLocaleString()}) cannot be lower than the month's opening reading (${openingReading.toLocaleString()}). Enable "Reading Correction / Meter Rollover" if you are correcting an earlier mistake.`,
      };
    }
    if (newReading < previousReading) {
      return {
        isValid: false,
        error: `Current reading (${newReading.toLocaleString()}) cannot be lower than the previous reading (${previousReading.toLocaleString()}). Enable "Reading Correction / Meter Rollover" to log an audited adjustment.`,
      };
    }
  } else {
    if (newReading < openingReading) {
      return {
        isValid: false,
        error: `Corrected reading (${newReading.toLocaleString()}) must still be at least the month's opening reading (${openingReading.toLocaleString()}) so consumed units are non-negative.`,
      };
    }
  }
  return { isValid: true };
}

export function analyzeConsumptionThreshold(percentage: number): ThresholdAnalysis {
  if (percentage > 100) {
    return {
      threshold: 105,
      statusLabel: 'Exceeded',
      historyStatus: 'Exceeded',
      notificationType: 'limit_exceeded',
      reminderIntervalHours: 3,
      colorHex: '#DC2626',
      bgClass: 'bg-red-50',
      textClass: 'text-red-700',
      barClass: 'bg-red-600',
      description: 'Monthly unit limit exceeded — reminders every 3 hours',
    };
  }
  if (percentage === 100) {
    return {
      threshold: 100,
      statusLabel: 'Limit Reached',
      historyStatus: 'Reached',
      notificationType: 'limit_reached',
      reminderIntervalHours: 3,
      colorHex: '#DC2626',
      bgClass: 'bg-red-50',
      textClass: 'text-red-700',
      barClass: 'bg-red-500',
      description: '100% of monthly unit limit reached — reminders every 3 hours',
    };
  }
  if (percentage >= 95) {
    return {
      threshold: 95,
      statusLabel: 'Critical',
      historyStatus: 'Warning',
      notificationType: 'critical',
      reminderIntervalHours: 6,
      colorHex: '#EA580C',
      bgClass: 'bg-orange-50',
      textClass: 'text-orange-700',
      barClass: 'bg-orange-500',
      description: 'Critical usage (95%+) — reminders every 6 hours',
    };
  }
  if (percentage >= 90) {
    return {
      threshold: 90,
      statusLabel: 'High Alert',
      historyStatus: 'Warning',
      notificationType: 'high_alert',
      reminderIntervalHours: 12,
      colorHex: '#EA580C',
      bgClass: 'bg-orange-50',
      textClass: 'text-orange-700',
      barClass: 'bg-orange-500',
      description: 'High usage alert (90%+) — reminders every 12 hours',
    };
  }
  if (percentage >= 80) {
    return {
      threshold: 80,
      statusLabel: 'Warning',
      historyStatus: 'Warning',
      notificationType: 'strong_warning',
      reminderIntervalHours: 24,
      colorHex: '#D97706',
      bgClass: 'bg-amber-50',
      textClass: 'text-amber-700',
      barClass: 'bg-amber-500',
      description: 'Strong usage warning (80%+) — daily reminder',
    };
  }
  if (percentage >= 70) {
    return {
      threshold: 70,
      statusLabel: 'Warning',
      historyStatus: 'Warning',
      notificationType: 'warning',
      reminderIntervalHours: 24,
      colorHex: '#D97706',
      bgClass: 'bg-amber-50',
      textClass: 'text-amber-700',
      barClass: 'bg-amber-500',
      description: 'Usage warning (70%+) — optional daily reminder',
    };
  }
  if (percentage >= 50) {
    return {
      threshold: 50,
      statusLabel: 'Active',
      historyStatus: 'Normal',
      notificationType: 'usage_update',
      reminderIntervalHours: null,
      colorHex: '#16A34A',
      bgClass: 'bg-emerald-50',
      textClass: 'text-emerald-700',
      barClass: 'bg-emerald-500',
      description: 'Normal milestone (50%+ consumed)',
    };
  }
  return {
    threshold: 0,
    statusLabel: 'Active',
    historyStatus: 'Normal',
    notificationType: null,
    reminderIntervalHours: null,
    colorHex: '#16A34A',
    bgClass: 'bg-emerald-50',
    textClass: 'text-emerald-700',
    barClass: 'bg-emerald-500',
    description: 'Safe consumption below 50%',
  };
}

export function isWithinQuietHours(
  nowDate: Date,
  quietStart: string,
  quietEnd: string
): boolean {
  const [startH, startM] = quietStart.split(':').map(Number);
  const [endH, endM] = quietEnd.split(':').map(Number);
  if (Number.isNaN(startH) || Number.isNaN(endH)) return false;

  const currentMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
  const startMinutes = startH * 60 + (startM || 0);
  const endMinutes = endH * 60 + (endM || 0);

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
  // Crosses midnight (e.g. 22:00 to 07:00)
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

export function shouldDispatchThresholdAlert(
  percentage: number,
  lastAlertThreshold: number,
  lastAlertSentAt: string,
  quietHoursStart: string,
  quietHoursEnd: string,
  now: Date = new Date()
): { shouldSend: boolean; analysis: ThresholdAnalysis; isRecurringReminder: boolean } {
  const analysis = analyzeConsumptionThreshold(percentage);

  if (analysis.threshold === 0 || !analysis.notificationType) {
    return { shouldSend: false, analysis, isRecurringReminder: false };
  }

  // Immediate alert when crossing a higher threshold milestone for the first time
  if (analysis.threshold > lastAlertThreshold) {
    return { shouldSend: true, analysis, isRecurringReminder: false };
  }

  // Recurring reminder check based on smart frequency schedule
  if (analysis.reminderIntervalHours && lastAlertSentAt) {
    if (isWithinQuietHours(now, quietHoursStart, quietHoursEnd)) {
      return { shouldSend: false, analysis, isRecurringReminder: false };
    }
    const lastSentTime = new Date(lastAlertSentAt).getTime();
    if (!Number.isNaN(lastSentTime)) {
      const elapsedHours = (now.getTime() - lastSentTime) / (1000 * 60 * 60);
      if (elapsedHours >= analysis.reminderIntervalHours) {
        return { shouldSend: true, analysis, isRecurringReminder: true };
      }
    }
  }

  return { shouldSend: false, analysis, isRecurringReminder: false };
}

export interface BillEstimateBreakdown {
  unitsConsumed: number;
  ratePerUnit: number;
  energyCharges: number;
  fixedCharges: number;
  additionalCharges: number;
  taxAmount: number;
  totalEstimatedBill: number;
}

export function calculateEstimatedBill(
  unitsConsumed: number,
  ratePerUnit: number,
  fixedCharges: number = 0,
  additionalCharges: number = 0,
  taxPercentage: number = 0
): BillEstimateBreakdown {
  const safeUnits = Math.max(0, unitsConsumed);
  const safeRate = Math.max(0, ratePerUnit);
  const safeFixed = Math.max(0, fixedCharges);
  const safeAdd = Math.max(0, additionalCharges);
  const safeTax = Math.max(0, Math.min(100, taxPercentage));

  const energyCharges = Math.round(safeUnits * safeRate * 100) / 100;
  const subtotal = energyCharges + safeFixed + safeAdd;
  const taxAmount = Math.round(subtotal * (safeTax / 100) * 100) / 100;
  const totalEstimatedBill = Math.round((subtotal + taxAmount) * 100) / 100;

  return {
    unitsConsumed: safeUnits,
    ratePerUnit: safeRate,
    energyCharges,
    fixedCharges: safeFixed,
    additionalCharges: safeAdd,
    taxAmount,
    totalEstimatedBill,
  };
}

export function getNextMonthId(currentMonthId: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(currentMonthId);
  if (!match) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  let year = parseInt(match[1], 10);
  let month = parseInt(match[2], 10);
  if (month === 12) {
    year += 1;
    month = 1;
  } else {
    month += 1;
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function formatMonthLabel(monthId: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthId);
  if (!match) return monthId;
  const year = parseInt(match[1], 10);
  const monthIdx = parseInt(match[2], 10) - 1;
  const date = new Date(year, monthIdx, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function calculateDailyStats(
  unitsConsumed: number,
  monthlyLimit: number,
  monthId: string,
  referenceDateStr?: string
): {
  daysElapsed: number;
  daysInMonth: number;
  dailyAverage: number;
  estimatedDaysRemainingBeforeLimit: number | null;
  projectedMonthlyUnits: number;
} {
  const match = /^(\d{4})-(\d{2})$/.exec(monthId);
  const now = referenceDateStr ? new Date(referenceDateStr) : new Date();
  const year = match ? parseInt(match[1], 10) : now.getFullYear();
  const month = match ? parseInt(match[2], 10) : now.getMonth() + 1;
  const daysInMonth = new Date(year, month, 0).getDate();

  let daysElapsed = now.getDate();
  if (Number.isNaN(daysElapsed) || daysElapsed < 1) {
    daysElapsed = 9;
  }
  daysElapsed = Math.min(daysElapsed, daysInMonth);

  const dailyAverage =
    daysElapsed > 0 ? Math.round((unitsConsumed / daysElapsed) * 10) / 10 : 0;
  const remainingUnits = Math.max(0, monthlyLimit - unitsConsumed);
  const estimatedDaysRemainingBeforeLimit =
    dailyAverage > 0 ? Math.max(0, Math.floor(remainingUnits / dailyAverage)) : null;
  const projectedMonthlyUnits = Math.round(dailyAverage * daysInMonth);

  return {
    daysElapsed,
    daysInMonth,
    dailyAverage,
    estimatedDaysRemainingBeforeLimit,
    projectedMonthlyUnits,
  };
}
