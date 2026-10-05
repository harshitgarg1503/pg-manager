"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import RoomOccupancyMatrix, {
  type Room,
} from "@/components/rooms/RoomOccupancyMatrix";
import { useTenantOnboarding } from "@/components/tenants/TenantOnboardingProvider";
import { createRoom } from "@/actions/roomActions";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20";

interface RoomsViewProps {
  rooms: Room[];
  properties: { id: string; name: string }[];
  organizationName: string;
}

export default function RoomsView({
  rooms,
  properties,
  organizationName,
}: RoomsViewProps) {
  const { openOnboarding } = useTenantOnboarding();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleBookBed = (bedId: string, roomId: string) => {
    // Smart shortcut: open the same onboarding modal with Room + Bed preselected.
    openOnboarding({ roomId, bedId });
  };

  async function handleAddRoom(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createRoom({
        propertyId: String(formData.get("propertyId") ?? ""),
        roomNumber: String(formData.get("roomNumber") ?? ""),
        floor: Number(formData.get("floor") ?? 0),
        baseRent: String(formData.get("baseRent") ?? ""),
        airConditioned: formData.get("airConditioned") === "on",
        bedCount: String(formData.get("bedCount") ?? "2"),
      });
      if (!result.success) {
        setError(result.error);
      } else {
        // createRoom() revalidates /rooms, so the matrix refreshes with
        // the new room. Reset the form fields.
        (document.getElementById("add-room-form") as HTMLFormElement)?.reset();
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Rooms &amp; Beds</h1>
        <p className="mt-1 text-sm text-slate-500">
          {organizationName} — floor-wise occupancy, click a vacant bed to book
          it.
        </p>
      </div>

      {rooms.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm font-medium text-slate-900">
            No rooms yet for {organizationName}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Add your first room below — it will appear here instantly.
          </p>
        </div>
      ) : (
        <RoomOccupancyMatrix rooms={rooms} onBookBed={handleBookBed} />
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Add a room</h2>
        <p className="mt-1 text-sm text-slate-500">
          Rooms are always created under your organization — no manual org
          selection needed.
        </p>

        <form
          id="add-room-form"
          action={handleAddRoom}
          className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <div>
            <label
              htmlFor="propertyId"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Property
            </label>
            <select
              id="propertyId"
              name="propertyId"
              required
              className={inputClass}
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="roomNumber"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Room number
            </label>
            <input
              id="roomNumber"
              name="roomNumber"
              type="text"
              required
              placeholder="101"
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="floor"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Floor
            </label>
            <input
              id="floor"
              name="floor"
              type="number"
              defaultValue={0}
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="baseRent"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Base rent (₹)
            </label>
            <input
              id="baseRent"
              name="baseRent"
              type="number"
              min={0}
              step="0.01"
              required
              placeholder="8000"
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="bedCount"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Beds
            </label>
            <input
              id="bedCount"
              name="bedCount"
              type="number"
              min={1}
              max={8}
              defaultValue={2}
              required
              title="Number of beds (Bed A, B, C…) — created vacant"
              className={inputClass}
            />
          </div>

          <div className="flex items-end gap-3">
            <label
              htmlFor="airConditioned"
              className="flex flex-1 items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
            >
              <input
                id="airConditioned"
                name="airConditioned"
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
              />
              AC
            </label>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Adding…" : "Add"}
            </button>
          </div>
        </form>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}{" "}
            {error.includes("Insufficient wallet balance") && (
              <Link
                href="/wallet"
                className="font-medium underline underline-offset-2 hover:text-red-800"
              >
                Recharge now
              </Link>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
