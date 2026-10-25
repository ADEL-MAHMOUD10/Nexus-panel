import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '', showLabel = true }) => {
  const { theme, toggleTheme, isDark } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
      title={isDark ? 'Switch to Light Mode (الوضع الفاتح) • Alt+T' : 'Switch to Dark Mode (الوضع الداكن) • Alt+T'}
      className={`
        theme-toggle-btn group relative flex items-center gap-2 px-2.5 py-1.5 rounded-xl transition-all duration-200 select-none cursor-pointer
        border text-xs font-medium active:scale-95
        ${
          isDark
            ? 'bg-neutral-900/90 hover:bg-neutral-800 border-neutral-800 text-neutral-300 hover:text-white shadow-xs'
            : 'bg-[#ffffff] hover:bg-[#faf7f4] border-[#dcd6d0] text-[#18181b] shadow-xs'
        }
        ${className}
      `}
    >
      {/* Icon with smooth rotate/scale transition */}
      <div className="relative w-4 h-4 flex items-center justify-center shrink-0">
        {isDark ? (
          <Moon className="w-3.5 h-3.5 text-blue-400 transition-transform duration-300 transform group-hover:-rotate-12 group-hover:scale-110" />
        ) : (
          <Sun className="w-4 h-4 text-amber-600 transition-transform duration-300 transform group-hover:rotate-45 group-hover:scale-110" />
        )}
      </div>

      {/* Label and Mode Indicator */}
      {showLabel && (
        <div className="flex items-center gap-1.5 hidden sm:flex">
          <span className="font-sans text-xs tracking-tight font-medium">
            {isDark ? 'Dark' : 'Light'}
          </span>
          <span
            className={`w-1.5 h-1.5 rounded-full transition-colors ${
              isDark ? 'bg-blue-400' : 'bg-amber-500'
            }`}
          />
        </div>
      )}
    </button>
  );
};
