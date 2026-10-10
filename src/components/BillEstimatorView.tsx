import React, { useState, useEffect, useMemo } from 'react';
import { Save } from 'lucide-react';
import { useWattWise } from '../context/WattWiseContext';
import { calculateEstimatedBill } from '../utils/calculations';

export const BillEstimatorView: React.FC = () => {
  const {
    meters,
    selectedMeterId,
    setSelectedMeterId,
    updateMeter,
    userProfile,
  } = useWattWise();

  const activeMeters = useMemo(() => meters.filter((m) => !m.isArchived), [meters]);
  const currentMeter = useMemo(() => {
    return (
      activeMeters.find((m) => m.meterId === selectedMeterId) ||
      activeMeters[0] ||
      null
    );
  }, [activeMeters, selectedMeterId]);

  const [ratePerUnit, setRatePerUnit] = useState('35');
  const [fixedCharges, setFixedCharges] = useState('100');
  const [additionalCharges, setAdditionalCharges] = useState('0');
  const [taxPercentage, setTaxPercentage] = useState('0');
  const [customUnits, setCustomUnits] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const currency = userProfile?.currency || 'PKR';

  useEffect(() => {
    if (currentMeter) {
      setRatePerUnit(String(currentMeter.estimatedRate));
      setFixedCharges(String(currentMeter.fixedCharges));
      setAdditionalCharges(String(currentMeter.additionalCharges));
      setTaxPercentage(String(currentMeter.taxPercentage));
      setCustomUnits(String(currentMeter.unitsConsumed));
    }
  }, [currentMeter]);

  const breakdown = useMemo(() => {
    const units =
      customUnits !== '' && !Number.isNaN(Number(customUnits))
        ? Number(customUnits)
        : currentMeter?.unitsConsumed || 0;

    return calculateEstimatedBill(
      units,
      Number(ratePerUnit) || 0,
      Number(fixedCharges) || 0,
      Number(additionalCharges) || 0,
      Number(taxPercentage) || 0
    );
  }, [customUnits, currentMeter, ratePerUnit, fixedCharges, additionalCharges, taxPercentage]);

  const handleSaveRatesToMeter = async () => {
    if (!currentMeter) return;
    setIsSaving(true);
    try {
      await updateMeter(currentMeter.meterId, {
        estimatedRate: Number(ratePerUnit) || 0,
        fixedCharges: Number(fixedCharges) || 0,
        additionalCharges: Number(additionalCharges) || 0,
        taxPercentage: Number(taxPercentage) || 0,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!currentMeter) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-600">
        Please add an electricity meter to estimate bills.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Bill Estimator</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Calculate your estimated electricity bill per meter
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/90 p-6 md:p-8 shadow-2xs space-y-5">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Select Meter
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Rate per unit ({currency})
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={ratePerUnit}
              onChange={(e) => setRatePerUnit(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm font-bold rounded-lg border border-slate-300 focus:border-[#1D63ED] outline-none tabular-nums"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Fixed charges ({currency})
            </label>
            <input
              type="number"
              min={0}
              value={fixedCharges}
              onChange={(e) => setFixedCharges(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm font-bold rounded-lg border border-slate-300 focus:border-[#1D63ED] outline-none tabular-nums"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Additional charges ({currency})
            </label>
            <input
              type="number"
              min={0}
              value={additionalCharges}
              onChange={(e) => setAdditionalCharges(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm font-bold rounded-lg border border-slate-300 focus:border-[#1D63ED] outline-none tabular-nums"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Optional Tax (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={taxPercentage}
              onChange={(e) => setTaxPercentage(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm font-bold rounded-lg border border-slate-300 focus:border-[#1D63ED] outline-none tabular-nums"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Units Consumed (Sim)
            </label>
            <input
              type="number"
              min={0}
              value={customUnits}
              onChange={(e) => setCustomUnits(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm font-bold rounded-lg border border-slate-300 focus:border-[#1D63ED] outline-none tabular-nums"
            />
          </div>
        </div>

        {/* Estimated Bill Card */}
        <div className="rounded-xl bg-blue-50/70 border border-blue-200/80 p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900">Estimated bill</h3>

          <div className="space-y-2 text-xs text-slate-700">
            <div className="flex items-center justify-between">
              <span>Units consumed</span>
              <span className="font-bold text-slate-900 tabular-nums">
                {breakdown.unitsConsumed.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Energy charges</span>
              <span className="font-bold text-slate-900 tabular-nums">
                {breakdown.energyCharges.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Fixed charges</span>
              <span className="font-bold text-slate-900 tabular-nums">
                {breakdown.fixedCharges.toLocaleString()}
              </span>
            </div>
            {breakdown.additionalCharges > 0 && (
              <div className="flex items-center justify-between">
                <span>Additional charges</span>
                <span className="font-bold text-slate-900 tabular-nums">
                  {breakdown.additionalCharges.toLocaleString()}
                </span>
              </div>
            )}
            {breakdown.taxAmount > 0 && (
              <div className="flex items-center justify-between">
                <span>Estimated taxes</span>
                <span className="font-bold text-slate-900 tabular-nums">
                  {breakdown.taxAmount.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-blue-200/70 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-900">Total estimated bill</span>
            <span className="text-2xl font-extrabold text-[#1D63ED] tabular-nums">
              {currency} {breakdown.totalEstimatedBill.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <p className="text-xs text-slate-500">
            Note: This is an estimate. Actual bill may vary because of tiered tariffs, fuel adjustments, and provider-specific rules.
          </p>

          <button
            type="button"
            disabled={isSaving}
            onClick={handleSaveRatesToMeter}
            className="px-4 py-2 rounded-lg bg-[#1D63ED] hover:bg-[#1652C8] text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer self-start"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save Rates to Meter'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
