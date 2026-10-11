"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BedDouble,
  Check,
  ChevronLeft,
  ChevronRight,
  CloudUpload,
  FileText,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createTenant } from "@/actions/tenantActions";
import { getRoomOptions } from "@/actions/roomActions";

/* ---------------------------------- Types --------------------------------- */

export interface RoomBedOption {
  id: string;
  label: string;
  status: "vacant" | "occupied";
}

export interface RoomOption {
  id: string;
  number: string;
  floor: number;
  type: string;
  defaultRent: number;
  beds: RoomBedOption[];
}

export interface TenantOnboardingData {
  fullName: string;
  phone: string;
  email: string;
  emergencyContact: string;
  roomId: string;
  /** One or more vacant beds in the selected room. */
  bedIds: string[];
  monthlyRent: string;
  securityDeposit: string;
  idType: string;
  idFile: File | null;
}

interface TenantOnboardingDrawerProps {
  /** Preferred controlled prop (Session 5 contract). */
  isOpen?: boolean;
  /** Legacy alias for `isOpen` — both are supported. */
  open?: boolean;
  onClose: () => void;
  onComplete?: (data: TenantOnboardingData) => void;
  rooms?: RoomOption[];
  /** Pre-select this room when the drawer mounts/opens (smart shortcut). */
  initialRoomId?: string;
  /** Pre-select this bed when the drawer mounts/opens (smart shortcut). */
  initialBedId?: string;
}

/* -------------------------------- Mock data ------------------------------- */

const DEFAULT_ROOMS: RoomOption[] = [
  {
    id: "room-101",
    number: "101",
    floor: 1,
    type: "Non-AC · Triple",
    defaultRent: 6500,
    beds: [
      { id: "bed-101-a", label: "Bed A", status: "occupied" },
      { id: "bed-101-b", label: "Bed B", status: "occupied" },
      { id: "bed-101-c", label: "Bed C", status: "vacant" },
    ],
  },
  {
    id: "room-102",
    number: "102",
    floor: 1,
    type: "AC · Double",
    defaultRent: 9500,
    beds: [
      { id: "bed-102-a", label: "Bed A", status: "occupied" },
      { id: "bed-102-b", label: "Bed B", status: "vacant" },
    ],
  },
  {
    id: "room-204",
    number: "204",
    floor: 2,
    type: "AC · Triple",
    defaultRent: 8000,
    beds: [
      { id: "bed-204-a", label: "Bed A", status: "occupied" },
      { id: "bed-204-b", label: "Bed B", status: "occupied" },
      { id: "bed-204-c", label: "Bed C", status: "vacant" },
    ],
  },
  {
    id: "room-301",
    number: "301",
    floor: 3,
    type: "Non-AC · Double",
    defaultRent: 7000,
    beds: [
      { id: "bed-301-a", label: "Bed A", status: "vacant" },
      { id: "bed-301-b", label: "Bed B", status: "vacant" },
    ],
  },
];

const ID_TYPES = ["Aadhaar Card", "PAN Card", "Passport", "Driving Licence", "Voter ID"];

const STEPS = [
  { title: "Personal Details", subtitle: "Basic info", icon: User },
  { title: "Room & Allocation", subtitle: "Bed & rent", icon: BedDouble },
  { title: "KYC Upload", subtitle: "ID proof", icon: ShieldCheck },
] as const;

/* --------------------------------- Styles --------------------------------- */

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-shadow";

const labelClass = "mb-1.5 block text-[13px] font-medium text-slate-700";

const errorClass = "mt-1 text-xs text-red-600";

const INITIAL_DATA: TenantOnboardingData = {
  fullName: "",
  phone: "",
  email: "",
  emergencyContact: "",
  roomId: "",
  bedIds: [],
  monthlyRent: "",
  securityDeposit: "",
  idType: "Aadhaar Card",
  idFile: null,
};

/**
 * Build the initial form state, applying the smart-shortcut pre-selection.
 * If only a bed id is given, the owning room is resolved automatically and
 * rent/deposit default from that room.
 */
