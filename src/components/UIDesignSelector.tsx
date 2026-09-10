import React from 'react';
import { UITheme } from '../types';
import { X, CheckCircle2, Sun, Moon, Sprout, Layout } from 'lucide-react';

interface UIDesignSelectorProps {
  currentTheme: UITheme;
  onSelectTheme: (theme: UITheme) => void;
  isOpen: boolean;
  onClose: () => void;
}

interface ThemeOption {
  id: UITheme;
  title: string;
  subtitle: string;
  badge: string;
  icon: React.ReactNode;
  bgPreview: string;
  accentPreview: string;
  borderPreview: string;
  bestFor: string;
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'kisan_green',
    title: 'Kisan Green',
    subtitle: 'Classic Agrarian Emerald',
    badge: 'Default',
    icon: <Sprout className="w-5 h-5 text-emerald-600" />,
    bgPreview: 'bg-[#f8faf8]',
    accentPreview: 'bg-emerald-700',
    borderPreview: 'border-emerald-300',
    bestFor: 'Balanced contrast, familiar cooperative agricultural palette',
  },
  {
    id: 'dhoop_sunlight',
    title: 'Dhoop Sunlight',
    subtitle: 'High-Contrast Outdoor Glare',
    badge: 'Outdoor',
    icon: <Sun className="w-5 h-5 text-amber-600" />,
    bgPreview: 'bg-[#faf8f2]',
    accentPreview: 'bg-amber-600',
    borderPreview: 'border-amber-400',
    bestFor: 'Direct sunlight in fields, prevents screen washout',
  },
  {
    id: 'swachh_slate',
    title: 'Swachh Slate',
    subtitle: 'Utilitarian Civil Engineering',
    badge: 'Neutral',
    icon: <Layout className="w-5 h-5 text-slate-600" />,
    bgPreview: 'bg-[#f8fafc]',
    accentPreview: 'bg-slate-800',
    borderPreview: 'border-slate-300',
    bestFor: 'Clean neutral grey for mandis, office desks, and tablets',
  },
  {
    id: 'raat_dark',
    title: 'Raat Dark',
    subtitle: 'Midnight OLED Field Mode',
    badge: 'Night',
    icon: <Moon className="w-5 h-5 text-indigo-400" />,
    bgPreview: 'bg-[#0b1120]',
    accentPreview: 'bg-emerald-500',
    borderPreview: 'border-neutral-700',
    bestFor: 'Night harvest shifts, reduces eye fatigue, saves phone battery',
  },
];

export const UIDesignSelector: React.FC<UIDesignSelectorProps> = ({
  currentTheme,
  onSelectTheme,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="theme-selector-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-neutral-900/60 backdrop-blur-xs overflow-y-auto animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl bg-white rounded-3xl border border-neutral-200 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/80">
          <div>
            <h2 id="theme-selector-title" className="text-base sm:text-lg font-bold text-neutral-900">
              Select Display Theme
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Tuned for bright outdoor field sunlight and nighttime battery saving.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Options Grid */}
        <div className="p-4 sm:p-6 space-y-3 overflow-y-auto flex-1">
          {THEME_OPTIONS.map((theme) => {
            const isSelected = currentTheme === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => {
                  onSelectTheme(theme.id);
                  onClose();
                }}
                className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center justify-between gap-3 group active:scale-[0.99] ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50/40 shadow-xs'
                    : 'border-neutral-200 hover:border-neutral-300 bg-white hover:bg-neutral-50/60'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-2xs flex-shrink-0 ${theme.bgPreview} ${theme.borderPreview}`}
                  >
                    {theme.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-neutral-900 truncate">
                        {theme.title}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600 border border-neutral-200">
                        {theme.badge}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 truncate mt-0.5">{theme.subtitle}</p>
                    <p className="text-[11px] text-neutral-400 hidden sm:block mt-1">
                      {theme.bestFor}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 pl-2">
                  <div className="flex items-center gap-1">
                    <span className={`w-3 h-3 rounded-full ${theme.accentPreview}`} />
                  </div>
                  {isSelected ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-neutral-300 group-hover:border-neutral-400" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer Note */}
        <div className="px-5 py-3 sm:px-6 bg-neutral-50 border-t border-neutral-100 text-[11px] text-neutral-500 text-center">
          Choice is saved to your phone cache and restored on next visit.
        </div>
      </div>
    </div>
  );
};
