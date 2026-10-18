"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BedDouble,
  CreditCard,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  Settings,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { VIEW_MODE_EVENT, readViewMode, type ViewMode } from "@/lib/viewMode";
import { logoutUser } from "@/actions/authActions";
import { getWalletBalance } from "@/actions/walletActions";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import BranchSwitcher from "./BranchSwitcher";

const OWNER_NAV = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Rooms & Beds", href: "/rooms", icon: BedDouble },
  { label: "Tenants", href: "/tenants", icon: Users },
  { label: "Invoices", href: "/invoices", icon: ReceiptText },
  { label: "Maintenance", href: "/maintenance", icon: Wrench },
  { label: "Expenses", href: "/expenses", icon: Wallet },
  { label: "Wallet", href: "/wallet", icon: CreditCard },
  { label: "Settings", href: "/settings", icon: Settings },
];

/** Warden view: operational data only — no financials, no settings. */
const STAFF_NAV = [
  { label: "Rooms & Beds", href: "/rooms", icon: BedDouble },
  { label: "Maintenance", href: "/maintenance", icon: Wrench },
  { label: "Tenants", href: "/tenants", icon: Users },
  { label: "Log Expense", href: "/expenses", icon: Wallet },
];

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const [mode, setMode] = useState<ViewMode>(() => readViewMode());
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useEffect(() => {
    const onMode = (e: Event) =>
      setMode((e as CustomEvent<ViewMode>).detail ?? "owner");
    window.addEventListener(VIEW_MODE_EVENT, onMode);
    return () => window.removeEventListener(VIEW_MODE_EVENT, onMode);
  }, []);

  // Owner-only wallet balance chip; refreshes as you navigate since
  // recharges and bed deductions change it. (Render is mode-guarded, so no
  // stale balance ever shows in staff view.)
  useEffect(() => {
    if (mode !== "owner") return;
    let cancelled = false;
    void getWalletBalance().then((w) => {
      if (!cancelled) setWalletBalance(w ? w.walletBalance : null);
    });
    return () => {
      cancelled = true;
    };
  }, [mode, pathname]);

  const NAV_ITEMS = mode === "staff" ? STAFF_NAV : OWNER_NAV;

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Multi-branch switcher (real properties, active-branch cookie) */}
      <BranchSwitcher onNavigate={onNavigate} />

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3" aria-label="Primary">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-slate-100 font-medium text-slate-900"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <Icon
                size={18}
                className={cn(isActive ? "text-slate-900" : "text-slate-400")}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Wallet balance (owner only) */}
      {mode === "owner" && walletBalance !== null && (
        <div className="px-3 pb-2">
          <Link
            href="/wallet"
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 transition-colors hover:bg-slate-100"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
              <Wallet size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-slate-500">
                Wallet Balance
              </span>
              <span className="block truncate text-sm font-semibold tabular-nums text-slate-900">
                {formatINR(walletBalance)}
              </span>
            </span>
          </Link>
        </div>
      )}

      {/* User footer */}
      <div className="border-t border-slate-100 p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
            AK
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-slate-900">
              Admin Kumar
            </span>
            <span className="block truncate text-xs text-slate-500">
              admin@sunrisepg.in
            </span>
          </span>
          <button
            type="button"
            aria-label="Sign Out"
            title="Sign Out"
            onClick={() => void logoutUser()}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
