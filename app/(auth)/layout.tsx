export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-4 sm:px-6">
          <span className="text-sm font-semibold tracking-tight text-slate-900">
            PG Manager
          </span>
          <span className="ml-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-500">
            Owner Console
          </span>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        {children}
      </main>
    </div>
  );
}
