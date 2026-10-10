import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Edit2,
  X,
  RotateCcw,
} from 'lucide-react';
import { useWattWise } from '../context/WattWiseContext';
import {
  calculateUnitsConsumed,
  calculateRemainingUnits,
  calculateUsagePercentage,
  validateReadingEntry,
  analyzeConsumptionThreshold,
  calculateDailyStats,
} from '../utils/calculations';
import { MeterReading } from '../types';

export const EnterReadingView: React.FC = () => {
  const {
    meters,
    readings,
    selectedMeterId,
    setSelectedMeterId,
    recordReading,
    correctReadingEntry,
  } = useWattWise();

  const activeMeters = useMemo(() => meters.filter((m) => !m.isArchived), [meters]);

  const currentMeter = useMemo(() => {
    return (
      activeMeters.find((m) => m.meterId === selectedMeterId) ||
      activeMeters[0] ||
      null
    );
  }, [activeMeters, selectedMeterId]);

  const [readingDate, setReadingDate] = useState('2026-10-09');
  const [readingInput, setReadingInput] = useState('');
  const [note, setNote] = useState('');
  const [isRolloverOrCorrection, setIsRolloverOrCorrection] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reading correction modal state
  const [correctingReading, setCorrectingReading] = useState<MeterReading | null>(null);
  const [correctedValue, setCorrectedValue] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');

  useEffect(() => {
    if (currentMeter) {
      setReadingInput(String(currentMeter.currentReading));
      setErrorMessage(null);
    }
  }, [currentMeter]);

  // Live automatic calculation preview
  const liveCalc = useMemo(() => {
    if (!currentMeter) return null;
    const numericVal = Number(readingInput);
    const validation = validateReadingEntry(
      currentMeter.openingReading,
      currentMeter.currentReading,
      numericVal,
      isRolloverOrCorrection
    );

    const effectiveReading =
      !Number.isNaN(numericVal) && numericVal >= currentMeter.openingReading
        ? numericVal
        : currentMeter.currentReading;

    const unitsConsumed = calculateUnitsConsumed(
      currentMeter.openingReading,
      effectiveReading
    );
    const remainingUnits = calculateRemainingUnits(
      unitsConsumed,
      currentMeter.monthlyLimit
    );
    const pct = calculateUsagePercentage(unitsConsumed, currentMeter.monthlyLimit);
    const thresholdInfo = analyzeConsumptionThreshold(pct);
    const dailyStats = calculateDailyStats(
      unitsConsumed,
      currentMeter.monthlyLimit,
      currentMeter.currentMonthId,
      readingDate
    );

    return {
      validation,
      unitsConsumed,
      remainingUnits,
      pct,
      thresholdInfo,
      dailyStats,
    };
  }, [currentMeter, readingInput, isRolloverOrCorrection, readingDate]);

  const recentMeterReadings = useMemo(() => {
    if (!currentMeter) return [];
    return readings
      .filter(
        (r) =>
          r.meterId === currentMeter.meterId &&
          r.monthId === currentMeter.currentMonthId
      )
      .sort((a, b) => b.readingDate.localeCompare(a.readingDate));
  }, [readings, currentMeter]);

  const handleSaveReading = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMeter) return;
    setErrorMessage(null);
    setSavedBanner(null);

    const val = Number(readingInput);
    const check = validateReadingEntry(
      currentMeter.openingReading,
      currentMeter.currentReading,
      val,
      isRolloverOrCorrection
    );
    if (!check.isValid) {
      setErrorMessage(check.error || 'Invalid reading.');
      return;
    }

    setIsSubmitting(true);
    try {
      await recordReading({
        meterId: currentMeter.meterId,
        readingValue: val,
        readingDate,
        note: note.trim() || undefined,
        isRolloverOrCorrection,
      });
      setSavedBanner(
        `Reading ${val.toLocaleString()} saved for ${currentMeter.meterName}. Consumed: ${calculateUnitsConsumed(
          currentMeter.openingReading,
          val
        ).toLocaleString()} units.`
      );
      setNote('');
      setIsRolloverOrCorrection(false);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not save reading.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctingReading) return;
    setErrorMessage(null);
    try {
      await correctReadingEntry({
        readingId: correctingReading.readingId,
        newReadingValue: Number(correctedValue),
        reason: correctionReason || 'User reading correction',
      });
      setCorrectingReading(null);
      setCorrectionReason('');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Correction failed.');
    }
  };

  if (!currentMeter) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
        <p className="text-sm text-slate-600">
          Please add an electricity meter first before entering readings.
        </p>
      </div>
    );
  }

  const circleRadius = 56;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const clampedPct = Math.min(100, Math.max(0, liveCalc?.pct || 0));
  const strokeDashoffset =
    circleCircumference - (clampedPct / 100) * circleCircumference;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Enter Meter Reading
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Update your meter reading and see automatic unit consumption calculations
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Entry Form Card */}
        <form
          onSubmit={handleSaveReading}
          className="lg:col-span-7 bg-white rounded-xl border border-slate-200/90 p-6 shadow-2xs space-y-5"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Select Meter *
            </label>
            <select
              value={currentMeter.meterId}
              onChange={(e) => setSelectedMeterId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm font-semibold text-slate-900 rounded-lg border border-slate-300 focus:border-[#1D63ED] outline-none bg-white cursor-pointer"
            >
              {activeMeters.map((m) => (
                <option key={m.meterId} value={m.meterId}>
                  {m.meterName} ({m.meterNumber})
                </option>
              ))}
            </select>
          </div>

          {/* 3 Stat Boxes: Opening, Previous, Monthly Limit */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-xs text-slate-500">Opening Reading</div>
              <div className="text-xl font-extrabold text-slate-900 tabular-nums mt-1">
                {currentMeter.openingReading.toLocaleString()}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-xs text-slate-500">Previous Reading</div>
              <div className="text-xl font-extrabold text-slate-900 tabular-nums mt-1">
                {currentMeter.previousReading.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {currentMeter.previousReadingDate}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-xs text-slate-500">Monthly Limit</div>
              <div className="text-xl font-extrabold text-slate-900 tabular-nums mt-1">
                {currentMeter.monthlyLimit.toLocaleString()}{' '}
                <span className="text-xs font-semibold text-slate-600">units</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Reading Date
            </label>
            <input
              type="date"
              value={readingDate}
              onChange={(e) => setReadingDate(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:border-[#1D63ED] outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Current Meter Reading *
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRolloverOrCorrection}
                  onChange={(e) => setIsRolloverOrCorrection(e.target.checked)}
                  className="rounded border-slate-300 text-[#1D63ED]"
                />
                <span>Reading Correction / Meter Rollover</span>
              </label>
            </div>
            <input
              type="number"
              step="any"
              value={readingInput}
              onChange={(e) => {
                setReadingInput(e.target.value);
                setErrorMessage(null);
              }}
              placeholder="Enter current reading (e.g. 12780)"
              required
              className="w-full px-3.5 py-2.5 text-base font-bold font-mono rounded-lg border border-slate-300 focus:border-[#1D63ED] outline-none tabular-nums text-slate-900"
            />
          </div>

          {isRolloverOrCorrection && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Audit Note / Correction Reason
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Explain why this reading is being adjusted..."
                className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-300 focus:border-[#1D63ED] outline-none"
              />
            </div>
          )}

          {/* Validation or Error Alert */}
          {(errorMessage || (liveCalc && !liveCalc.validation.isValid)) && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage || liveCalc?.validation.error}</span>
            </div>
          )}

          {savedBanner && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{savedBanner}</span>
            </div>
          )}

          {/* Live Calculation Box */}
          {liveCalc && (
            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80 space-y-3">
              <div className="text-xs font-bold text-slate-800">Live Calculation</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-slate-500">Units Consumed</div>
                  <div className="text-2xl font-extrabold text-emerald-700 tabular-nums">
                    {liveCalc.unitsConsumed.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Remaining Units</div>
                  <div className="text-2xl font-extrabold text-emerald-700 tabular-nums">
                    {liveCalc.remainingUnits.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Daily Average</div>
                  <div className="text-lg font-bold text-slate-800 tabular-nums mt-1">
                    {liveCalc.dailyStats.dailyAverage} u/day
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-600 font-medium">Limit Usage:</span>
                  <span className="font-bold text-slate-900 tabular-nums">
                    {liveCalc.pct}%
                  </span>
                </div>
                <div className="w-full h-2.5 bg-white rounded-full overflow-hidden border border-emerald-200">
                  <div
                    className={`h-full transition-all ${liveCalc.thresholdInfo.barClass}`}
                    style={{ width: `${Math.min(100, liveCalc.pct)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || (liveCalc ? !liveCalc.validation.isValid : false)}
            className="w-full py-3 px-4 rounded-lg bg-[#1D63ED] hover:bg-[#1652C8] disabled:opacity-50 text-white text-sm font-semibold shadow-sm transition-colors cursor-pointer"
          >
            {isSubmitting ? 'Saving Reading...' : 'Save Reading'}
          </button>
        </form>

        {/* Right Progress Ring & Recent Readings Card */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-2xs flex flex-col items-center text-center">
            <h3 className="text-base font-bold text-slate-900 mb-4">Meter Progress</h3>

            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 140 140">
                <circle
                  cx="70"
                  cy="70"
                  r={circleRadius}
                  stroke="#E2E8F0"
                  strokeWidth="12"
                  fill="none"
                />
                <circle
                  cx="70"
                  cy="70"
                  r={circleRadius}
                  stroke={liveCalc?.thresholdInfo.colorHex || '#16A34A'}
                  strokeWidth="12"
                  strokeDasharray={circleCircumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-extrabold text-slate-900 tabular-nums">
                  {liveCalc?.pct ?? 0}%
                </span>
              </div>
            </div>

            <div className="mt-3 text-sm font-bold text-slate-800 tabular-nums">
              {(liveCalc?.unitsConsumed ?? currentMeter.unitsConsumed).toLocaleString()} /{' '}
              {currentMeter.monthlyLimit.toLocaleString()} units
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {liveCalc?.dailyStats.estimatedDaysRemainingBeforeLimit !== null
                ? `Est. ${liveCalc?.dailyStats.estimatedDaysRemainingBeforeLimit} days before reaching limit`
                : 'Within monthly unit budget'}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-2xs">
            <h3 className="text-base font-bold text-slate-900 mb-3">Recent Readings</h3>

            <div className="space-y-2.5">
              {recentMeterReadings.map((r) => (
                <div
                  key={r.readingId}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200/60 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <span className="font-medium text-slate-600">{r.readingDate}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      {r.readingValue.toLocaleString()}
                    </span>
                    <span className="font-mono font-semibold text-emerald-600 tabular-nums">
                      (+{r.unitsSincePreviousReading.toLocaleString()})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setCorrectingReading(r);
                        setCorrectedValue(String(r.readingValue));
                      }}
                      title="Correct this reading with audit log"
                      className="text-slate-400 hover:text-[#1D63ED] cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Correct Reading Modal */}
      {correctingReading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-[#1D63ED]" />
                <h3 className="text-base font-bold text-slate-900">
                  Correct Reading ({correctingReading.readingDate})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCorrectingReading(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmCorrection} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Corrected Reading Value
                </label>
                <input
                  type="number"
                  value={correctedValue}
                  onChange={(e) => setCorrectedValue(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 outline-none tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Correction (Saved in Audit Trail) *
                </label>
                <input
                  type="text"
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  placeholder="e.g. Typo during manual entry"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCorrectingReading(null)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#1D63ED] text-white text-xs font-semibold cursor-pointer"
                >
                  Save Correction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
