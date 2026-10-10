import React, { useState } from 'react';
import { Zap, X } from 'lucide-react';
import { useWattWise } from '../context/WattWiseContext';
import { MeterIconType } from '../types';

export const SetupWizardModal: React.FC = () => {
  const { showSetupWizard, setShowSetupWizard, addMeter, userProfile } = useWattWise();

  const [serialNumber, setSerialNumber] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [ownerName, setOwnerName] = useState(userProfile?.name || '');
  const [location, setLocation] = useState('');
  const [provider, setProvider] = useState('LESCO');
  const [iconType] = useState<MeterIconType>('home');
  const [monthlyLimit, setMonthlyLimit] = useState('500');
  const [estimatedRate, setEstimatedRate] = useState('35');
  const [initialReading, setInitialReading] = useState('0');
  const [isSaving, setIsSaving] = useState(false);

  if (!showSetupWizard) return null;

  const handleCreateFirstMeter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serialNumber.trim()) return;
    setIsSaving(true);
    try {
      await addMeter({
        meterName: serialNumber.trim(),
        meterNumber: referenceNumber.trim() || 'N/A',
        ownerName: ownerName.trim() || userProfile?.name || 'User',
        location: location.trim(),
        provider: provider.trim() || 'LESCO',
        iconType,
        monthlyLimit: Number(monthlyLimit) || 500,
        estimatedRate: Number(estimatedRate) || 35,
        initialReading: Number(initialReading) || 0,
      });
      setShowSetupWizard(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
        <div className="bg-gradient-to-r from-[#081C3E] to-[#1D63ED] p-6 text-white flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white fill-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Welcome to WattWise!</h3>
              <p className="text-xs text-blue-100">
                First-time setup wizard — add your first electricity meter
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowSetupWizard(false)}
            className="text-blue-100 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <form onSubmit={handleCreateFirstMeter} className="space-y-4">
            <div className="text-xs font-semibold text-slate-500">
              Enter your meter serial number, reference number, and owner name to start tracking:
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Meter Serial Number *
                </label>
                <input
                  type="text"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  placeholder="e.g. SN-409281"
                  required
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-[#1D63ED] outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Meter Reference Number
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="e.g. 24-11234-0098123"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-[#1D63ED] outline-none font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Owner Name *
                </label>
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="e.g. John Doe"
                  required
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-[#1D63ED] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Main house"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-[#1D63ED] outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Monthly Limit *
                </label>
                <input
                  type="number"
                  min={1}
                  value={monthlyLimit}
                  onChange={(e) => setMonthlyLimit(e.target.value)}
                  placeholder="500"
                  required
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-[#1D63ED] outline-none tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Rate / Unit
                </label>
                <input
                  type="number"
                  min={0}
                  value={estimatedRate}
                  onChange={(e) => setEstimatedRate(e.target.value)}
                  placeholder="35"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-[#1D63ED] outline-none tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Opening Reading *
                </label>
                <input
                  type="number"
                  min={0}
                  value={initialReading}
                  onChange={(e) => setInitialReading(e.target.value)}
                  placeholder="0"
                  required
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-[#1D63ED] outline-none tabular-nums"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-2.5 rounded-lg bg-[#1D63ED] hover:bg-[#1652C8] text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSaving ? 'Saving Meter...' : 'Save Meter & Open Dashboard'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
