import React, { useState } from 'react';
import {
  FileText,
  FileSpreadsheet,
  Download,
  Copy,
  Check,
  Info,
} from 'lucide-react';
import { useWattWise } from '../context/WattWiseContext';
import {
  calculateRemainingUnits,
  calculateUsagePercentage,
  calculateEstimatedBill,
  analyzeConsumptionThreshold,
  formatMonthLabel,
} from '../utils/calculations';
import { downloadCsvFile, copyCsvToClipboard } from '../utils/exportCsv';

export const ReportsExportView: React.FC = () => {
  const { meters, months, userProfile, addToast } = useWattWise();
  const [copiedCurrent, setCopiedCurrent] = useState(false);
  const [copiedHistory, setCopiedHistory] = useState(false);

  const currency = userProfile?.currency || 'PKR';
  const activeMeters = meters.filter((m) => !m.isArchived);

  const getCurrentReportData = () => {
    const headers = [
      'Meter Serial Number',
      'Meter Reference Number',
      'Location',
      'Provider',
      'Month',
      'Opening Reading',
      'Current Reading',
      'Units Consumed',
      'Monthly Limit',
      'Remaining Units',
      'Usage %',
      'Status',
      `Estimated Cost (${currency})`,
    ];

    const rows = activeMeters.map((m) => {
      const rem = calculateRemainingUnits(m.unitsConsumed, m.monthlyLimit);
      const pct = calculateUsagePercentage(m.unitsConsumed, m.monthlyLimit);
      const bill = calculateEstimatedBill(
        m.unitsConsumed,
        m.estimatedRate,
        m.fixedCharges,
        m.additionalCharges,
        m.taxPercentage
      );
      const status = analyzeConsumptionThreshold(pct).statusLabel;
      return [
        m.meterName,
        m.meterNumber,
        m.location,
        m.provider,
        formatMonthLabel(m.currentMonthId),
        m.openingReading,
        m.currentReading,
        m.unitsConsumed,
        m.monthlyLimit,
        rem,
        `${pct}%`,
        status,
        bill.totalEstimatedBill,
      ];
    });

    return { headers, rows };
  };

  const getHistoryReportData = () => {
    const headers = [
      'Meter Serial Number',
      'Meter Reference Number',
      'Month',
      'Opening Reading',
      'Closing Reading',
      'Units Consumed',
      'Monthly Limit',
      'Remaining Units',
      'Limit Status',
      `Estimated Cost (${currency})`,
      'Record Status',
    ];

    const sorted = [...months].sort((a, b) => b.monthId.localeCompare(a.monthId));
    const rows = sorted.map((r) => {
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
        r.status,
      ];
    });

    return { headers, rows };
  };

  const handleDownloadCurrentCsv = () => {
    const { headers, rows } = getCurrentReportData();
    downloadCsvFile('wattwise-current-meters-report.csv', headers, rows);
    addToast('Report Downloaded', 'Current meter report exported to CSV.', 'success');
  };

  const handleCopyCurrentCsv = async () => {
    const { headers, rows } = getCurrentReportData();
    const ok = await copyCsvToClipboard(headers, rows);
    if (ok) {
      setCopiedCurrent(true);
      addToast('Copied to Clipboard', 'Current meter report copied in Excel-ready format.', 'success');
      setTimeout(() => setCopiedCurrent(false), 2500);
    }
  };

  const handleDownloadHistoryCsv = () => {
    const { headers, rows } = getHistoryReportData();
    downloadCsvFile('wattwise-monthly-history-report.csv', headers, rows);
    addToast('History Report Downloaded', 'Full monthly history exported to CSV.', 'success');
  };

  const handleCopyHistoryCsv = async () => {
    const { headers, rows } = getHistoryReportData();
    const ok = await copyCsvToClipboard(headers, rows);
    if (ok) {
      setCopiedHistory(true);
      addToast('Copied to Clipboard', 'Monthly history report copied in Excel-ready format.', 'success');
      setTimeout(() => setCopiedHistory(false), 2500);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Reports & Export
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Download or copy your meter data and monthly electricity reports
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/90 p-6 md:p-8 shadow-2xs space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Current Meter Report */}
          <div className="rounded-xl border border-slate-200 p-6 flex flex-col justify-between space-y-5 bg-slate-50/40">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 text-[#1D63ED] flex items-center justify-center shrink-0">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Current Meter Report
                </h2>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Includes all active meters with current readings, units consumed, monthly limits, and estimated costs ({activeMeters.length} meters).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleCopyCurrentCsv}
                className="py-2.5 px-4 rounded-lg bg-[#1D63ED] hover:bg-[#1652C8] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {copiedCurrent ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Copied CSV</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy CSV</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDownloadCurrentCsv}
                className="py-2.5 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download .CSV</span>
              </button>
            </div>
          </div>

          {/* Card 2: Monthly History Report */}
          <div className="rounded-xl border border-slate-200 p-6 flex flex-col justify-between space-y-5 bg-slate-50/40">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Monthly History Report
                </h2>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  View and export past monthly records across all meters with opening/closing readings and costs ({months.length} records).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleCopyHistoryCsv}
                className="py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {copiedHistory ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Copied CSV</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy CSV</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDownloadHistoryCsv}
                className="py-2.5 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download .CSV</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 pt-2">
          <Info className="w-4 h-4 text-slate-400 shrink-0" />
          <span>
            File format: CSV with UTF-8 BOM (directly compatible with Microsoft Excel, Google Sheets, and Apple Numbers).
          </span>
        </div>
      </div>
    </div>
  );
};
