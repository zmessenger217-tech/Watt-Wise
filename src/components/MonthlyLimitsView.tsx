import React, { useState } from 'react';
import { Bell, Save, Sliders, CheckCircle2 } from 'lucide-react';
import { useWattWise } from '../context/WattWiseContext';
import { MeterIconBadge } from './MeterIconBadge';
import {
  calculateUsagePercentage,
  analyzeConsumptionThreshold,
} from '../utils/calculations';

const THRESHOLD_SCHEDULE = [
  {
    range: 'Below 50%',
    level: 'Normal Usage',
    frequency: 'No repeated alerts; optional milestone update',
    color: 'bg-emerald-500',
  },
  {
    range: '50% – 69%',
    level: 'Milestone Update',
    frequency: 'Notify once when the 50% milestone is first reached',
    color: 'bg-blue-500',
  },
  {
    range: '70% – 79%',
    level: 'Usage Warning',
    frequency: 'Notify at 70% milestone + optional daily reminder (every 24h)',
    color: 'bg-amber-400',
  },
  {
    range: '80% – 89%',
    level: 'Strong Warning',
    frequency: 'Send immediate alert + daily usage reminder (every 24h)',
    color: 'bg-amber-500',
  },
  {
    range: '90% – 94%',
    level: 'High-Usage Alert',
    frequency: 'Send alert + recurring reminder every 12 hours',
    color: 'bg-orange-500',
  },
  {
    range: '95% – 99%',
    level: 'Critical Warning',
    frequency: 'Send critical alert + recurring reminder every 6 hours',
    color: 'bg-red-500',
  },
  {
    range: '100% & Above',
    level: 'Limit Reached / Exceeded',
    frequency: 'Immediate alert + reminders every 3 hours (respects quiet hours)',
    color: 'bg-red-700',
  },
];

export const MonthlyLimitsView: React.FC = () => {
  const { meters, updateMeter, triggerDeviceTestNotification } = useWattWise();

  const activeMeters = meters.filter((m) => !m.isArchived);
  const [draftLimits, setDraftLimits] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const handleSaveLimit = async (meterId: string, defaultLimit: number) => {
    const val = Number(draftLimits[meterId] ?? defaultLimit);
    if (Number.isNaN(val) || val < 1) return;
    setSavingId(meterId);
    try {
      await updateMeter(meterId, { monthlyLimit: val });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Monthly Unit Limits & Smart Thresholds
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure independent unit budgets for each meter and manage smart alert frequencies
          </p>
        </div>

        <button
          type="button"
          onClick={triggerDeviceTestNotification}
          className="px-4 py-2.5 rounded-lg bg-[#1D63ED] hover:bg-[#1652C8] text-white text-xs font-semibold flex items-center gap-2 shadow-xs cursor-pointer whitespace-nowrap self-start"
        >
          <Bell className="w-4 h-4" />
          <span>Test Device Notification Bar</span>
        </button>
      </div>

      {/* Per-Meter Limit Configuration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeMeters.map((meter) => {
          const currentLimitVal = Number(draftLimits[meter.meterId] ?? meter.monthlyLimit);
          const pct = calculateUsagePercentage(
            meter.unitsConsumed,
            currentLimitVal > 0 ? currentLimitVal : meter.monthlyLimit
          );
          const thresholdInfo = analyzeConsumptionThreshold(pct);

          return (
            <div
              key={meter.meterId}
              className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3">
                    <MeterIconBadge iconType={meter.iconType} size="md" />
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{meter.meterName}</h3>
                      <p className="text-xs font-mono text-slate-500">{meter.meterNumber}</p>
                    </div>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-md ${thresholdInfo.bgClass} ${thresholdInfo.textClass}`}
                  >
                    {thresholdInfo.statusLabel} ({pct}%)
                  </span>
                </div>

                {/* Progress Bar with 50/70/80/90/100 markers */}
                <div className="space-y-1.5 mt-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">
                      Consumed: <strong className="tabular-nums">{meter.unitsConsumed}</strong> units
                    </span>
                    <span className="font-bold text-slate-900 tabular-nums">
                      Limit: {currentLimitVal || meter.monthlyLimit} units
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${thresholdInfo.barClass}`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 pt-1">{thresholdInfo.description}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-2.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Monthly Unit Limit
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={1000000}
                    value={draftLimits[meter.meterId] ?? meter.monthlyLimit}
                    onChange={(e) =>
                      setDraftLimits((prev) => ({
                        ...prev,
                        [meter.meterId]: e.target.value,
                      }))
                    }
                    className="flex-1 px-3 py-2 text-sm font-bold rounded-lg border border-slate-300 focus:border-[#1D63ED] outline-none tabular-nums"
                  />
                  <button
                    type="button"
                    disabled={savingId === meter.meterId}
                    onClick={() => handleSaveLimit(meter.meterId, meter.monthlyLimit)}
                    className="px-3.5 py-2 rounded-lg bg-[#1D63ED] hover:bg-[#1652C8] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{savingId === meter.meterId ? 'Saving...' : 'Save'}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Smart Notification Frequency Schedule Reference */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-2xs">
        <div className="flex items-center gap-2.5 mb-4">
          <Sliders className="w-5 h-5 text-[#1D63ED]" />
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Smart Notification Escalation Schedule
            </h2>
            <p className="text-xs text-slate-500">
              Alerts automatically increase in urgency as each meter approaches its configured monthly limit
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-y border-slate-200 text-slate-600">
              <tr>
                <th className="py-3 px-4 font-semibold">Consumption Threshold</th>
                <th className="py-3 px-4 font-semibold">Severity Level</th>
                <th className="py-3 px-4 font-semibold">Smart Notification & Reminder Cadence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {THRESHOLD_SCHEDULE.map((row) => (
                <tr key={row.range} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900 tabular-nums">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${row.color}`} />
                      <span>{row.range}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-800">{row.level}</td>
                  <td className="py-3 px-4 text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{row.frequency}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
