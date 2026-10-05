import { Bell, Menu, Plus } from "lucide-react";
import ViewModeSwitcher from "./ViewModeSwitcher";

export default function TopHeader({
  onMenuClick,
  onAddTenant,
}: {
  onMenuClick: () => void;
  onAddTenant?: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-slate-200 bg-white/80 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open navigation menu"
        className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 lg:hidden"
      >
        <Menu size={20} />
      </button>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <ViewModeSwitcher />
        <button
          type="button"
          aria-label="Notifications"
          className="relative rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
        </button>

        <button
          type="button"
          onClick={onAddTenant}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Add Tenant</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>
    </header>
  );
}
