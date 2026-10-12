import React, { useState, useEffect, useMemo } from 'react';
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
  Activity,
  Clock,
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
  calculateDailyStats,
  getCurrentMonthId,
  getTimeOfDayGreeting,
  formatLiveDateTime,
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

  // Real-time ticking clock state updated every second
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const currentRealMonthId = useMemo(() => getCurrentMonthId(now), [now]);
  const liveClock = useMemo(() => formatLiveDateTime(now), [now]);
  const greeting = useMemo(() => getTimeOfDayGreeting(now), [now]);

  const activeMeters = useMemo(
    () => meters.filter((m) => m.isActive && !m.isArchived),
    [meters]
  );

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    set.add(currentRealMonthId);
    meters.forEach((m) => set.add(m.currentMonthId));
    months.forEach((mo) => set.add(mo.monthId));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [meters, months, currentRealMonthId]);

  const [selectedMonth, setSelectedMonth] = useState<string>(
    () => activeMeters[0]?.currentMonthId || availableMonths[0] || getCurrentMonthId()
  );
  const [chartTab, setChartTab] = useState<'daily' | 'monthly' | 'limit'>('daily');

  // Keep selectedMonth aligned with active meters when data loads from Firebase
  useEffect(() => {
    if (activeMeters.length > 0) {
      const hasMeterInSelected = activeMeters.some((m) => m.currentMonthId === selectedMonth);
      const hasMonthRecordInSelected = months.some((mo) => mo.monthId === selectedMonth);
      if (!hasMeterInSelected && !hasMonthRecordInSelected) {
        setSelectedMonth(activeMeters[0].currentMonthId);
      }
    }
  }, [activeMeters, months, selectedMonth]);

  const currency = userProfile?.currency || 'PKR';

  // Aggregate summary stats & Daily Usage Average across all active meters together
  const summaryStats = useMemo(() => {
    let totalUnitsExact = 0;
    let totalRemainingExact = 0;
    let totalLimitExact = 0;
    let nearLimitCount = 0;
    let totalCost = 0;
    let allFinalized = activeMeters.length > 0;

    activeMeters.forEach((meter) => {
      const monthRec = months.find(
        (mo) => mo.meterId === meter.meterId && mo.monthId === selectedMonth
      );
      const isCurrentActiveMonth = selectedMonth === meter.currentMonthId;
      if (isCurrentActiveMonth || monthRec?.status !== 'finalized') {
        allFinalized = false;
      }

      const consumed = isCurrentActiveMonth
        ? meter.unitsConsumed
        : monthRec?.unitsConsumed ?? 0;
      const limit = isCurrentActiveMonth
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

      totalUnitsExact += consumed;
      totalRemainingExact += remaining;
      totalLimitExact += limit;
      if (pct >= 75) nearLimitCount += 1;
      totalCost += bill.totalEstimatedBill;
    });

    const combinedDaily = calculateDailyStats(
      totalUnitsExact,
      totalLimitExact,
      selectedMonth,
      now.toISOString(),
      allFinalized
    );

    const perMeterDailyAverage =
      activeMeters.length > 0
        ? Math.round((combinedDaily.dailyAverage / activeMeters.length) * 100) / 100
        : 0;

    return {
      totalMeters: activeMeters.length,
      totalUnits: Math.round(totalUnitsExact * 100) / 100,
      totalRemaining: Math.round(totalRemainingExact * 100) / 100,
      totalLimit: Math.round(totalLimitExact),
      nearLimitCount,
      totalCost: Math.round(totalCost),
      combinedDailyAverage: combinedDaily.dailyAverage,
      combinedDailyAllowance: combinedDaily.dailyLimitAllowance,
      perMeterDailyAverage,
      daysElapsed: combinedDaily.daysElapsed,
      daysInMonth: combinedDaily.daysInMonth,
      projectedMonthlyUnits: combinedDaily.projectedMonthlyUnits,
      estimatedDaysRemainingBeforeLimit: combinedDaily.estimatedDaysRemainingBeforeLimit,
    };
  }, [activeMeters, months, selectedMonth, now]);

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
      {/* Greeting, Real-Time Clock & Month Filter Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {greeting}, {userProfile?.name || 'User'}!
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200/80 text-[11px] font-semibold text-emerald-700 tabular-nums">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <Clock className="w-3 h-3" />
              <span>
                {liveClock.dayName}, {liveClock.dateFormatted} · {liveClock.timeFormatted}
              </span>
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time electricity usage overview and combined daily average across all meters.
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

      {/* 6 Top Summary KPI Cards (Including Combined Daily Usage Average of All Meters) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
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

        {/* Daily Usage Average of All Meters Together */}
        <div className="bg-white rounded-xl border border-blue-200/90 p-4 flex items-center gap-3.5 shadow-2xs">
          <div className="w-11 h-11 rounded-full bg-blue-50 text-[#1D63ED] flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium text-slate-500 truncate">
              Daily Avg (All Meters)
            </div>
            <div className="text-xl font-extrabold text-[#1D63ED] tabular-nums truncate">
              {summaryStats.combinedDailyAverage.toLocaleString()}{' '}
              <span className="text-xs font-semibold text-slate-500">u/day</span>
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              Day {summaryStats.daysElapsed} of {summaryStats.daysInMonth}
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

      {/* Combined Daily Usage Average Breakdown Banner (All Meters Together) */}
      <div className="bg-white rounded-xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-[#1D63ED] flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Combined Daily Usage Average (All {summaryStats.totalMeters}{' '}
                {summaryStats.totalMeters === 1 ? 'Meter' : 'Meters'} Together)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Calculated in real time from {summaryStats.totalUnits.toLocaleString()} total units consumed over{' '}
                {summaryStats.daysElapsed} elapsed {summaryStats.daysElapsed === 1 ? 'day' : 'days'} in{' '}
                {formatMonthLabel(selectedMonth)}.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-5 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
            <div>
              <div className="text-[11px] font-medium text-slate-500">All Meters Daily Avg</div>
              <div className="text-base font-extrabold text-[#1D63ED] tabular-nums">
                {summaryStats.combinedDailyAverage.toLocaleString()} u/day
              </div>
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-500">Avg Per Meter</div>
              <div className="text-base font-extrabold text-slate-900 tabular-nums">
                {summaryStats.perMeterDailyAverage.toLocaleString()} u/day
              </div>
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-500">Safe Daily Budget</div>
              <div className="text-base font-extrabold text-emerald-600 tabular-nums">
                {summaryStats.combinedDailyAllowance.toLocaleString()} u/day
              </div>
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-500">Projected Monthly</div>
              <div className="text-base font-extrabold text-slate-900 tabular-nums">
                {summaryStats.projectedMonthlyUnits.toLocaleString()} units
              </div>
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
              const meterDaily = calculateDailyStats(
                meter.unitsConsumed,
                meter.monthlyLimit,
                meter.currentMonthId,
                now.toISOString(),
                false
              );

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
                        <span className="font-semibold text-[#1D63ED] tabular-nums">
                          Avg: {meterDaily.dailyAverage.toLocaleString()} u/day
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                        <span>Open: {meter.openingReading.toLocaleString()}</span>
                        <span className="font-mono text-slate-600">
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
