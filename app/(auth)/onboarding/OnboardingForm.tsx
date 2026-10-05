"use client";

import { useState, useTransition } from "react";
import { completeOnboarding } from "@/actions/authActions";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20";

export default function OnboardingForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await completeOnboarding(formData);
      // On success completeOnboarding() redirects (throws NEXT_REDIRECT),
      // so reaching here means it returned an error.
      if (result && !result.success) setError(result.error);
    });
  }

  return (
    <div className="w-full max-w-md">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          Set up your PG
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          You&apos;re signed in — one last step to create your property.
        </p>

        <form action={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="ownerName"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Your Name
            </label>
            <input
              id="ownerName"
              name="ownerName"
              type="text"
              autoComplete="name"
              required
              placeholder="Aarav Sharma"
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="pgName"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              PG / Property Name
            </label>
            <input
              id="pgName"
              name="pgName"
              type="text"
              required
              placeholder="Sunrise PG"
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="phone"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Phone Number
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              required
              placeholder="98765 43210"
              className={inputClass}
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Setting up…" : "Create PG Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
