import React, { useState, useMemo } from 'react';
import { Download, Edit3, ShieldCheck, X } from 'lucide-react';
import { useWattWise } from '../context/WattWiseContext';
import {
  calculateRemainingUnits,
  calculateUsagePercentage,
  analyzeConsumptionThreshold,
  formatMonthLabel,
} from '../utils/calculations';
import { downloadCsvFile } from '../utils/exportCsv';
import { MonthlyRecord } from '../types';

export const HistoryView: React.FC = () => {
  const {
    meters,
    months,
    auditLogs,
    userProfile,
    correctHistoricalMonthRecord,
  } = useWattWise();

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    months.forEach((mo) => set.add(mo.monthId));
    meters.forEach((m) => set.add(m.currentMonthId));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [months, meters]);

  const [selectedMonth, setSelectedMonth] = useState<string>(
    availableMonths[0] || '2026-10'
  );
  const [selectedMeterFilter, setSelectedMeterFilter] = useState<string>('all');
  const [editingRecord, setEditingRecord] = useState<MonthlyRecord | null>(null);
  const [editOpening, setEditOpening] = useState('');
  const [editClosing, setEditClosing] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const currency = userProfile?.currency || 'PKR';

  const spreadsheetRows = useMemo(() => {
    return months
      .filter((mo) => {
        if (selectedMonth !== 'all' && mo.monthId !== selectedMonth) return false;
        if (selectedMeterFilter !== 'all' && mo.meterId !== selectedMeterFilter)
          return false;
        return true;
      })
      .sort((a, b) => {
        const cmp = b.monthId.localeCompare(a.monthId);
        if (cmp !== 0) return cmp;
        return a.meterName.localeCompare(b.meterName);
      });
  }, [months, selectedMonth, selectedMeterFilter]);

  const totals = useMemo(() => {
    let totalUnits = 0;
    let totalRemaining = 0;
    let totalCost = 0;
    let totalLimit = 0;

    spreadsheetRows.forEach((r) => {
      const rem = calculateRemainingUnits(r.unitsConsumed, r.monthlyLimitSnapshot);
      totalUnits += r.unitsConsumed;
      totalRemaining += rem;
      totalCost += r.estimatedCost;
      totalLimit += r.monthlyLimitSnapshot;
    });

    return {
      totalUnits: Math.round(totalUnits),
      totalRemaining: Math.round(totalRemaining),
      totalCost: Math.round(totalCost),
      totalLimit: Math.round(totalLimit),
    };
  }, [spreadsheetRows]);

  const handleExportCsv = () => {
    const headers = [
      'Meter Serial No.',
      'Reference No.',
      'Month',
      'Opening Reading',
      'Closing Reading',
      'Units Consumed',
      'Monthly Limit',
      'Remaining Units',
      'Status',
      `Estimated Cost (${currency})`,
    ];

    const rows = spreadsheetRows.map((r) => {
      const rem = calculateRemainingUnits(r.unitsConsumed, r.monthlyLimitSnapshot);
      const pct = calculateUsagePercentage(r.unitsConsumed, r.monthlyLimitSnapshot);
      const status = analyzeConsumptionThreshold(pct).historyStatus;
      return [
        r.meterName,
        r.meterNumber,
        formatMonthLabel(r.monthId),
        r.openingReading,
        r.closingReading,
        r.unitsConsumed,
        r.monthlyLimitSnapshot,
        rem,
        status,
        r.estimatedCost,
      ];
    });

    downloadCsvFile(`wattwise-history-${selectedMonth}.csv`, headers, rows);
  };

  const handleSaveHistoricalCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    setEditError(null);
    try {
      await correctHistoricalMonthRecord({
        meterId: editingRecord.meterId,
        monthId: editingRecord.monthId,
        newOpeningReading: Number(editOpening),
        newClosingReading: Number(editClosing),
        reason: editReason,
      });
      setEditingRecord(null);
      setEditReason('');
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Could not update record.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">History</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          View past records and spreadsheet-style monthly consumption details
        </p>
      </div>

      {/* Filter Bar & Export CSV */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Month
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-800 rounded-lg border border-slate-300 bg-white outline-none cursor-pointer min-w-[160px]"
              >
                <option value="all">All Recorded Months</option>
                {availableMonths.map((mId) => (
                  <option key={mId} value={mId}>
                    {formatMonthLabel(mId)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Meter
              </label>
              <select
                value={selectedMeterFilter}
                onChange={(e) => setSelectedMeterFilter(e.target.value)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-800 rounded-lg border border-slate-300 bg-white outline-none cursor-pointer min-w-[160px]"
              >
                <option value="all">All Meters</option>
                {meters.map((m) => (
                  <option key={m.meterId} value={m.meterId}>
                    SN: {m.meterName} (Ref: {m.meterNumber})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            className="px-4 py-2.5 rounded-lg bg-[#1D63ED] hover:bg-[#1652C8] text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer self-start sm:self-end"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>

        {/* Spreadsheet Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-3 px-4 font-semibold">Meter Serial No.</th>
                <th className="py-3 px-4 font-semibold">Reference No.</th>
                {selectedMonth === 'all' && <th className="py-3 px-4 font-semibold">Month</th>}
                <th className="py-3 px-4 font-semibold text-right">Opening</th>
                <th className="py-3 px-4 font-semibold text-right">Closing</th>
                <th className="py-3 px-4 font-semibold text-right">Units</th>
                <th className="py-3 px-4 font-semibold text-right">Limit</th>
                <th className="py-3 px-4 font-semibold text-right">Remaining</th>
                <th className="py-3 px-4 font-semibold text-center">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Cost ({currency})</th>
                <th className="py-3 px-3 font-semibold text-center">Audit Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {spreadsheetRows.map((row) => {
                const rem = calculateRemainingUnits(
                  row.unitsConsumed,
                  row.monthlyLimitSnapshot
                );
                const pct = calculateUsagePercentage(
                  row.unitsConsumed,
                  row.monthlyLimitSnapshot
                );
                const threshold = analyzeConsumptionThreshold(pct);

                return (
                  <tr key={`${row.meterId}-${row.monthId}`} className="hover:bg-slate-50/80">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{row.meterName}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-500">{row.meterNumber}</td>
                    {selectedMonth === 'all' && (
                      <td className="py-3.5 px-4 text-slate-600">
                        {formatMonthLabel(row.monthId)}
                      </td>
                    )}
                    <td className="py-3.5 px-4 text-right font-mono text-slate-700 tabular-nums">
                      {row.openingReading.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-700 tabular-nums">
                      {row.closingReading.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                      {row.unitsConsumed.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-600 tabular-nums">
                      {row.monthlyLimitSnapshot.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600 tabular-nums">
                      {rem.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${threshold.bgClass} ${threshold.textClass}`}
                      >
                        {threshold.historyStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                      {row.estimatedCost.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRecord(row);
                          setEditOpening(String(row.openingReading));
                          setEditClosing(String(row.closingReading));
                          setEditError(null);
                        }}
                        title="Controlled historical edit with audit trail"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-[#1D63ED] hover:bg-blue-50 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {spreadsheetRows.length > 0 && (
              <tfoot className="bg-slate-50/90 border-t border-slate-200 font-bold text-slate-900">
                <tr>
                  <td
                    colSpan={selectedMonth === 'all' ? 5 : 4}
                    className="py-3.5 px-4 text-right"
                  >
                    Total
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                    {totals.totalUnits.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-slate-500 tabular-nums">
                    {totals.totalLimit.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-emerald-700 tabular-nums">
                    {totals.totalRemaining.toLocaleString()}
                  </td>
                  <td />
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                    {totals.totalCost.toLocaleString()}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Audit Trail Log */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#1D63ED]" />
          <h2 className="text-sm font-bold text-slate-900">
            Immutable Audit Trail (Reading Corrections & Month Rollovers)
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-y border-slate-200 text-slate-500">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Action</th>
                <th className="py-2.5 px-3 font-semibold">Month</th>
                <th className="py-2.5 px-3 font-semibold">Previous Value</th>
                <th className="py-2.5 px-3 font-semibold">New Value</th>
                <th className="py-2.5 px-3 font-semibold">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditLogs.map((log) => (
                <tr key={log.logId}>
                  <td className="py-2.5 px-3 font-mono font-semibold text-slate-800">
                    {log.action}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">{log.monthId}</td>
                  <td className="py-2.5 px-3 text-slate-500">{log.previousValue}</td>
                  <td className="py-2.5 px-3 font-medium text-slate-900">{log.newValue}</td>
                  <td className="py-2.5 px-3 text-slate-600">{log.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Controlled Edit Modal */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Controlled Audit Edit — {editingRecord.meterName} ({editingRecord.monthId})
              </h3>
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveHistoricalCorrection} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Opening Reading
                  </label>
                  <input
                    type="number"
                    value={editOpening}
                    onChange={(e) => setEditOpening(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Closing Reading
                  </label>
                  <input
                    type="number"
                    value={editClosing}
                    onChange={(e) => setEditClosing(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mandatory Audit Reason *
                </label>
                <input
                  type="text"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="Reason for adjusting finalized monthly record..."
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#1D63ED] text-white text-xs font-semibold cursor-pointer"
                >
                  Save & Log Audit Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
