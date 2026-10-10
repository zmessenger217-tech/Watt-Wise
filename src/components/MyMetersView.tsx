import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  MapPin,
  MoreVertical,
  Edit3,
  Archive,
  Trash2,
  X,
  Zap,
  Calendar,
  Activity,
} from 'lucide-react';
import { useWattWise } from '../context/WattWiseContext';
import { ElectricityMeter } from '../types';
import { MeterIconBadge } from './MeterIconBadge';
import {
  calculateUsagePercentage,
  calculateRemainingUnits,
  calculateEstimatedBill,
  analyzeConsumptionThreshold,
  calculateDailyStats,
} from '../utils/calculations';

export const MyMetersView: React.FC = () => {
  const {
    meters,
    readings,
    userProfile,
    setActivePage,
    setSelectedMeterId,
    setEditingMeter,
    updateMeter,
    deleteMeter,
  } = useWattWise();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'warning' | 'archived'>('all');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [detailMeter, setDetailMeter] = useState<ElectricityMeter | null>(null);

  const currency = userProfile?.currency || 'PKR';

  const filteredMeters = useMemo(() => {
    return meters.filter((m) => {
      const matchesSearch =
        m.meterName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.meterNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.consumerId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.referenceNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.ownerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.provider.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      const pct = calculateUsagePercentage(m.unitsConsumed, m.monthlyLimit);

      if (statusFilter === 'archived') return m.isArchived;
      if (m.isArchived) return false;

      if (statusFilter === 'warning') return pct >= 70;
      if (statusFilter === 'active') return m.isActive && pct < 70;
      return true;
    });
  }, [meters, searchQuery, statusFilter]);

  const handleAddReadingClick = (meterId: string) => {
    setSelectedMeterId(meterId);
    setActivePage('enter-reading');
  };

  const handleEditClick = (meter: ElectricityMeter) => {
    setOpenMenuId(null);
    setEditingMeter(meter);
    setActivePage('add-meter');
  };

  const handleArchiveToggle = async (meter: ElectricityMeter) => {
    setOpenMenuId(null);
    await updateMeter(meter.meterId, {
      isArchived: !meter.isArchived,
      isActive: meter.isArchived,
    });
  };

  const handleDeleteClick = async (meter: ElectricityMeter) => {
    setOpenMenuId(null);
    await deleteMeter(meter.meterId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Meters</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Manage all your electricity meters independently
        </p>
      </div>

      {/* Search, Filter & Add Meter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search meters by serial no., reference no., location..."
            className="w-full pl-10 pr-4 py-2.5 text-xs bg-white rounded-lg border border-slate-200 focus:border-[#1D63ED] outline-none shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            aria-label="Filter meters by status"
            className="px-3.5 py-2.5 text-xs font-semibold text-slate-700 bg-white rounded-lg border border-slate-200 outline-none cursor-pointer shadow-2xs"
          >
            <option value="all">All Active Meters</option>
            <option value="active">Normal Usage (&lt;70%)</option>
            <option value="warning">Warning / Near Limit (70%+)</option>
            <option value="archived">Archived Meters</option>
          </select>

          <button
            type="button"
            onClick={() => {
              setEditingMeter(null);
              setActivePage('add-meter');
            }}
            className="px-4 py-2.5 rounded-lg bg-[#1D63ED] hover:bg-[#1652C8] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Meter</span>
          </button>
        </div>
      </div>

      {/* Meters List */}
      {filteredMeters.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
          <p className="text-sm text-slate-500">
            No electricity meters match your current search or filter.
          </p>
          <button
            type="button"
            onClick={() => {
              setEditingMeter(null);
              setActivePage('add-meter');
            }}
            className="px-4 py-2 rounded-lg bg-[#1D63ED] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Meter</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredMeters.map((meter) => {
            const pct = calculateUsagePercentage(meter.unitsConsumed, meter.monthlyLimit);
            const remaining = calculateRemainingUnits(meter.unitsConsumed, meter.monthlyLimit);
            const thresholdInfo = analyzeConsumptionThreshold(pct);

            return (
              <div
                key={meter.meterId}
                className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-6 hover:border-slate-300 transition-all"
              >
                {/* Left Meter Identity */}
                <div className="flex items-start gap-4 min-w-0 lg:w-5/12">
                  <MeterIconBadge iconType={meter.iconType} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-base font-bold text-slate-900 font-mono">
                        Serial: {meter.meterName}
                      </h3>
                      <span
                        className={`text-xs font-semibold px-2.5 py-0.5 rounded-md ${thresholdInfo.bgClass} ${thresholdInfo.textClass}`}
                      >
                        {meter.isArchived ? 'Archived' : thresholdInfo.statusLabel}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span>Meter No: {meter.meterNumber}</span>
                      <span>·</span>
                      <span>Consumer ID: {meter.consumerId || 'N/A'}</span>
                      {meter.referenceNumber && meter.referenceNumber !== 'N/A' && (
                        <>
                          <span>·</span>
                          <span>Ref: {meter.referenceNumber}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>Owner: {meter.ownerName || 'User'}</span>
                      <span>·</span>
                      <span>{meter.provider}</span>
                    </div>
                    {meter.location && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{meter.location}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Consumption & Actions */}
                <div className="flex-1 max-w-xl space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 tabular-nums">
                      {meter.unitsConsumed.toLocaleString()} / {meter.monthlyLimit.toLocaleString()}{' '}
                      units
                    </span>
                    <span className="font-bold text-slate-900 tabular-nums">{pct}%</span>
                  </div>

                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${thresholdInfo.barClass}`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span>Last reading: {meter.lastReadingDate}</span>
                    <span className="tabular-nums">
                      Opening: <strong>{meter.openingReading.toLocaleString()}</strong> · Current:{' '}
                      <strong>{meter.currentReading.toLocaleString()}</strong> · Remaining:{' '}
                      <strong className="text-emerald-700">{remaining.toLocaleString()}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleAddReadingClick(meter.meterId)}
                      className="px-4 py-2 rounded-lg bg-[#1D63ED] hover:bg-[#1652C8] text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Add Reading
                    </button>

                    <button
                      type="button"
                      onClick={() => setDetailMeter(meter)}
                      className="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Details
                    </button>

                    <div className="relative ml-auto">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenMenuId(openMenuId === meter.meterId ? null : meter.meterId)
                        }
                        aria-label="More meter actions"
                        className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 cursor-pointer"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {openMenuId === meter.meterId && (
                        <div className="absolute right-0 bottom-full mb-1.5 w-44 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-20">
                          <button
                            type="button"
                            onClick={() => handleEditClick(meter)}
                            className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                            <span>Edit Meter</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleArchiveToggle(meter)}
                            className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                          >
                            <Archive className="w-3.5 h-3.5 text-slate-400" />
                            <span>{meter.isArchived ? 'Restore Meter' : 'Archive Meter'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteClick(meter)}
                            className="w-full px-3.5 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete Meter</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Meter Details Modal */}
      {detailMeter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MeterIconBadge iconType={detailMeter.iconType} size="md" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Serial: {detailMeter.meterName} (Meter No: {detailMeter.meterNumber})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Consumer ID: {detailMeter.consumerId || 'N/A'}
                    {detailMeter.referenceNumber && detailMeter.referenceNumber !== 'N/A'
                      ? ` · Ref: ${detailMeter.referenceNumber}`
                      : ''}{' '}
                    · Owner: {detailMeter.ownerName || 'User'} · {detailMeter.provider} ·{' '}
                    {detailMeter.location || 'Primary Location'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailMeter(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {(() => {
                const pct = calculateUsagePercentage(
                  detailMeter.unitsConsumed,
                  detailMeter.monthlyLimit
                );
                const remaining = calculateRemainingUnits(
                  detailMeter.unitsConsumed,
                  detailMeter.monthlyLimit
                );
                const bill = calculateEstimatedBill(
                  detailMeter.unitsConsumed,
                  detailMeter.estimatedRate,
                  detailMeter.fixedCharges,
                  detailMeter.additionalCharges,
                  detailMeter.taxPercentage
                );
                const daily = calculateDailyStats(
                  detailMeter.unitsConsumed,
                  detailMeter.monthlyLimit,
                  detailMeter.currentMonthId,
                  detailMeter.lastReadingDate
                );
                const meterReadings = readings
                  .filter(
                    (r) =>
                      r.meterId === detailMeter.meterId &&
                      r.monthId === detailMeter.currentMonthId
                  )
                  .sort((a, b) => b.readingDate.localeCompare(a.readingDate));

                return (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                        <div className="text-[11px] text-slate-500">Opening Reading</div>
                        <div className="text-base font-bold text-slate-900 tabular-nums mt-0.5">
                          {detailMeter.openingReading.toLocaleString()}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                        <div className="text-[11px] text-slate-500">Current Reading</div>
                        <div className="text-base font-bold text-slate-900 tabular-nums mt-0.5">
                          {detailMeter.currentReading.toLocaleString()}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/80">
                        <div className="text-[11px] text-blue-700">Consumed / Limit</div>
                        <div className="text-base font-bold text-blue-900 tabular-nums mt-0.5">
                          {detailMeter.unitsConsumed} / {detailMeter.monthlyLimit} ({pct}%)
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
                        <div className="text-[11px] text-emerald-700">Remaining Units</div>
                        <div className="text-base font-bold text-emerald-900 tabular-nums mt-0.5">
                          {remaining.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 rounded-xl border border-slate-200 flex items-center gap-2.5">
                        <Activity className="w-4 h-4 text-[#1D63ED] shrink-0" />
                        <div>
                          <div className="text-slate-500">Daily Average</div>
                          <div className="font-bold text-slate-900 tabular-nums">
                            {daily.dailyAverage} units / day
                          </div>
                        </div>
                      </div>
                      <div className="p-3 rounded-xl border border-slate-200 flex items-center gap-2.5">
                        <Calendar className="w-4 h-4 text-amber-500 shrink-0" />
                        <div>
                          <div className="text-slate-500">Est. Days Until Limit</div>
                          <div className="font-bold text-slate-900 tabular-nums">
                            {daily.estimatedDaysRemainingBeforeLimit !== null
                              ? `${daily.estimatedDaysRemainingBeforeLimit} days`
                              : 'N/A'}
                          </div>
                        </div>
                      </div>
                      <div className="p-3 rounded-xl border border-slate-200 flex items-center gap-2.5">
                        <Zap className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                          <div className="text-slate-500">Estimated Bill</div>
                          <div className="font-bold text-slate-900 tabular-nums">
                            {currency} {bill.totalEstimatedBill.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-slate-700 mb-2">
                        Recorded Readings ({detailMeter.currentMonthId})
                      </h4>
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                            <tr>
                              <th className="py-2.5 px-3 font-semibold">Date</th>
                              <th className="py-2.5 px-3 font-semibold text-right">Reading</th>
                              <th className="py-2.5 px-3 font-semibold text-right">Delta</th>
                              <th className="py-2.5 px-3 font-semibold text-right">Month Total</th>
                              <th className="py-2.5 px-3 font-semibold">Note</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {meterReadings.map((r) => (
                              <tr key={r.readingId}>
                                <td className="py-2.5 px-3 font-medium text-slate-700">
                                  {r.readingDate}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                                  {r.readingValue.toLocaleString()}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-emerald-600 tabular-nums">
                                  +{r.unitsSincePreviousReading.toLocaleString()}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                                  {r.totalMonthUnits.toLocaleString()}
                                </td>
                                <td className="py-2.5 px-3 text-slate-500">{r.note}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  const m = detailMeter;
                  setDetailMeter(null);
                  handleEditClick(m);
                }}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Edit Meter
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = detailMeter.meterId;
                  setDetailMeter(null);
                  handleAddReadingClick(id);
                }}
                className="px-4 py-2 rounded-lg bg-[#1D63ED] text-white text-xs font-semibold hover:bg-[#1652C8] cursor-pointer"
              >
                Enter New Reading
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
