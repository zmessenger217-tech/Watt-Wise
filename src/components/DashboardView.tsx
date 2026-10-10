import React, { useState, useMemo } from 'react';
import {
  FileText,
  Zap,
  BarChart3,
  AlertTriangle,
  CircleDollarSign,
  ArrowRight,
  Plus,
  MoreVertical,
  Calendar,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useWattWise } from '../context/WattWiseContext';
import { MeterIconBadge } from './MeterIconBadge';
import {
  calculateUsagePercentage,
  calculateRemainingUnits,
  calculateEstimatedBill,
  analyzeConsumptionThreshold,
  formatMonthLabel,
} from '../utils/calculations';

const PIE_COLORS = ['#1D63ED', '#0EA5E9', '#16A34A', '#F59E0B', '#8B5CF6'];

export const DashboardView: React.FC = () => {
  const {
    userProfile,
    meters,
    months,
    readings,
    setActivePage,
    setSelectedMeterId,
    setEditingMeter,
  } = useWattWise();

  const activeMeters = useMemo(
    () => meters.filter((m) => m.isActive && !m.isArchived),
    [meters]
  );

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    meters.forEach((m) => set.add(m.currentMonthId));
    months.forEach((mo) => set.add(mo.monthId));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [meters, months]);

  const [selectedMonth, setSelectedMonth] = useState<string>(
    availableMonths[0] || '2026-10'
  );
  const [chartTab, setChartTab] = useState<'daily' | 'monthly' | 'limit'>('daily');

  const currency = userProfile?.currency || 'PKR';

  // Aggregate summary stats across active meters
  const summaryStats = useMemo(() => {
    let totalUnits = 0;
    let totalRemaining = 0;
    let nearLimitCount = 0;
    let totalCost = 0;

    activeMeters.forEach((meter) => {
      const monthRec = months.find(
        (mo) => mo.meterId === meter.meterId && mo.monthId === selectedMonth
      );
      const consumed =
        selectedMonth === meter.currentMonthId
          ? meter.unitsConsumed
          : monthRec?.unitsConsumed ?? 0;
      const limit =
        selectedMonth === meter.currentMonthId
          ? meter.monthlyLimit
          : monthRec?.monthlyLimitSnapshot ?? meter.monthlyLimit;

      const remaining = calculateRemainingUnits(consumed, limit);
      const pct = calculateUsagePercentage(consumed, limit);
      const bill = calculateEstimatedBill(
        consumed,
        meter.estimatedRate,
        meter.fixedCharges,
        meter.additionalCharges,
        meter.taxPercentage
      );

      totalUnits += consumed;
      totalRemaining += remaining;
      if (pct >= 75) nearLimitCount += 1;
      totalCost += bill.totalEstimatedBill;
    });

    return {
      totalMeters: activeMeters.length,
      totalUnits: Math.round(totalUnits),
      totalRemaining: Math.round(totalRemaining),
      nearLimitCount,
      totalCost: Math.round(totalCost),
    };
  }, [activeMeters, months, selectedMonth]);

  // Real reading data for Daily Consumption Trend chart
  const dailyTrendData = useMemo(() => {
    const monthReadings = readings.filter((r) => r.monthId === selectedMonth);
    if (monthReadings.length === 0) return [];

    // Group cumulative consumption by reading date across active meters
    const datesSet = new Set<string>();
    monthReadings.forEach((r) => datesSet.add(r.readingDate));
    const sortedDates = Array.from(datesSet).sort();

    return sortedDates.map((dateStr) => {
      let cumulativeForDate = 0;
      activeMeters.forEach((meter) => {
        const meterReadsUpToDate = monthReadings
          .filter((r) => r.meterId === meter.meterId && r.readingDate <= dateStr)
          .sort((a, b) => a.readingDate.localeCompare(b.readingDate));

        if (meterReadsUpToDate.length > 0) {
          const latest = meterReadsUpToDate[meterReadsUpToDate.length - 1];
          cumulativeForDate += latest.totalMonthUnits;
        }
      });

      const d = new Date(dateStr + 'T00:00:00');
      const label = Number.isNaN(d.getTime())
        ? dateStr
        : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      return {
        date: label,
        units: Math.round(cumulativeForDate),
      };
    });
  }, [readings, selectedMonth, activeMeters]);

  // Monthly comparison chart data across months
  const monthlyComparisonData = useMemo(() => {
    const sortedAsc = [...availableMonths].sort();
    return sortedAsc.map((mId) => {
      let total = 0;
      activeMeters.forEach((m) => {
        if (m.currentMonthId === mId) {
          total += m.unitsConsumed;
        } else {
          const rec = months.find((mo) => mo.meterId === m.meterId && mo.monthId === mId);
          total += rec?.unitsConsumed || 0;
        }
      });
      return {
        month: formatMonthLabel(mId).split(' ')[0],
        units: Math.round(total),
      };
    });
  }, [availableMonths, activeMeters, months]);

  // Consumption vs Limit per meter bar chart
  const limitComparisonData = useMemo(() => {
    return activeMeters.map((m) => ({
      name: m.meterName,
      consumed: m.unitsConsumed,
      limit: m.monthlyLimit,
    }));
  }, [activeMeters]);

  // Meter-wise pie chart data
  const meterDistributionData = useMemo(() => {
    const total = summaryStats.totalUnits || 1;
    return activeMeters.map((m, idx) => {
      const monthRec = months.find(
        (mo) => mo.meterId === m.meterId && mo.monthId === selectedMonth
      );
      const consumed =
        selectedMonth === m.currentMonthId
          ? m.unitsConsumed
          : monthRec?.unitsConsumed ?? 0;
      return {
        name: m.meterName,
        value: consumed,
        pct: summaryStats.totalUnits > 0 ? Math.round((consumed / total) * 100) : 0,
        color: PIE_COLORS[idx % PIE_COLORS.length],
      };
    });
  }, [activeMeters, months, selectedMonth, summaryStats.totalUnits]);

  const handleQuickAddReading = (meterId: string) => {
    setSelectedMeterId(meterId);
    setActivePage('enter-reading');
  };

  return (
    <div className="space-y-6">
      {/* Greeting & Month Filter Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Good evening, {userProfile?.name || 'User'}!
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Here is your electricity usage overview.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex items-center bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-2xs">
            <Calendar className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              aria-label="Select billing month"
              className="text-xs font-semibold text-slate-700 bg-transparent outline-none cursor-pointer pr-2"
            >
              {availableMonths.map((mId) => (
                <option key={mId} value={mId}>
                  {formatMonthLabel(mId)}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingMeter(null);
              setActivePage('add-meter');
            }}
            className="px-3.5 py-2 rounded-lg bg-[#1D63ED] hover:bg-[#1652C8] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Meter</span>
          </button>
        </div>
      </div>

      {/* 5 Top Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-slate-200/90 p-4 flex items-center gap-3.5 shadow-2xs">
          <div className="w-11 h-11 rounded-full bg-[#1D63ED] text-white flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium text-slate-500 truncate">Total Meters</div>
            <div className="text-2xl font-extrabold text-slate-900 tabular-nums">
              {summaryStats.totalMeters}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/90 p-4 flex items-center gap-3.5 shadow-2xs">
          <div className="w-11 h-11 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5 fill-amber-500" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium text-slate-500 truncate">Units Consumed</div>
            <div className="text-2xl font-extrabold text-slate-900 tabular-nums">
              {summaryStats.totalUnits.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/90 p-4 flex items-center gap-3.5 shadow-2xs">
          <div className="w-11 h-11 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium text-slate-500 truncate">Remaining Units</div>
            <div className="text-2xl font-extrabold text-slate-900 tabular-nums">
              {summaryStats.totalRemaining.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/90 p-4 flex items-center gap-3.5 shadow-2xs">
          <div className="w-11 h-11 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium text-slate-500 truncate">Near Limit</div>
            <div className="text-2xl font-extrabold text-slate-900 tabular-nums">
              {summaryStats.nearLimitCount}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/90 p-4 flex items-center gap-3.5 shadow-2xs">
          <div className="w-11 h-11 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0">
            <CircleDollarSign className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium text-slate-500 truncate">Est. Monthly Cost</div>
            <div className="text-lg font-extrabold text-slate-900 tabular-nums truncate">
              {currency} {summaryStats.totalCost.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Chart: Consumption Trend / Monthly / vs Limit */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-base font-bold text-slate-900">
              {chartTab === 'daily'
                ? 'Daily Consumption Trend'
                : chartTab === 'monthly'
                ? 'Monthly Consumption Comparison'
                : 'Consumption vs. Monthly Limit'}
            </h2>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setChartTab('daily')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  chartTab === 'daily'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Daily Trend
              </button>
              <button
                type="button"
                onClick={() => setChartTab('monthly')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  chartTab === 'monthly'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setChartTab('limit')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  chartTab === 'limit'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                vs. Limit
              </button>
            </div>
          </div>

          <div className="h-60 w-full">
            {chartTab === 'daily' ? (
              dailyTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyTrendData} margin={{ top: 10, right: 12, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="wattwiseAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1D63ED" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="#1D63ED" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#FFF',
                        fontSize: '12px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="units"
                      name="Cumulative Units"
                      stroke="#1D63ED"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#wattwiseAreaGrad)"
                      dot={{ r: 4, fill: '#1D63ED', strokeWidth: 2, stroke: '#FFFFFF' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 text-xs">
                  No readings recorded for {formatMonthLabel(selectedMonth)} yet.
                </div>
              )
            ) : chartTab === 'monthly' ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyComparisonData} margin={{ top: 10, right: 12, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#FFF',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="units" name="Total Units" fill="#1D63ED" radius={[6, 6, 0, 0]} barSize={36} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={limitComparisonData} margin={{ top: 10, right: 12, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#FFF',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="consumed" name="Consumed Units" fill="#1D63ED" radius={[4, 4, 0, 0]} barSize={24} />
                  <Bar dataKey="limit" name="Monthly Limit" fill="#CBD5E1" radius={[4, 4, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Right Chart: Meter-wise Consumption Donut */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-bold text-slate-900">Meter-wise Consumption</h2>
            <button
              type="button"
              onClick={() => setActivePage('meters')}
              className="text-xs font-semibold text-[#1D63ED] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-4 my-auto">
            <div className="sm:col-span-6 h-52 relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={
                      meterDistributionData.some((d) => d.value > 0)
                        ? meterDistributionData
                        : [{ name: 'No Usage', value: 1, color: '#E2E8F0' }]
                    }
                    cx="50%"
                    cy="50%"
                    innerRadius={54}
                    outerRadius={76}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {(meterDistributionData.some((d) => d.value > 0)
                      ? meterDistributionData
                      : [{ name: 'No Usage', value: 1, color: '#E2E8F0' }]
                    ).map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-extrabold text-slate-900 tabular-nums">
                  {summaryStats.totalUnits.toLocaleString()}
                </span>
                <span className="text-xs text-slate-500 font-medium">units</span>
              </div>
            </div>

            <div className="sm:col-span-6 space-y-3">
              {meterDistributionData.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between text-xs border-b border-slate-100 pb-2 last:border-none"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-3 h-3 rounded-xs shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="font-semibold text-slate-700 truncate">{item.name}</span>
                  </div>
                  <div className="font-bold text-slate-900 tabular-nums whitespace-nowrap ml-2">
                    {item.value.toLocaleString()}{' '}
                    <span className="text-slate-400 font-normal">({item.pct}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Your Meters Section */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900">Your Meters</h2>
          <button
            type="button"
            onClick={() => setActivePage('meters')}
            className="text-xs font-semibold text-[#1D63ED] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>View all</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {activeMeters.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <p className="text-sm text-slate-500">
              You have not added any active electricity meters yet.
            </p>
            <button
              type="button"
              onClick={() => setActivePage('add-meter')}
              className="px-4 py-2 rounded-lg bg-[#1D63ED] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Your First Meter</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeMeters.map((meter) => {
              const pct = calculateUsagePercentage(meter.unitsConsumed, meter.monthlyLimit);
              const thresholdInfo = analyzeConsumptionThreshold(pct);

              return (
                <div
                  key={meter.meterId}
                  className="rounded-xl border border-slate-200/90 p-4 flex flex-col justify-between hover:border-slate-300 transition-all"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <MeterIconBadge iconType={meter.iconType} size="md" />
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-slate-900 font-mono truncate">
                            SN: {meter.meterName}
                          </h3>
                          <p className="text-xs text-slate-500 font-mono truncate">
                            Mtr: {meter.meterNumber} · CID: {meter.consumerId || 'N/A'}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate">
                            Owner: {meter.ownerName || 'User'}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingMeter(meter);
                          setActivePage('add-meter');
                        }}
                        aria-label={`Edit ${meter.meterName}`}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Consumption Progress */}
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-semibold text-slate-700 tabular-nums">
                          ⚡ {meter.unitsConsumed.toLocaleString()} /{' '}
                          {meter.monthlyLimit.toLocaleString()} units
                        </span>
                        <span className="font-bold text-slate-900 tabular-nums">{pct}%</span>
                      </div>

                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${thresholdInfo.barClass}`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2.5">
                        <span>Last reading: {meter.lastReadingDate}</span>
                        <span className="font-mono">
                          Curr: {meter.currentReading.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleQuickAddReading(meter.meterId)}
                    className="mt-4 w-full py-2 px-4 rounded-lg bg-[#1D63ED] hover:bg-[#1652C8] text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Add Reading
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
