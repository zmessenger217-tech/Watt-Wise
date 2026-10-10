import React from 'react';
import { Home, Building2, Store, Factory, Building, Zap } from 'lucide-react';
import { MeterIconType } from '../types';

export const WattWiseLogo: React.FC<{ size?: 'sm' | 'md' | 'lg'; darkText?: boolean }> = ({
  size = 'md',
  darkText = false,
}) => {
  const iconBoxSize =
    size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-12 h-12' : 'w-9 h-9';
  const boltSize = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5';
  const titleSize =
    size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-3xl' : 'text-xl';

  return (
    <div className="flex items-center gap-2.5 select-none">
      <div
        className={`${iconBoxSize} rounded-full bg-gradient-to-br from-[#2B7FFF] to-[#155DFC] flex items-center justify-center shadow-sm shrink-0`}
      >
        <Zap className={`${boltSize} text-white fill-white`} />
      </div>
      <span
        className={`${titleSize} font-bold tracking-tight whitespace-nowrap ${
          darkText ? 'text-slate-900' : 'text-white'
        }`}
      >
        WattWise
      </span>
    </div>
  );
};

export const MeterIconBadge: React.FC<{
  iconType: MeterIconType;
  size?: 'sm' | 'md' | 'lg';
}> = ({ iconType, size = 'md' }) => {
  const dimensions =
    size === 'sm' ? 'w-9 h-9' : size === 'lg' ? 'w-12 h-12' : 'w-11 h-11';
  const iconDimensions =
    size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5';

  const colorMap: Record<MeterIconType, string> = {
    home: 'bg-[#1D63ED] text-white',
    office: 'bg-[#16A34A] text-white',
    shop: 'bg-[#0284C7] text-white',
    factory: 'bg-[#D97706] text-white',
    apartment: 'bg-[#4F46E5] text-white',
  };

  const renderIcon = () => {
    switch (iconType) {
      case 'office':
        return <Building2 className={iconDimensions} />;
      case 'shop':
        return <Store className={iconDimensions} />;
      case 'factory':
        return <Factory className={iconDimensions} />;
      case 'apartment':
        return <Building className={iconDimensions} />;
      case 'home':
      default:
        return <Home className={iconDimensions} />;
    }
  };

  return (
    <div
      className={`${dimensions} ${
        colorMap[iconType] || colorMap.home
      } rounded-full flex items-center justify-center shrink-0 shadow-xs`}
    >
      {renderIcon()}
    </div>
  );
};
