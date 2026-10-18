/**
 * Lightweight pulse skeletons for the dashboard's streamed widgets.
 *
 * The dashboard page wraps each heavy widget in <Suspense> with one of these
 * fallbacks, so the shell (sidebar, header, layout) paints immediately while
 * data cards stream in as their queries resolve.
 */

function Bar({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded bg-slate-200 ${className ?? ""}`}
    />
  );
}

/** Top KPI cards: Occupancy, Tenants, Rent collected, Open tickets. */
export function StatCardsSkeleton() {
  return (
    <section
      aria-hidden
      aria-busy="true"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <Bar className="h-4 w-20" />
            <div className="h-8 w-8 animate-pulse rounded-lg bg-slate-200" />
          </div>
          <Bar className="mt-3 h-7 w-28" />
          <Bar className="mt-2 h-3 w-24" />
        </div>
      ))}
    </section>
  );
}

/** Financial cards: Collections, Expenses, Net profit. */
export function FinancialSummarySkeleton() {
  return (
    <section
      aria-hidden
      aria-busy="true"
      className="grid grid-cols-1 gap-4 sm:grid-cols-3"
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <Bar className="h-4 w-28" />
            <div className="h-9 w-9 animate-pulse rounded-lg bg-slate-200" />
          </div>
          <Bar className="mt-3 h-9 w-36" />
          <Bar className="mt-2 h-3 w-24" />
          <Bar className="mt-1.5 h-3 w-20" />
        </div>
      ))}
    </section>
  );
}

/** Upcoming availability panel with a few vacancy rows. */
export function AvailabilitySkeleton() {
  return (
    <section
      aria-hidden
      aria-busy="true"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 animate-pulse rounded-lg bg-slate-200" />
        <div className="flex-1">
          <Bar className="h-4 w-44" />
          <Bar className="mt-2 h-3 w-64 max-w-full" />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        {[0, 1, 2].map((i) => (
          <Bar key={i} className="h-8 w-32" />
        ))}
      </div>
      <div className="mt-4 space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5"
          >
            <div className="flex-1">
              <Bar className="h-4 w-40" />
              <Bar className="mt-1.5 h-3 w-24" />
            </div>
            <Bar className="ml-3 h-6 w-16" />
          </div>
        ))}
      </div>
    </section>
  );
}

/** Kitchen & mess headcount panel: tabs + three meal cards. */
export function KitchenHeadcountSkeleton() {
  return (
    <section
      aria-hidden
      aria-busy="true"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 animate-pulse rounded-lg bg-slate-200" />
        <div className="flex-1">
          <Bar className="h-4 w-48" />
          <Bar className="mt-2 h-3 w-60 max-w-full" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-lg border border-slate-200 px-3 py-2"
          >
            <Bar className="mx-auto h-4 w-16" />
            <Bar className="mx-auto mt-2 h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-slate-200 p-4">
            <Bar className="h-4 w-24" />
            <Bar className="mt-2 h-8 w-32" />
            <Bar className="mt-3 h-2 w-full" />
          </div>
        ))}
      </div>
    </section>
  );
}

/** Announcement feed rows. */
export function AnnouncementsSkeleton() {
  return (
    <section
      aria-hidden
      aria-busy="true"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <Bar className="h-4 w-40" />
      <div className="mt-4 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-lg border border-slate-100 p-3">
            <Bar className="h-4 w-1/2" />
            <Bar className="mt-2 h-3 w-5/6" />
          </div>
        ))}
      </div>
    </section>
  );
}

/** Generic full-dashboard fallback. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Bar className="h-6 w-32" />
        <Bar className="mt-2 h-4 w-56" />
      </div>
      <FinancialSummarySkeleton />
      <StatCardsSkeleton />
      <AvailabilitySkeleton />
    </div>
  );
}
