"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { signUpOwner } from "@/actions/authActions";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20";

/** Mirrors the server slug rule: first word, lowercase alphanumerics. */
function previewSlug(pgName: string): string {
  const firstWord = pgName.trim().split(/\s+/)[0] ?? "";
  return firstWord.toLowerCase().replace(/[^a-z0-9]+/g, "") || "—";
}

const STEPS = ["Owner details", "Property details"] as const;

export default function SignUpPage() {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Step 1 — owner
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Step 2 — property
  const [pgName, setPgName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");

  const slugPreview = useMemo(() => previewSlug(pgName), [pgName]);

  function handleContinue() {
    setError(null);
    if (!ownerName.trim()) return setError("Your name is required.");
    if (!phone.trim()) return setError("Mobile number is required.");
    if (!email.trim()) return setError("Email is required.");
    if (password.length < 6)
      return setError("Password must be at least 6 characters.");
    setStep(1);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData();
    formData.set("ownerName", ownerName.trim());
    formData.set("phone", phone.trim());
    formData.set("email", email.trim());
    formData.set("password", password);
    formData.set("pgName", pgName.trim());
    formData.set("city", city.trim());
    formData.set("address", address.trim());
    startTransition(async () => {
      // On success signUpOwner() redirects (throws NEXT_REDIRECT),
      // so reaching here means it returned an error.
      const result = await signUpOwner(formData);
      if (result && !result.success) setError(result.error);
    });
  }

  return (
    <div className="w-full max-w-md">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          Create your PG account
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Set up your property in under a minute. Free to start.
        </p>

        {/* Progress indicator */}
        <ol className="mt-6 flex items-center gap-2" aria-label="Signup progress">
          {STEPS.map((label, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <li key={label} className="flex flex-1 items-center gap-2 last:flex-none">
                <span
                  aria-hidden
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                    done
                      ? "bg-slate-900 text-white"
                      : current
                        ? "border-2 border-slate-900 bg-white text-slate-900"
                        : "border border-slate-200 bg-slate-50 text-slate-400",
                  )}
                >
                  {done ? <Check size={14} /> : i + 1}
                </span>
                <span
                  className={cn(
                    "hidden text-[13px] font-medium sm:block",
                    current || done ? "text-slate-900" : "text-slate-400",
                  )}
                >
                  {label}
                </span>
                {i < STEPS.length - 1 && (
                  <span
                    aria-hidden
                    className={cn(
                      "mx-1 h-px min-w-4 flex-1",
                      done ? "bg-slate-900" : "bg-slate-200",
                    )}
                  />
                )}
              </li>
            );
          })}
        </ol>

        {step === 0 ? (
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleContinue();
            }}
          >
            <div>
              <label
                htmlFor="ownerName"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Owner Full Name
              </label>
              <input
                id="ownerName"
                type="text"
                autoComplete="name"
                placeholder="Aarav Sharma"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="phone"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Mobile Number
              </label>
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                placeholder="98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="owner@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="Min. 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/30"
            >
              Continue
              <ArrowRight size={16} />
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="pgName"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                PG / Brand Name
              </label>
              <input
                id="pgName"
                type="text"
                placeholder="Sunrise Coliving"
                value={pgName}
                onChange={(e) => setPgName(e.target.value)}
                className={inputClass}
              />
              <p className="mt-1.5 text-xs tabular-nums text-slate-500">
                Your login slug:{" "}
                <span className="font-medium text-slate-700">
                  {slugPreview}
                </span>
                .pgslug.com
              </p>
            </div>

            <div>
              <label
                htmlFor="city"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                City
              </label>
              <input
                id="city"
                type="text"
                autoComplete="address-level2"
                placeholder="Bengaluru"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="address"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Complete Property Address
              </label>
              <textarea
                id="address"
                rows={3}
                placeholder="12, MG Road, Near Metro Station, Bengaluru 560001"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={cn(inputClass, "resize-none")}
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

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep(0);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <ArrowLeft size={16} />
                Back
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Creating account…" : "Create PG Account"}
              </button>
            </div>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-slate-900 underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
