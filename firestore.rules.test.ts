import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  calculateUnitsConsumed,
  calculateRemainingUnits,
  calculateUsagePercentage,
  validateReadingEntry,
  analyzeConsumptionThreshold,
  shouldDispatchThresholdAlert,
  calculateEstimatedBill,
  getNextMonthId,
} from './src/utils/calculations';

describe('WattWise Hardened Firestore Security Rules & Business Logic Verification', () => {
  const rulesContent = fs.readFileSync(path.resolve(__dirname, 'firestore.rules'), 'utf-8');

  it('Enforces Global Default-Deny Catch-All', () => {
    expect(rulesContent).toContain('match /{document=**}');
    expect(rulesContent).toContain('allow read, write: if false;');
  });

  it('Dirty Dozen #1 & #2: Enforces Verified Email & Owner Identity Spoofing Prevention', () => {
    expect(rulesContent).toContain('request.auth != null && request.auth.token.email_verified == true');
    expect(rulesContent).toContain('data.userId == userId && data.userId == request.auth.uid');
  });

  it('Dirty Dozen #3: Prevents Shadow Field Injection via strict hasAll and hasOnly', () => {
    expect(rulesContent).toContain('data.keys().hasAll(');
    expect(rulesContent).toContain('data.keys().hasOnly(');
    expect(rulesContent).toContain('affectedKeys().hasOnly(');
  });

  it('Dirty Dozen #4: Prevents Orphaned Subcollection Writes via Master Gate exists() & get()', () => {
    expect(rulesContent).toContain('userExists(userId)');
    expect(rulesContent).toContain('meterExists(userId, meterId)');
    expect(rulesContent).toContain('monthExists(userId, meterId, monthId)');
  });

  it('Dirty Dozen #5: Prevents ID Poisoning via Regex Guards', () => {
    expect(rulesContent).toContain("id.matches('^[a-zA-Z0-9_\\\\-]+$')");
    expect(rulesContent).toContain("id.matches('^[0-9]{4}-[0-9]{2}$')");
  });

  it('Dirty Dozen #6: Blocks Negative Units Consumed & Invalid Readings', () => {
    expect(rulesContent).toContain('data.unitsConsumed is number && data.unitsConsumed >= 0');
    expect(rulesContent).toContain('data.openingReading is number && data.openingReading >= 0');
    expect(rulesContent).toContain('data.currentReading is number && data.currentReading >= 0');
  });

  it('Dirty Dozen #7 & #8: Enforces Server Timestamp Integrity and Immutable Identity Fields', () => {
    expect(rulesContent).toContain('incoming().createdAt == request.time');
    expect(rulesContent).toContain('incoming().updatedAt == request.time');
    expect(rulesContent).toContain('incoming().createdAt == existing().createdAt');
    expect(rulesContent).toContain('incoming().meterId == existing().meterId');
  });

  it('Dirty Dozen #9 & #10: Enforces Secure List Queries and PII Isolation without get() in list', () => {
    expect(rulesContent).toContain('allow list: if isOwner(userId) &&\n          existing().userId == request.auth.uid;');
    expect(rulesContent).toContain('allow list: if false;');
  });

  it('Dirty Dozen #11 & #12: Enforces String Size Limits and Immutable Audit Logs', () => {
    expect(rulesContent).toContain('data.meterName.size() <= 80');
    expect(rulesContent).toContain('allow update, delete: if false;');
  });
});

describe('WattWise Automated Business Logic Tests', () => {
  it('Calculates units consumed, remaining units, and usage percentage accurately', () => {
    const consumed = calculateUnitsConsumed(12450, 12780);
    expect(consumed).toBe(330);
    expect(calculateRemainingUnits(consumed, 500)).toBe(170);
    expect(calculateUsagePercentage(consumed, 500)).toBe(66);
  });

  it('Prevents negative consumption and validates readings properly', () => {
    expect(validateReadingEntry(12450, 12650, -10, false).isValid).toBe(false);
    expect(validateReadingEntry(12450, 12650, 12500, false).isValid).toBe(false);
    expect(validateReadingEntry(12450, 12650, 12500, true).isValid).toBe(true);
    expect(validateReadingEntry(12450, 12650, 12780, false).isValid).toBe(true);
  });

  it('Transitions months accurately including December to January rollover', () => {
    expect(getNextMonthId('2026-10')).toBe('2026-11');
    expect(getNextMonthId('2026-12')).toBe('2027-01');
  });

  it('Evaluates threshold levels and smart notification intervals accurately', () => {
    expect(analyzeConsumptionThreshold(45).threshold).toBe(0);
    expect(analyzeConsumptionThreshold(66).threshold).toBe(50);
    expect(analyzeConsumptionThreshold(75).reminderIntervalHours).toBe(24);
    expect(analyzeConsumptionThreshold(85).reminderIntervalHours).toBe(24);
    expect(analyzeConsumptionThreshold(92).reminderIntervalHours).toBe(12);
    expect(analyzeConsumptionThreshold(96).reminderIntervalHours).toBe(6);
    expect(analyzeConsumptionThreshold(100).reminderIntervalHours).toBe(3);
    expect(analyzeConsumptionThreshold(112).statusLabel).toBe('Exceeded');

    // First crossing of 80% triggers immediate alert
    const firstCross = shouldDispatchThresholdAlert(
      80,
      50,
      '2026-10-08T10:00:00.000Z',
      '22:00',
      '07:00',
      new Date('2026-10-09T12:00:00.000Z')
    );
    expect(firstCross.shouldSend).toBe(true);
    expect(firstCross.isRecurringReminder).toBe(false);

    // Same threshold within interval does not duplicate alert
    const duplicateCheck = shouldDispatchThresholdAlert(
      80,
      80,
      '2026-10-09T10:00:00.000Z',
      '22:00',
      '07:00',
      new Date('2026-10-09T12:00:00.000Z')
    );
    expect(duplicateCheck.shouldSend).toBe(false);
  });

  it('Calculates estimated bill with rate, fixed charges, additional charges, and tax', () => {
    const bill = calculateEstimatedBill(330, 35, 100, 0, 0);
    expect(bill.energyCharges).toBe(11550);
    expect(bill.totalEstimatedBill).toBe(11650);
  });
});
