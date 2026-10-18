"use client";

import { useEffect, useState } from "react";
import {
  CalendarClock,
  ChefHat,
  ChevronDown,
  Coffee,
  Soup,
  UtensilsCrossed,
  X,
} from "lucide-react";
import {
  getUpcomingMealForecast,
  setMealAttendance,
  type ForecastDay,
  type MealKey,
} from "@/actions/mealActions";
import { cn } from "@/lib/utils";

/* --------------------------------- Helpers -------------------------------- */

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function parseKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** "Sat, 24 Oct" */
function tabDateLabel(dateKey: string): string {
  const d = parseKey(dateKey);
  return `${WEEKDAYS_SHORT[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** "Sunday, 25 Oct" */
function bannerDateLabel(dateKey: string): string {
  const d = parseKey(dateKey);
  return `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

const TAB_NAMES = ["Today", "Tomorrow", "+2 Days", "+3 Days"];

/** Share of residents away that triggers the advance-notice banner. */
const AWAY_BANNER_THRESHOLD = 0.3;

const MEALS: { key: MealKey; label: string; icon: typeof Coffee }[] = [
  { key: "breakfast", label: "Breakfast", icon: Coffee },
  { key: "lunch", label: "Lunch", icon: UtensilsCrossed },
  { key: "dinner", label: "Dinner", icon: Soup },
];

/* -------------------------------- Component ------------------------------- */

interface KitchenHeadcountProps {
  /**
   * Forecast prefetched on the server and streamed in via Suspense. When
   * provided, the client skips its own fetch; without it (e.g. a later
   * client-side mount) it falls back to fetching the action itself.
   */
  initialForecast?: ForecastDay[] | null;
}

export default function KitchenHeadcount({
  initialForecast = null,
}: KitchenHeadcountProps) {
  const [forecast, setForecast] = useState<ForecastDay[] | null>(
    initialForecast,
  );
  const [tabIndex, setTabIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    if (initialForecast) return; // already hydrated by the server
    let cancelled = false;
    getUpcomingMealForecast().then(
      (days) => {
        if (!cancelled) setForecast(days);
      },
      () => {
        if (!cancelled)
          setError("Couldn't load meal counts. Please retry.");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [initialForecast]);

  async function handleRetry() {
    setError(null);
    try {
      setForecast(await getUpcomingMealForecast());
    } catch {
      setError("Couldn't load meal counts. Please retry.");
    }
  }

  const active = forecast?.[tabIndex] ?? null;
  const loading = forecast === null;

  // Advance-notice banner: the worst away-day in the window, shown when a
  // large share of residents will be out (festival / long weekend).
  const bannerDay = (() => {
    if (!forecast) return null;
    let worst: ForecastDay | null = null;
    for (const day of forecast) {
      if (day.totalTenants === 0) continue;
      if (day.awayCount / day.totalTenants < AWAY_BANNER_THRESHOLD) continue;
      if (!worst || day.awayCount > worst.awayCount) worst = day;
    }
    return worst;
  })();
  const showBanner = bannerDay !== null && !bannerDismissed;

  async function handleToggle(
    tenantId: string,
    meal: MealKey,
    currentlyEating: boolean,
  ) {
    if (!active) return;
    const dateKey = active.dateKey;
    // Optimistic flip so the headcount feels live; re-sync on failure.
    setForecast((prev) => {
      if (!prev) return prev;
      return prev.map((day) => {
        if (day.dateKey !== dateKey) return day;
        const tenants = day.tenants.map((t) =>
          t.id === tenantId ? { ...t, [meal]: !currentlyEating } : t,
        );
        const count = (k: MealKey) => tenants.filter((t) => t[k]).length;
        return {
          ...day,
          tenants,
          breakfastCount: count("breakfast"),
          lunchCount: count("lunch"),
          dinnerCount: count("dinner"),
          awayCount: tenants.filter(
            (t) => !t.breakfast && !t.lunch && !t.dinner,
          ).length,
          skippedList: tenants
            .filter((t) => !t.breakfast || !t.lunch || !t.dinner)
            .map((t) => ({
              id: t.id,
              name: t.name,
              roomNumber: t.roomNumber,
              bedLabel: t.bedLabel,
              skippedMeals: (
                [
                  !t.breakfast && ("Breakfast" as const),
                  !t.lunch && ("Lunch" as const),
                  !t.dinner && ("Dinner" as const),
                ].filter(Boolean) as ("Breakfast" | "Lunch" | "Dinner")[]
              ),
            })),
        };
      });
    });
    setBannerDismissed(false);
    setSavingId(`${tenantId}-${meal}`);
    try {
      const result = await setMealAttendance(
        tenantId,
        dateKey,
        meal,
        !currentlyEating,
      );
      if (!result.success) {
        setError(result.error);
        setForecast(await getUpcomingMealForecast());
      }
    } finally {
      setSavingId(null);
    }
  }

  const cards = active
    ? [
        { meal: MEALS[0], count: active.breakfastCount },
        { meal: MEALS[1], count: active.lunchCount },
        { meal: MEALS[2], count: active.dinnerCount },
      ]
    : [];

  return (
    <section
      aria-label="Kitchen and mess headcount"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <span className="rounded-lg bg-orange-100 p-2 text-orange-700">
          <ChefHat size={18} />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Kitchen &amp; Mess Headcount
          </h2>
          <p className="text-xs text-slate-500">
            Live meal counts for the cook to prevent food wastage.
          </p>
        </div>
      </div>

      {/* 4-day tab strip */}
      <div
        role="tablist"
        aria-label="Select forecast day"
        className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {(forecast ?? []).map((day, i) => {
          const isActive = tabIndex === i;
          return (
            <button
              key={day.dateKey}
              role="tab"
              aria-selected={isActive}
              type="button"
              onClick={() => setTabIndex(i)}
              className={cn(
                "rounded-lg border px-3 py-2 text-center transition-colors",
                isActive
                  ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              <span className="block text-sm font-semibold">
                {TAB_NAMES[i] ?? `Day ${i + 1}`}
              </span>
              <span
                className={cn(
                  "mt-0.5 block text-xs tabular-nums",
                  isActive ? "text-slate-300" : "text-slate-400",
                )}
              >
                {tabDateLabel(day.dateKey)}
              </span>
            </button>
          );
        })}
        {loading &&
          [0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg border border-slate-200 px-3 py-2"
            >
              <div className="mx-auto h-4 w-16 rounded bg-slate-100" />
              <div className="mx-auto mt-1.5 h-3 w-20 rounded bg-slate-100" />
            </div>
          ))}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void handleRetry()}
            className="rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-medium hover:bg-red-100"
          >
            Retry
          </button>
        </p>
      )}

      {/* Advance-notice banner */}
      {showBanner && bannerDay && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3"
        >
          <span className="rounded-lg bg-amber-100 p-1.5 text-amber-700">
            <CalendarClock size={16} />
          </span>
          <p className="flex-1 text-sm leading-relaxed text-amber-900">
            <span className="font-semibold">
              Festival / long weekend advance notice:
            </span>{" "}
            {bannerDay.awayCount} of {bannerDay.totalTenants} tenants will be
            away on hometown leave on {bannerDateLabel(bannerDay.dateKey)}.
            Reduce kitchen rations accordingly!
          </p>
          <button
            type="button"
            onClick={() => setBannerDismissed(true)}
            aria-label="Dismiss notice"
            className="rounded-md p-1 text-amber-500 transition-colors hover:bg-amber-100 hover:text-amber-800"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Stat cards */}
      {loading || !active ? (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-slate-200 p-4"
            >
              <div className="h-4 w-24 rounded bg-slate-100" />
              <div className="mt-2 h-8 w-32 rounded bg-slate-100" />
              <div className="mt-2 h-2 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {cards.map(({ meal, count }) => {
            const Icon = meal.icon;
            const pct =
              active.totalTenants === 0
                ? 0
                : Math.round((count / active.totalTenants) * 100);
            return (
              <div
                key={meal.key}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-slate-100 p-1.5 text-slate-600">
                    <Icon size={16} />
                  </span>
                  <p className="text-sm font-medium text-slate-500">
                    {meal.label}
                  </p>
                </div>
                <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-slate-900">
                  {count}
                  <span className="text-base font-medium text-slate-400">
                    {" "}
                    / {active.totalTenants} eating
                  </span>
                </p>
                <div
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${meal.label} eaters`}
                  className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
                >
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Skipping list for the selected day */}
      {active && (
        <div className="mt-4 rounded-lg border border-slate-200">
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((e) => !e)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <span className="text-sm font-medium text-slate-900">
              View who is skipping
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600">
                {active.skippedList.length}
              </span>
            </span>
            <ChevronDown
              size={16}
              className={cn(
                "text-slate-400 transition-transform",
                expanded && "rotate-180",
              )}
            />
          </button>

          {expanded && (
            <div className="border-t border-slate-200 px-4 py-3">
              <p className="mb-3 text-xs text-slate-500">
                Tap a meal to toggle whether the tenant eats it on{" "}
                {tabDateLabel(active.dateKey)} — e.g. when they phone in to
                skip.
              </p>
              {active.tenants.length === 0 ? (
                <p className="py-2 text-center text-sm text-slate-500">
                  No active tenants.
                </p>
              ) : (
                <ul className="max-h-72 space-y-1 overflow-y-auto">
                  {active.tenants.map((t) => (
                    <li
                      key={t.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-slate-900">
                          {t.name}
                        </span>
                        <span className="block text-xs tabular-nums text-slate-500">
                          Room {t.roomNumber} • {t.bedLabel}
                        </span>
                      </span>
                      <span className="flex gap-1.5">
                        {MEALS.map((m) => {
                          const eating = t[m.key];
                          const busy = savingId === `${t.id}-${m.key}`;
                          return (
                            <button
                              key={m.key}
                              type="button"
                              disabled={busy}
                              title={`${t.name} — ${m.label}: ${eating ? "eating" : "skipping"}. Click to toggle.`}
                              aria-pressed={eating}
                              onClick={() =>
                                void handleToggle(t.id, m.key, eating)
                              }
                              className={cn(
                                "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:cursor-wait disabled:opacity-60",
                                eating
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                  : "border-slate-200 bg-slate-100 text-slate-400 line-through hover:bg-slate-200",
                              )}
                            >
                              {m.label[0]}
                            </button>
                          );
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
