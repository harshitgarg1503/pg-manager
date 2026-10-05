"use client";

import { useState } from "react";
import {
  Building2,
  CreditCard,
  Crown,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import NoticePeriodForm from "./NoticePeriodForm";
import StaffManager from "./StaffManager";

type TabId = "general" | "payment" | "staff" | "subscription";

const TABS: { id: TabId; label: string; icon: typeof Building2 }[] = [
  { id: "general", label: "General Profile", icon: Building2 },
  { id: "payment", label: "Payment & Invoicing", icon: CreditCard },
  { id: "staff", label: "Staff & Roles", icon: Users },
  { id: "subscription", label: "Subscription", icon: Crown },
];

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900";

const labelClass = "block text-sm font-medium text-slate-700";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("payment");
  const [rentDueDay, setRentDueDay] = useState("5");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your property details, payment accounts, and billing rules.
        </p>
      </div>

      {/* Tab navigation */}
      <div
        role="tablist"
        aria-label="Settings sections"
        className="flex gap-1 overflow-x-auto border-b border-slate-200"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm transition-colors",
                isActive
                  ? "border-slate-900 font-medium text-slate-900"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900"
              )}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* General Profile */}
      {activeTab === "general" && (
        <div className="space-y-4">
        <section
          role="tabpanel"
          className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm"
        >
          <h2 className="text-base font-semibold">General Profile</h2>
          <p className="mt-1 text-sm text-slate-500">
            Basic details shown across the dashboard and tenant communications.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="pg-name" className={labelClass}>
                PG Name
              </label>
              <input
                id="pg-name"
                type="text"
                defaultValue="Sunrise Luxury PG"
                placeholder="e.g. Sunrise Luxury PG"
                className={cn(inputClass, "mt-1.5")}
              />
            </div>
            <div>
              <label htmlFor="contact-phone" className={labelClass}>
                Contact Phone
              </label>
              <input
                id="contact-phone"
                type="tel"
                defaultValue="+91 98200 45678"
                placeholder="+91 XXXXX XXXXX"
                className={cn(inputClass, "mt-1.5")}
              />
            </div>
            <div>
              <label htmlFor="support-email" className={labelClass}>
                Support Email
              </label>
              <input
                id="support-email"
                type="email"
                defaultValue="care@sunrisepg.in"
                placeholder="care@yourpg.in"
                className={cn(inputClass, "mt-1.5")}
              />
            </div>
            <div>
              <label htmlFor="curfew-time" className={labelClass}>
                Curfew / Gate Closing Time
              </label>
              <input
                id="curfew-time"
                type="time"
                defaultValue="22:30"
                className={cn(inputClass, "mt-1.5")}
              />
              <p className="mt-1.5 text-xs text-slate-500">
                Gate closes at 10:30 PM. Late entries are logged by the warden.
              </p>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="full-address" className={labelClass}>
                Full Address
              </label>
              <textarea
                id="full-address"
                rows={3}
                defaultValue="12, MG Road, Near Metro Station, Bengaluru, Karnataka 560001"
                placeholder="Plot / street / area / city / pincode"
                className={cn(inputClass, "mt-1.5 resize-none")}
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end border-t border-slate-100 pt-5">
            <button
              type="button"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
            >
              Save Changes
            </button>
          </div>
        </section>

          <NoticePeriodForm />
        </div>
      )}

      {/* Payment & Invoicing */}
      {activeTab === "payment" && (
        <div className="space-y-4">
          <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-semibold">Payment Accounts</h2>
            <p className="mt-1 text-sm text-slate-500">
              Where tenants should send rent and how it appears on invoices.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-5">
              <div>
                <label htmlFor="upi-id" className={labelClass}>
                  UPI ID
                </label>
                <input
                  id="upi-id"
                  type="text"
                  defaultValue="pgowner@upi"
                  placeholder="pgowner@upi"
                  className={cn(inputClass, "mt-1.5 max-w-md")}
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  This will be displayed on tenant invoices.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <div>
                  <label htmlFor="acct-number" className={labelClass}>
                    Bank Account Number
                  </label>
                  <input
                    id="acct-number"
                    type="text"
                    inputMode="numeric"
                    defaultValue="50200012345678"
                    placeholder="e.g. 50200012345678"
                    className={cn(inputClass, "mt-1.5")}
                  />
                </div>
                <div>
                  <label htmlFor="ifsc" className={labelClass}>
                    IFSC Code
                  </label>
                  <input
                    id="ifsc"
                    type="text"
                    defaultValue="HDFC0001234"
                    placeholder="e.g. HDFC0001234"
                    className={cn(inputClass, "mt-1.5 uppercase")}
                  />
                </div>
                <div>
                  <label htmlFor="bank-name" className={labelClass}>
                    Bank Name
                  </label>
                  <input
                    id="bank-name"
                    type="text"
                    defaultValue="HDFC Bank"
                    placeholder="e.g. HDFC Bank"
                    className={cn(inputClass, "mt-1.5")}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-base font-semibold">Billing Rules</h2>
            <p className="mt-1 text-sm text-slate-500">
              Applied automatically when generating monthly invoices.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
              <div>
                <label htmlFor="elec-rate" className={labelClass}>
                  Electricity Rate (₹ per kWh)
                </label>
                <div className="relative mt-1.5">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400">
                    ₹
                  </span>
                  <input
                    id="elec-rate"
                    type="number"
                    min={0}
                    step="0.5"
                    defaultValue={9}
                    className={cn(inputClass, "pl-7")}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="rent-due" className={labelClass}>
                  Rent Due Day
                </label>
                <select
                  id="rent-due"
                  value={rentDueDay}
                  onChange={(e) => setRentDueDay(e.target.value)}
                  className={cn(inputClass, "mt-1.5")}
                >
                  {Array.from({ length: 10 }, (_, i) => String(i + 1)).map(
                    (day) => (
                      <option key={day} value={day}>
                        {day}
                        {day === "1"
                          ? "st"
                          : day === "2"
                            ? "nd"
                            : day === "3"
                              ? "rd"
                              : "th"}{" "}
                        of every month
                      </option>
                    )
                  )}
                </select>
              </div>
              <div>
                <label htmlFor="late-fee" className={labelClass}>
                  Late Fee (₹ per day)
                </label>
                <div className="relative mt-1.5">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400">
                    ₹
                  </span>
                  <input
                    id="late-fee"
                    type="number"
                    min={0}
                    step="10"
                    defaultValue={50}
                    className={cn(inputClass, "pl-7")}
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end border-t border-slate-100 pt-5">
              <button
                type="button"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
              >
                Save Changes
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Staff & Roles */}
      {activeTab === "staff" && <StaffManager />}

      {/* Subscription */}
      {activeTab === "subscription" && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-amber-100 p-2 text-amber-700">
              <Crown size={20} />
            </span>
            <div>
              <h2 className="text-base font-semibold">Current Plan</h2>
              <p className="text-sm text-slate-500">
                Pro Plan (₹1,499/mo)
              </p>
            </div>
            <span className="ml-auto rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
              Active
            </span>
          </div>

          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-slate-900">
                48 / 60 beds used
              </p>
              <p className="text-xs tabular-nums text-slate-500">80%</p>
            </div>
            <div
              role="progressbar"
              aria-valuenow={48}
              aria-valuemin={0}
              aria-valuemax={60}
              aria-label="Beds used"
              className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"
            >
              <div className="h-full w-[80%] rounded-full bg-slate-900" />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              12 beds remaining. Upgrade to add more properties or beds.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
            <p className="text-xs text-slate-500">
              Renews on Oct 29, 2026 · Cancel anytime
            </p>
            <button
              type="button"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
            >
              Upgrade
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
