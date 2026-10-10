import React, { useState, useEffect } from 'react';
import { Gauge, AlertCircle } from 'lucide-react';
import { useWattWise } from '../context/WattWiseContext';
import { MeterIconType } from '../types';

const PROVIDERS = [
  'LESCO (Lahore Electric Supply)',
  'K-Electric (KE)',
  'IESCO (Islamabad Electric)',
  'MEPCO (Multan Electric)',
  'FESCO (Faisalabad Electric)',
  'GEPCO (Gujranwala Electric)',
  'PESCO (Peshawar Electric)',
  'Con Edison',
  'Pacific Gas & Electric (PG&E)',
  'National Grid',
  'Other Utility Provider',
];

export const AddMeterView: React.FC = () => {
  const {
    editingMeter,
    setEditingMeter,
    addMeter,
    updateMeter,
    setActivePage,
    userProfile,
  } = useWattWise();

  const [serialNumber, setSerialNumber] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [location, setLocation] = useState('');
  const [provider, setProvider] = useState('LESCO');
  const [iconType, setIconType] = useState<MeterIconType>('home');
  const [monthlyLimit, setMonthlyLimit] = useState('500');
  const [estimatedRate, setEstimatedRate] = useState('35');
  const [fixedCharges, setFixedCharges] = useState('100');
  const [initialReading, setInitialReading] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const currency = userProfile?.currency || 'PKR';

  useEffect(() => {
    if (editingMeter) {
      setSerialNumber(editingMeter.meterName);
      setReferenceNumber(editingMeter.meterNumber === 'N/A' ? '' : editingMeter.meterNumber);
      setLocation(editingMeter.location);
      setProvider(editingMeter.provider);
      setIconType(editingMeter.iconType);
      setMonthlyLimit(String(editingMeter.monthlyLimit));
      setEstimatedRate(String(editingMeter.estimatedRate));
      setFixedCharges(String(editingMeter.fixedCharges));
      setInitialReading(String(editingMeter.openingReading));
    } else {
      setSerialNumber('');
      setReferenceNumber('');
      setLocation('');
      setProvider('LESCO');
      setIconType('home');
      setMonthlyLimit('500');
      setEstimatedRate('35');
      setFixedCharges('100');
      setInitialReading('0');
    }
  }, [editingMeter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!serialNumber.trim()) {
      setError('Please enter the meter serial number.');
      return;
    }
    const limitNum = Number(monthlyLimit);
    if (Number.isNaN(limitNum) || limitNum < 1) {
      setError('Monthly unit limit must be at least 1 unit.');
      return;
    }
    const initReadNum = Number(initialReading);
    if (Number.isNaN(initReadNum) || initReadNum < 0) {
      setError('Initial reading cannot be negative.');
      return;
    }

    setIsSaving(true);
    try {
      const cleanRef = referenceNumber.trim() || 'N/A';
      if (editingMeter) {
        await updateMeter(editingMeter.meterId, {
          meterName: serialNumber.trim(),
          meterNumber: cleanRef,
          location,
          provider,
          iconType,
          monthlyLimit: limitNum,
          estimatedRate: Math.max(0, Number(estimatedRate) || 0),
          fixedCharges: Math.max(0, Number(fixedCharges) || 0),
        });
        setEditingMeter(null);
      } else {
        await addMeter({
          meterName: serialNumber.trim(),
          meterNumber: cleanRef,
          location,
          provider,
          iconType,
          monthlyLimit: limitNum,
          estimatedRate: Math.max(0, Number(estimatedRate) || 0),
          fixedCharges: Math.max(0, Number(fixedCharges) || 0),
          initialReading: initReadNum,
        });
      }
      setActivePage('meters');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save meter.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          {editingMeter ? `Edit Meter — ${editingMeter.meterName}` : 'Add New Meter'}
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {editingMeter
            ? 'Update meter serial number, reference number, monthly unit limit, and tariff'
            : 'Register a new electricity meter with its serial number and reference number'}
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200/90 p-6 md:p-8 shadow-2xs grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Form Column */}
        <form onSubmit={handleSubmit} className="lg:col-span-8 space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Meter Serial Number *
              </label>
              <input
                type="text"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="Enter meter serial number (e.g. SN-409281)"
                required
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:border-[#1D63ED] outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Meter Reference Number
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="Enter meter reference number (e.g. 24-11234-0098123)"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:border-[#1D63ED] outline-none font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Main house, first floor"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:border-[#1D63ED] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Meter Category Icon
              </label>
              <select
                value={iconType}
                onChange={(e) => setIconType(e.target.value as MeterIconType)}
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:border-[#1D63ED] outline-none bg-white"
              >
                <option value="home">Home / Residence</option>
                <option value="office">Office / Commercial</option>
                <option value="shop">Retail Shop</option>
                <option value="factory">Factory / Industrial</option>
                <option value="apartment">Apartment / Floor</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Electricity Provider
            </label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:border-[#1D63ED] outline-none bg-white"
            >
              <option value="LESCO">LESCO</option>
              <option value="K-Electric">K-Electric</option>
              <option value="IESCO">IESCO</option>
              {PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Monthly Unit Limit *
              </label>
              <input
                type="number"
                min={1}
                value={monthlyLimit}
                onChange={(e) => setMonthlyLimit(e.target.value)}
                placeholder="e.g. 500"
                required
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:border-[#1D63ED] outline-none tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Estimated Rate per Unit ({currency})
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={estimatedRate}
                onChange={(e) => setEstimatedRate(e.target.value)}
                placeholder="e.g. 35"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:border-[#1D63ED] outline-none tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Fixed Charges ({currency})
              </label>
              <input
                type="number"
                min={0}
                value={fixedCharges}
                onChange={(e) => setFixedCharges(e.target.value)}
                placeholder="e.g. 100"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:border-[#1D63ED] outline-none tabular-nums"
              />
            </div>
          </div>

          {!editingMeter && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-0.5">
                Initial Reading
              </label>
              <p className="text-[11px] text-slate-400 mb-1.5">
                (You can update it later from Enter Reading)
              </p>
              <input
                type="number"
                min={0}
                value={initialReading}
                onChange={(e) => setInitialReading(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:border-[#1D63ED] outline-none tabular-nums"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setEditingMeter(null);
                setActivePage('meters');
              }}
              className="px-5 py-2.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 rounded-lg bg-[#1D63ED] hover:bg-[#1652C8] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              {isSaving ? 'Saving...' : editingMeter ? 'Update Meter' : 'Save Meter'}
            </button>
          </div>
        </form>

        {/* Right Illustration Card */}
        <div className="lg:col-span-4 bg-gradient-to-b from-blue-50/80 to-indigo-50/40 rounded-2xl border border-blue-100 p-6 flex flex-col items-center justify-center text-center h-full">
          <div className="w-28 h-28 rounded-2xl bg-white shadow-md border border-blue-100 flex flex-col items-center justify-center mb-5 relative">
            <div className="px-2 py-0.5 bg-blue-50 border border-blue-200 rounded text-[11px] font-mono font-bold text-[#1D63ED] mb-1.5">
              SN / REF
            </div>
            <Gauge className="w-11 h-11 text-[#1D63ED]" />
          </div>
          <h3 className="text-base font-bold text-slate-800 max-w-[220px] leading-snug">
            Track meters by Serial & Reference Number
          </h3>
          <p className="text-xs text-slate-500 mt-2 max-w-[240px] leading-relaxed">
            Each meter maintains its own serial number, reference number, independent readings, monthly limit, and history.
          </p>
        </div>
      </div>
    </div>
  );
};
