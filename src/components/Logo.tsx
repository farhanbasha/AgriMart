import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  className = '',
  size = 'md',
  showSubtitle = false,
}) => {
  const heightClasses = {
    sm: 'h-6',
    md: 'h-8 sm:h-9',
    lg: 'h-10 sm:h-11',
    xl: 'h-14 sm:h-16',
  };

  return (
    <div className={`inline-flex items-center gap-2 select-none ${className}`}>
      {/* Primary: Exact uploaded logo design rendered with high-fidelity transparency */}
      <img
        src="/logo-transparent.png"
        alt="AgriMart"
        className={`${heightClasses[size]} w-auto object-contain drop-shadow-xs`}
        loading="eager"
        decoding="async"
        onError={(e) => {
          // If the transparent image encounters an issue, fallback to vector logo
          const target = e.currentTarget;
          target.style.display = 'none';
          const fallback = target.nextElementSibling;
          if (fallback) {
            (fallback as HTMLElement).style.display = 'inline-flex';
          }
        }}
      />

      {/* High-precision Typography Fallback matching exact design colors */}
      <span
        style={{ display: 'none' }}
        className="font-black tracking-tight text-xl sm:text-2xl font-sans uppercase items-center leading-none"
      >
        <span className="text-[#274e13]">AGRI</span>
        <span className="text-[#3c78d8]">MART</span>
      </span>

      {showSubtitle && (
        <span className="text-[11px] font-semibold text-neutral-500 hidden sm:inline-block border-l border-neutral-300 pl-2">
          Kisan Seva
        </span>
      )}
    </div>
  );
};

export default Logo;
