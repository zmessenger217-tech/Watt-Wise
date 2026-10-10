import React, { useState, useMemo } from 'react';
import {
  Check,
  Info,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { useWattWise } from '../context/WattWiseContext';
import { MeterIconBadge } from './MeterIconBadge';
import { getNextMonthId, formatMonthLabel } from '../utils/calculations';

export const StartNewMonthView: React.FC = () => {
  const { meters, startNewMonth, setActivePage } = useWattWise();

  const activeMeters = useMemo(
    () => meters.filter((m) => m.isActive && !m.isArchived),
    [meters]
  );

  const defaultNextMonth = useMemo(() => {
    const base = activeMeters[0]?.currentMonthId || '2026-10';
    return getNextMonthId(base);
  }, [activeMeters]);

  const monthOptions = useMemo(() => {
    const m1 = defaultNextMonth;
    const m2 = getNextMonthId(m1);
    const m3 = getNextMonthId(m2);
    return [m1, m2, m3];
  }, [defaultNextMonth]);

  const [targetMonthId, setTargetMonthId] = useState(defaultNextMonth);
  const [selectionMode, setSelectionMode] = useState<'all' | 'selected'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>(
    activeMeters.map((m) => m.meterId)
  );
  const [closingOverrides, setClosingOverrides] = useState<Record<string, string>>({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const metersToRollover = useMemo(() => {
    if (selectionMode === 'all') return activeMeters;
    return activeMeters.filter((m) => selectedIds.includes(m.meterId));
  }, [selectionMode, activeMeters, selectedIds]);

  const toggleMeterCheckbox = (meterId: string) => {
    setSelectedIds((prev) =>
      prev.includes(meterId) ? prev.filter((id) => id !== meterId) : [...prev, meterId]
    );
  };

  const handleConfirmStartMonth = async () => {
    setErrorMessage(null);
    setIsProcessing(true);
    try {
      const numericOverrides: Record<string, number> = {};
      Object.entries(closingOverrides).forEach(([mId, val]) => {
        if (val.trim() !== '' && !Number.isNaN(Number(val))) {
          numericOverrides[mId] = Number(val);
        }
      });

      await startNewMonth({
        targetMonthId,
        meterIds: metersToRollover.map((m) => m.meterId),
        closingOverrides: numericOverrides,
      });
      setShowConfirmModal(false);
      setActivePage('dashboard');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to start new month.');
      setShowConfirmModal(false);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Start New Month</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Create a new monthly record for your meters and carry forward closing readings
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/90 p-6 md:p-8 shadow-2xs space-y-6">
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* New Month Picker */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            New Month
          </label>
          <select
            value={targetMonthId}
            onChange={(e) => setTargetMonthId(e.target.value)}
            className="w-full sm:w-72 px-3.5 py-2.5 text-sm font-semibold text-slate-900 rounded-lg border border-slate-300 focus:border-[#1D63ED] outline-none bg-white cursor-pointer"
          >
            {monthOptions.map((mId) => (
              <option key={mId} value={mId}>
                {formatMonthLabel(mId)}
              </option>
            ))}
          </select>
        </div>

        {/* Which meters? */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-slate-700">Which meters?</div>
          <div className="space-y-2">
            <label className="flex items-center gap-2.5 text-xs font-medium text-slate-800 cursor-pointer">
              <input
                type="radio"
                name="meterScope"
                checked={selectionMode === 'all'}
                onChange={() => setSelectionMode('all')}
                className="w-4 h-4 text-[#1D63ED] focus:ring-[#1D63ED]"
              />
              <span>All active meters ({activeMeters.length})</span>
            </label>
            <label className="flex items-center gap-2.5 text-xs font-medium text-slate-800 cursor-pointer">
              <input
                type="radio"
                name="meterScope"
                checked={selectionMode === 'selected'}
                onChange={() => setSelectionMode('selected')}
                className="w-4 h-4 text-[#1D63ED] focus:ring-[#1D63ED]"
              />
              <span>Only selected meters</span>
            </label>
          </div>

          {selectionMode === 'selected' && (
            <div className="pl-6 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {activeMeters.map((m) => (
                <label
                  key={m.meterId}
                  className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 bg-slate-50/60 text-xs cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(m.meterId)}
                    onChange={() => toggleMeterCheckbox(m.meterId)}
                    className="rounded border-slate-300 text-[#1D63ED]"
                  />
                  <span className="font-semibold text-slate-800">
                    {m.meterName} ({m.meterNumber})
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Preview Box */}
        <div className="rounded-xl bg-blue-50/50 border border-blue-200/80 p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Preview</h3>
            <p className="text-xs text-slate-500">
              {metersToRollover.length}{' '}
              {metersToRollover.length === 1 ? 'meter' : 'meters'} will be updated for{' '}
              {formatMonthLabel(targetMonthId)}
            </p>
          </div>

          <div className="divide-y divide-blue-100">
            {metersToRollover.map((meter) => {
              const effectiveClosing =
                closingOverrides[meter.meterId] !== undefined &&
                closingOverrides[meter.meterId] !== ''
                  ? Number(closingOverrides[meter.meterId])
                  : meter.currentReading;

              return (
                <div
                  key={meter.meterId}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <MeterIconBadge iconType={meter.iconType} size="sm" />
                    <div>
                      <span className="text-xs font-bold text-slate-900">{meter.meterName}</span>
                      <span className="text-[11px] text-slate-500 ml-2 font-mono">
                        ({meter.meterNumber})
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
                    <input
                      type="number"
                      min={meter.openingReading}
                      value={closingOverrides[meter.meterId] ?? meter.currentReading}
                      onChange={(e) =>
                        setClosingOverrides((prev) => ({
                          ...prev,
                          [meter.meterId]: e.target.value,
                        }))
                      }
                      title="Confirm or update final closing reading before starting new month"
                      className="w-24 px-2 py-1 text-right rounded border border-slate-300 bg-white text-slate-900 font-bold"
                    />
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-bold text-slate-900">
                      {effectiveClosing.toLocaleString()}{' '}
                      <span className="font-sans font-normal text-slate-500">(opening)</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* What happens? Info Box */}
        <div className="rounded-xl bg-amber-50/60 border border-amber-200/80 p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
            <Info className="w-4 h-4 text-amber-500 shrink-0" />
            <span>What happens?</span>
          </div>

          <ul className="space-y-2 text-xs text-slate-700 pl-1">
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Previous month&apos;s data will be saved and finalized in History</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Current reading becomes new opening reading</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Monthly consumption will be reset to zero</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Limits, notification schedules, and settings will be carried forward</span>
            </li>
          </ul>
        </div>

        <button
          type="button"
          disabled={metersToRollover.length === 0 || isProcessing}
          onClick={() => setShowConfirmModal(true)}
          className="w-full py-3 px-4 rounded-lg bg-[#1D63ED] hover:bg-[#1652C8] disabled:opacity-50 text-white text-sm font-semibold shadow-sm transition-colors cursor-pointer"
        >
          Review & Start
        </button>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-[#1D63ED]" />
                <h3 className="text-base font-bold text-slate-900">
                  Confirm Start New Month
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              You are about to finalize the current billing cycle and initialize{' '}
              <strong>{formatMonthLabel(targetMonthId)}</strong> for{' '}
              <strong>
                {metersToRollover.map((m) => m.meterName).join(', ')}
              </strong>
              . Previous monthly records will remain permanently preserved in History.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleConfirmStartMonth}
                className="px-5 py-2 rounded-lg bg-[#1D63ED] hover:bg-[#1652C8] text-white text-xs font-semibold cursor-pointer"
              >
                {isProcessing ? 'Starting...' : `Start ${formatMonthLabel(targetMonthId)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
