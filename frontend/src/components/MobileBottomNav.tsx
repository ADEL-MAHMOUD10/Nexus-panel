import React from 'react';
import { 
  LayoutDashboard, 
  Radio, 
  Users, 
  Sliders, 
  Menu 
} from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onlineCount: number;
  inboundsCount: number;
  onOpenMobileSidebar: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  onlineCount,
  inboundsCount,
  onOpenMobileSidebar,
}) => {
  const navTabs = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inbounds', label: 'Inbounds', icon: Radio, count: inboundsCount },
    { id: 'clients', label: 'Clients', icon: Users, badge: onlineCount > 0 ? onlineCount : undefined },
    { id: 'config', label: 'Config', icon: Sliders },
  ];

  return (
    <div className="md:hidden fixed bottom-0 inset-x-0 z-30 mobile-bottom-nav bg-white/95 dark:bg-[#161617]/95 backdrop-blur-2xl border-t border-neutral-200/80 dark:border-white/10 px-2 py-1.5 flex items-center justify-around select-none shadow-[0_-4px_24px_rgba(0,0,0,0.06)] dark:shadow-none">
      {navTabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all relative ${
              isActive 
                ? 'text-neutral-950 dark:text-white font-bold' 
                : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            {/* Active indicator pill */}
            {isActive && (
              <span className="absolute -top-1.5 w-8 h-0.5 rounded-full bg-neutral-950 dark:bg-white transition-colors" />
            )}

            <div className="relative">
              <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 text-neutral-950 dark:text-white' : 'text-neutral-400 dark:text-neutral-400'}`} />
              {tab.badge !== undefined && (
                <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-emerald-500 text-[9px] font-bold text-white dark:text-neutral-950 flex items-center justify-center font-mono shadow-xs">
                  {tab.badge > 9 ? '9+' : tab.badge}
                </span>
              )}
            </div>
            <span className={`text-[10px] tracking-tight mt-0.5 ${isActive ? 'text-neutral-950 dark:text-white font-bold' : 'text-neutral-500 dark:text-neutral-400 font-medium'}`}>
              {tab.label}
            </span>
          </button>
        );
      })}

      {/* "More" button to toggle full drawer */}
      <button
        type="button"
        onClick={onOpenMobileSidebar}
        className="flex flex-col items-center justify-center flex-1 py-1 rounded-xl text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 transition-all"
      >
        <Menu className="w-5 h-5 text-neutral-400 dark:text-neutral-400" />
        <span className="text-[10px] tracking-tight mt-0.5 text-neutral-500 dark:text-neutral-400 font-medium">
          More
        </span>
      </button>
    </div>
  );
};