function buildInitialData(
  rooms: RoomOption[],
  initialRoomId?: string,
  initialBedId?: string
): TenantOnboardingData {
  if (!initialRoomId && !initialBedId) return INITIAL_DATA;
  let room = initialRoomId
    ? rooms.find((r) => r.id === initialRoomId)
    : undefined;
  if (!room && initialBedId) {
    room = rooms.find((r) => r.beds.some((b) => b.id === initialBedId));
  }
  if (!room) return INITIAL_DATA;
  const preselected =
    initialBedId &&
    room.beds.some((b) => b.id === initialBedId && b.status === "vacant")
      ? [initialBedId]
      : [];
  return {
    ...INITIAL_DATA,
    roomId: room.id,
    bedIds: preselected,
    monthlyRent: String(room.defaultRent),
    securityDeposit: String(room.defaultRent),
  };
}

/* -------------------------------- Component ------------------------------- */

export default function TenantOnboardingDrawer({
  isOpen,
  open,
  onClose,
  onComplete,
  rooms = DEFAULT_ROOMS,
  initialRoomId,
  initialBedId,
}: TenantOnboardingDrawerProps) {
  const visible = isOpen ?? open ?? false;
  const [step, setStep] = useState(0);
  // Real room/bed options for the signed-in owner's org. Fetched every time
  // the drawer opens so vacancy is fresh — the `rooms` prop is only a
  // fallback (used by the demo wrapper) until the fetch resolves.
  const [serverRooms, setServerRooms] = useState<RoomOption[] | null>(null);
  const roomsData = serverRooms ?? rooms;
  // NOTE: the provider remounts this drawer (via `key`) on every open, so the
  // pre-selection is applied once here instead of syncing via effects.
  const [form, setForm] = useState<TenantOnboardingData>(() =>
    buildInitialData(rooms, initialRoomId, initialBedId)
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dragActive, setDragActive] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(false);
  // True once the owner types a custom rent (e.g. a discount) — auto-total
  // from the bed count must not clobber it afterwards.
  const [rentEdited, setRentEdited] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedRoom = roomsData.find((r) => r.id === form.roomId);
  const vacantBeds = selectedRoom?.beds.filter((b) => b.status === "vacant") ?? [];
  const loadingRooms = serverRooms === null;

  // Load the org's real rooms each time the drawer opens. A room booked
  // seconds ago must already show as occupied here.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void getRoomOptions()
      .then((opts) => {
        if (!cancelled) setServerRooms(opts);
      })
      .catch(() => {
        if (!cancelled) setServerRooms(rooms);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // The real options arrive after mount, so a "+ Vacant" shortcut
  // (initialRoomId/initialBedId) is applied here once they load — but only
  // when the user hasn't already picked a room/bed themselves. This runs
  // during render (not in an effect): serverRooms identity only changes when
  // a fresh fetch resolves. The drawer remounts on every open, so the guard
  // state starts clean each time.
  const [shortcutAppliedFor, setShortcutAppliedFor] =
    useState<RoomOption[] | null>(null);
  if (serverRooms !== null && serverRooms !== shortcutAppliedFor) {
    setShortcutAppliedFor(serverRooms);
    if (
      (initialRoomId || initialBedId) &&
      !form.roomId &&
      form.bedIds.length === 0
    ) {
      setForm(buildInitialData(serverRooms, initialRoomId, initialBedId));
    }
  }

  /* Lock body scroll + close on Escape while open */
  const handleClose = useCallback(() => {
    onClose();
    // Clear the success screen after the exit transition finishes
    window.setTimeout(() => setCompleted(false), 300);
  }, [onClose]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [visible, handleClose]);

  const set = useCallback(
    <K extends keyof TenantOnboardingData>(key: K, value: TenantOnboardingData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => {
        if (!prev[key as string]) return prev;
        const next = { ...prev };
        delete next[key as string];
        return next;
      });
    },
    []
  );

  const handleRoomChange = (roomId: string) => {
    const room = roomsData.find((r) => r.id === roomId);
    setRentEdited(false);
    setForm((prev) => ({
      ...prev,
      roomId,
      bedIds: [],
      monthlyRent: room ? String(room.defaultRent) : prev.monthlyRent,
      securityDeposit: room ? String(room.defaultRent) : prev.securityDeposit,
    }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.roomId;
      delete next.bedIds;
      return next;
    });
  };

  const toggleBed = (bedId: string) => {
    const room = roomsData.find((r) => r.id === form.roomId);
    const nextIds = form.bedIds.includes(bedId)
      ? form.bedIds.filter((id) => id !== bedId)
      : [...form.bedIds, bedId];
    setForm((prev) => ({
      ...prev,
      bedIds: nextIds,
      // Auto-total: per-bed room rent × selected beds, unless the owner
      // already typed a custom (discounted) figure.
      monthlyRent:
        !rentEdited && room
          ? String(room.defaultRent * nextIds.length)
          : prev.monthlyRent,
    }));
    setErrors((prev) => {
      if (!prev.bedIds) return prev;
      const next = { ...prev };
      delete next.bedIds;
      return next;
    });
  };

  const validateStep = (s: number): boolean => {
    const next: Record<string, string> = {};
    if (s === 0) {
      if (form.fullName.trim().length < 2) next.fullName = "Enter the tenant's full name.";
      const digits = form.phone.replace(/\D/g, "");
      if (digits.length < 8) next.phone = "Enter a valid phone number.";
      if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
        next.email = "Enter a valid email address.";
      if (form.emergencyContact) {
        const ed = form.emergencyContact.replace(/\D/g, "");
        if (ed.length < 8) next.emergencyContact = "Enter a valid contact number.";
      }
    }
    if (s === 1) {
      if (!form.roomId) next.roomId = "Select a room.";
      if (form.bedIds.length === 0)
        next.bedIds = "Select at least one vacant bed — a tenant may hold several.";
      if (!form.monthlyRent || Number(form.monthlyRent) <= 0)
        next.monthlyRent = "Enter monthly rent.";
      if (form.securityDeposit === "" || Number(form.securityDeposit) < 0)
        next.securityDeposit = "Enter security deposit.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!form.idType) {
      setErrors({ idType: "Select an ID type." });
      return;
    }
    setLoading(true);
    try {
      const result = await createTenant({
        fullName: form.fullName,
        phone: form.phone,
        email: form.email || undefined,
        bedIds: form.bedIds,
        monthlyRent: form.monthlyRent || undefined,
        emergencyContact: form.emergencyContact || undefined,
      });
      if (result.success) {
        onComplete?.(form);
        handleFinishAndReset();
        alert("Tenant successfully added!");
      } else {
        alert(`Failed to add tenant: ${result.error}`);
      }
    } catch (err) {
      alert(
        `Failed to add tenant: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (loading) return;
    if (step < 2) {
      if (!validateStep(step)) return;
      setStep((s) => s + 1);
      return;
    }
    void handleSubmit();
  };

  const handleBack = () => {
    if (step === 0) {
      handleClose();
      return;
    }
    setStep((s) => s - 1);
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    set("idFile", file);
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFinishAndReset = () => {
    setForm(INITIAL_DATA);
    setErrors({});
    setStep(0);
    setRentEdited(false);
    setCompleted(false);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-hidden={!visible}
      aria-label="Tenant onboarding"
      className={cn("fixed inset-0 z-50", !visible && "pointer-events-none")}
    >
      {/* Overlay — fades in/out */}
      <div
        aria-hidden
        onClick={handleClose}
        className={cn(
          "absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity duration-300",
          visible ? "opacity-100" : "opacity-0"
        )}
      />

      {/* Drawer panel — slides from the right */}
      <div className="absolute inset-y-0 right-0 flex w-full max-w-lg">
        <div
          className={cn(
            "flex w-full flex-col overflow-hidden bg-white shadow-2xl transition-all duration-300 ease-out sm:m-3 sm:rounded-2xl sm:border sm:border-slate-200",
            visible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-slate-900">
                Onboard Tenant
              </h2>
              <p className="mt-0.5 text-[13px] text-slate-500">
                Step {step + 1} of 3 — {STEPS[step].title}
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close onboarding"
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <X size={20} />
            </button>
          </div>

          {/* Step indicator */}
          <ol className="flex items-center gap-1 border-b border-slate-100 bg-slate-50/60 px-5 py-4 sm:px-6">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isDone = i < step || completed;
              const isActive = i === step && !completed;
              return (
                <li key={s.title} className="flex min-w-0 flex-1 items-center last:flex-none">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      aria-hidden
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-all duration-300",
                        isDone
                          ? "border-slate-900 bg-slate-900 text-white"
                          : isActive
                            ? "border-slate-900 bg-white text-slate-900 ring-2 ring-slate-900/15"
                            : "border-slate-200 bg-white text-slate-400"
                      )}
                    >
                      {isDone ? <Check size={16} /> : <Icon size={16} />}
                    </span>
                    <span className="hidden min-w-0 sm:block">
                      <span
                        className={cn(
                          "block truncate text-[13px] font-semibold leading-tight",
                          isActive || isDone ? "text-slate-900" : "text-slate-400"
                        )}
                      >
                        {i + 1}. {s.title}
                      </span>
                      <span className="block text-xs text-slate-400">{s.subtitle}</span>
                    </span>
                    {/* Compact label on mobile */}
                    <span
                      className={cn(
                        "text-xs font-semibold sm:hidden",
                        isActive ? "text-slate-900" : "text-slate-400"
                      )}
                    >
                      {i + 1}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <span
                      aria-hidden
                      className={cn(
                        "mx-2 h-px min-w-4 flex-1 transition-colors duration-300 sm:mx-3",
                        i < step || completed ? "bg-slate-900" : "bg-slate-200"
                      )}
                    />
                  )}
                </li>
              );
            })}
          </ol>

          {/* Body */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            {completed ? (
              <div
                key="success"
                className="animate-drawer-step flex h-full flex-col items-center justify-center py-10 text-center"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <Check size={26} />
                </span>
                <h3 className="mt-4 text-base font-semibold text-slate-900">
                  Tenant onboarded
                </h3>
                <p className="mt-1 max-w-xs text-sm text-slate-500">
                  {form.fullName || "Tenant"}
                  {selectedRoom ? ` · Room ${selectedRoom.number}` : ""} has been
                  added successfully.
                </p>
                <button
                  type="button"
                  onClick={handleFinishAndReset}
                  className="mt-6 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                >
                  Done
                </button>
              </div>
            ) : (
              <div key={step} className="animate-drawer-step">
                {/* STEP 1 — Personal Details */}
                {step === 0 && (
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="ob-fullName" className={labelClass}>
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="ob-fullName"
                        type="text"
                        autoComplete="name"
                        placeholder="e.g. Rahul Sharma"
                        value={form.fullName}
                        onChange={(e) => set("fullName", e.target.value)}
                        className={inputClass}
                      />
                      {errors.fullName && <p className={errorClass}>{errors.fullName}</p>}
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="ob-phone" className={labelClass}>
                          Phone Number <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="ob-phone"
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          placeholder="98765 43210"
                          value={form.phone}
                          onChange={(e) => set("phone", e.target.value)}
                          className={inputClass}
                        />
                        {errors.phone && <p className={errorClass}>{errors.phone}</p>}
                      </div>
                      <div>
                        <label htmlFor="ob-email" className={labelClass}>
                          Email
                        </label>
                        <input
                          id="ob-email"
                          type="email"
                          autoComplete="email"
                          placeholder="rahul@example.com"
                          value={form.email}
                          onChange={(e) => set("email", e.target.value)}
                          className={inputClass}
                        />
                        {errors.email && <p className={errorClass}>{errors.email}</p>}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="ob-emergency" className={labelClass}>
                        Emergency Contact
                      </label>
                      <input
                        id="ob-emergency"
                        type="tel"
                        inputMode="tel"
                        placeholder="Guardian / parent number"
                        value={form.emergencyContact}
                        onChange={(e) => set("emergencyContact", e.target.value)}
                        className={inputClass}
                      />
                      {errors.emergencyContact && (
                        <p className={errorClass}>{errors.emergencyContact}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* STEP 2 — Room & Allocation */}
                {step === 1 && (
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="ob-room" className={labelClass}>
                        Room <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="ob-room"
                        value={form.roomId}
                        onChange={(e) => handleRoomChange(e.target.value)}
                        disabled={loadingRooms}
                        className={cn(inputClass, !form.roomId && "text-slate-400")}
                      >
                        <option value="" disabled>
                          {loadingRooms ? "Loading rooms…" : "Select a room"}
                        </option>
                        {roomsData.map((room) => {
                          const vacant = room.beds.filter(
                            (b) => b.status === "vacant"
                          ).length;
                          return (
                            <option key={room.id} value={room.id} className="text-slate-900">
                              Room {room.number} · {room.type} · {vacant} vacant
                            </option>
                          );
                        })}
                      </select>
                      {errors.roomId && <p className={errorClass}>{errors.roomId}</p>}
                    </div>

                    <div>
                      <span className={labelClass} id="ob-bed-label">
                        Select Beds <span className="text-red-500">*</span>
                        <span className="ml-1 font-normal text-slate-400">
                          ({form.bedIds.length} selected — tap for more)
                        </span>
                      </span>
                      {!form.roomId ? (
                        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center text-[13px] text-slate-500">
                          Select a room first to see vacant beds.
                        </p>
                      ) : vacantBeds.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center text-[13px] text-slate-500">
                          No vacant beds in this room. Try another room.
                        </p>
                      ) : (
                        <div
                          role="group"
                          aria-labelledby="ob-bed-label"
                          className="grid grid-cols-2 gap-2 sm:grid-cols-3"
                        >
                          {selectedRoom?.beds.map((bed) => {
                            const isVacant = bed.status === "vacant";
                            const isSelected = form.bedIds.includes(bed.id);
                            return (
                              <button
                                key={bed.id}
                                type="button"
                                role="checkbox"
                                aria-checked={isSelected}
                                disabled={!isVacant}
                                onClick={() => toggleBed(bed.id)}
                                className={cn(
                                  "rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-all",
                                  !isVacant &&
                                    "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300 line-through",
                                  isVacant &&
                                    !isSelected &&
                                    "border-dashed border-emerald-300 bg-emerald-50/60 text-emerald-800 hover:border-emerald-400 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-slate-900",
                                  isSelected &&
                                    "border-slate-900 bg-slate-900 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                                )}
                              >
                                {bed.label}
                                <span
                                  className={cn(
                                    "block text-xs font-normal",
                                    isSelected
                                      ? "text-slate-300"
                                      : isVacant
                                        ? "text-emerald-600"
                                        : "text-slate-300"
                                  )}
                                >
                                  {isVacant ? "Vacant" : "Occupied"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {errors.bedIds && <p className={errorClass}>{errors.bedIds}</p>}
                      {form.bedIds.length > 0 && (
                        <p className="mt-2 text-[13px] font-medium tabular-nums text-slate-700">
                          Acquiring: {form.bedIds.length} Bed
                          {form.bedIds.length === 1 ? "" : "s"}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="ob-rent" className={labelClass}>
                          Monthly Rent (₹) <span className="text-red-500">*</span>
                          <span className="ml-1 font-normal text-slate-400">
                            auto-totaled, editable
                          </span>
                        </label>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                            ₹
                          </span>
                          <input
                            id="ob-rent"
                            type="number"
                            min={0}
                            placeholder="8000"
                            value={form.monthlyRent}
                            onChange={(e) => {
                              set("monthlyRent", e.target.value);
                              setRentEdited(true);
                            }}
                            className={cn(inputClass, "pl-8")}
                          />
                        </div>
                        {errors.monthlyRent && (
                          <p className={errorClass}>{errors.monthlyRent}</p>
                        )}
                      </div>
                      <div>
                        <label htmlFor="ob-deposit" className={labelClass}>
                          Security Deposit (₹) <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                            ₹
                          </span>
                          <input
                            id="ob-deposit"
                            type="number"
                            min={0}
                            placeholder="8000"
                            value={form.securityDeposit}
                            onChange={(e) => set("securityDeposit", e.target.value)}
                            className={cn(inputClass, "pl-8")}
                          />
                        </div>
                        {errors.securityDeposit && (
                          <p className={errorClass}>{errors.securityDeposit}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 3 — KYC Upload */}
                {step === 2 && (
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="ob-idType" className={labelClass}>
                        Photo ID Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="ob-idType"
                        value={form.idType}
                        onChange={(e) => set("idType", e.target.value)}
                        className={inputClass}
                      >
                        {ID_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span className={labelClass} id="ob-file-label">
                        {form.idType} Photo
                      </span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,.pdf"
                        className="sr-only"
                        aria-labelledby="ob-file-label"
                        onChange={(e) => handleFile(e.target.files?.[0])}
                      />
                      {!form.idFile ? (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDragActive(true);
                          }}
                          onDragLeave={() => setDragActive(false)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDragActive(false);
                            handleFile(e.dataTransfer.files?.[0]);
                          }}
                          className={cn(
                            "flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-all focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2",
                            dragActive
                              ? "border-slate-900 bg-slate-50"
                              : "border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50"
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-12 w-12 items-center justify-center rounded-full transition-colors",
                              dragActive
                                ? "bg-slate-900 text-white"
                                : "bg-white text-slate-500 shadow-sm ring-1 ring-slate-200"
                            )}
                          >
                            <CloudUpload size={22} />
                          </span>
                          <span className="mt-3 text-sm font-medium text-slate-900">
                            {dragActive
                              ? "Drop your ID here"
                              : "Drag & drop your ID here, or browse"}
                          </span>
                          <span className="mt-1 text-xs text-slate-500">
                            PNG, JPG or PDF up to 5 MB
                          </span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
                            <FileText size={18} />
                          </span>
                          <span className="min-w-0 flex-1 text-left">
                            <span className="block truncate text-sm font-medium text-slate-900">
                              {form.idFile.name}
                            </span>
                            <span className="block text-xs tabular-nums text-slate-500">
                              {formatBytes(form.idFile.size)} · {form.idType}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => set("idFile", null)}
                            aria-label="Remove uploaded file"
                            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-600"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      )}
                      <p className="mt-2 text-xs leading-relaxed text-slate-400">
                        Upload a clear photo of the {form.idType}. Masked Aadhaar is
                        accepted.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer navigation */}
          {!completed && (
            <div className="border-t border-slate-100 bg-white px-5 py-4 sm:px-6">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleBack}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                    step === 0
                      ? "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                      : "border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <ChevronLeft size={16} />
                  Back
                </button>

                <div className="flex items-center gap-2">
                  <span className="mr-1 hidden text-xs tabular-nums text-slate-400 sm:block">
                    {step + 1} / 3
                  </span>
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {step === 2 ? (
                      loading ? (
                        <>Saving...</>
                      ) : (
                        <>
                          <Check size={16} />
                          Complete Onboarding
                        </>
                      )
                    ) : (
                      <>
                        Next
                        <ChevronRight size={16} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Step content entrance animation */}
      <style>{`@keyframes drawer-step-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } } .animate-drawer-step { animation: drawer-step-in 0.25s ease-out; }`}</style>
    </div>
  );
}

/* ------------------------------ Demo wrapper ------------------------------ */

export function TenantOnboardingDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
      >
        <User size={16} />
        Onboard Tenant
      </button>
      <TenantOnboardingDrawer
        open={open}
        onClose={() => setOpen(false)}
        onComplete={(data) => console.log("Tenant onboarded:", data)}
      />
    </>
  );
}
