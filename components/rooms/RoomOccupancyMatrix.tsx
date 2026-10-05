"use client";

import { useMemo, useState } from "react";
import { BedDouble, BedSingle, Users } from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------------------------------- Types --------------------------------- */

export type RoomType = "AC" | "Non-AC";

export interface TenantInfo {
  firstName: string;
  phone: string;
}

export interface Bed {
  id: string;
  label: string;
  status: "vacant" | "occupied";
  tenant?: TenantInfo;
}

export interface Room {
  id: string;
  number: string;
  floor: number;
  type: RoomType;
  beds: Bed[];
}

export type FloorFilter = "All" | number;

interface RoomOccupancyMatrixProps {
  rooms?: Room[];
  initialFloor?: FloorFilter;
  /** Fired when a vacant bed is clicked — receives the bed id and its room id. */
  onBookBed?: (bedId: string, roomId: string) => void;
}

/* -------------------------------- Mock data ------------------------------- */

export const MOCK_ROOMS: Room[] = [
  {
    id: "room-101",
    number: "101",
    floor: 1,
    type: "Non-AC",
    beds: [
      {
        id: "bed-101-a",
        label: "Bed A",
        status: "occupied",
        tenant: { firstName: "Rahul", phone: "98765 43210" },
      },
      {
        id: "bed-101-b",
        label: "Bed B",
        status: "occupied",
        tenant: { firstName: "Amit", phone: "98110 22334" },
      },
      { id: "bed-101-c", label: "Bed C", status: "vacant" },
    ],
  },
  {
    id: "room-102",
    number: "102",
    floor: 1,
    type: "AC",
    beds: [
      {
        id: "bed-102-a",
        label: "Bed A",
        status: "occupied",
        tenant: { firstName: "Priya", phone: "99870 11223" },
      },
      { id: "bed-102-b", label: "Bed B", status: "vacant" },
    ],
  },
  {
    id: "room-204",
    number: "204",
    floor: 2,
    type: "AC",
    beds: [
      {
        id: "bed-204-a",
        label: "Bed A",
        status: "occupied",
        tenant: { firstName: "Sneha", phone: "97420 55667" },
      },
      {
        id: "bed-204-b",
        label: "Bed B",
        status: "occupied",
        tenant: { firstName: "Karan", phone: "96200 88990" },
      },
      { id: "bed-204-c", label: "Bed C", status: "vacant" },
    ],
  },
  {
    id: "room-301",
    number: "301",
    floor: 3,
    type: "Non-AC",
    beds: [
      { id: "bed-301-a", label: "Bed A", status: "vacant" },
      { id: "bed-301-b", label: "Bed B", status: "vacant" },
    ],
  },
];

const FLOOR_TABS: FloorFilter[] = ["All", 1, 2, 3];

/* -------------------------------- Component ------------------------------- */

export default function RoomOccupancyMatrix({
  rooms = MOCK_ROOMS,
  initialFloor = "All",
  onBookBed,
}: RoomOccupancyMatrixProps) {
  const [activeFloor, setActiveFloor] = useState<FloorFilter>(initialFloor);

  const filteredRooms = useMemo(() => {
    if (activeFloor === "All") return rooms;
    return rooms.filter((room) => room.floor === activeFloor);
  }, [rooms, activeFloor]);

  const stats = useMemo(() => {
    const allBeds = filteredRooms.flatMap((room) => room.beds);
    const total = allBeds.length;
    const occupied = allBeds.filter((bed) => bed.status === "occupied").length;
    const vacant = total - occupied;
    const occupiedPct = total === 0 ? 0 : Math.round((occupied / total) * 100);
    return { total, occupied, vacant, occupiedPct };
  }, [filteredRooms]);

  return (
    <div className="space-y-5">
      {/* Stats bar */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="rounded-lg bg-slate-900 p-2 text-white">
            <BedDouble size={18} />
          </span>
          <div>
            <p className="text-xs font-medium text-slate-500">Total Beds</p>
            <p className="text-xl font-semibold tracking-tight text-slate-900">
              {stats.total}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="rounded-lg bg-slate-100 p-2 text-slate-700">
            <Users size={18} />
          </span>
          <div>
            <p className="text-xs font-medium text-slate-500">Occupied</p>
            <p className="text-xl font-semibold tracking-tight text-slate-900">
              {stats.occupied}{" "}
              <span className="text-sm font-medium text-slate-500">
                ({stats.occupiedPct}%)
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
            <BedSingle size={18} />
          </span>
          <div>
            <p className="text-xs font-medium text-slate-500">Vacant</p>
            <p className="text-xl font-semibold tracking-tight text-slate-900">
              {stats.vacant}
            </p>
          </div>
        </div>
      </div>

      {/* Floor filter tabs */}
      <div
        role="tablist"
        aria-label="Filter rooms by floor"
        className="flex flex-wrap gap-2"
      >
        {FLOOR_TABS.map((floor) => {
          const isActive = activeFloor === floor;
          return (
            <button
              key={String(floor)}
              role="tab"
              aria-selected={isActive}
              type="button"
              onClick={() => setActiveFloor(floor)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-slate-900 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              {floor === "All" ? "All" : `Floor ${floor}`}
            </button>
          );
        })}
      </div>

      {/* Room grid */}
      {filteredRooms.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No rooms found on this floor.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredRooms.map((room) => {
            const occupiedCount = room.beds.filter(
              (b) => b.status === "occupied"
            ).length;
            return (
              <section
                key={room.id}
                aria-label={`Room ${room.number}`}
                className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm"
              >
                {/* Card header */}
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Room {room.number}
                  </h3>
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                      room.type === "AC"
                        ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 bg-slate-50 text-slate-500"
                    )}
                  >
                    {room.type}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Floor {room.floor} · {occupiedCount}/{room.beds.length}{" "}
                  occupied
                </p>

                {/* Bed chips */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {room.beds.map((bed) =>
                    bed.status === "vacant" ? (
                      <button
                        key={bed.id}
                        type="button"
                        onClick={() => onBookBed?.(bed.id, room.id)}
                        title={`Book ${bed.label} in Room ${room.number}`}
                        className="flex flex-col items-start gap-0.5 rounded-lg border border-dashed border-emerald-300 bg-emerald-50 px-3 py-2 text-left text-emerald-700 transition-colors hover:border-emerald-400 hover:bg-emerald-100/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                      >
                        <span className="text-xs font-medium text-emerald-600">
                          {bed.label}
                        </span>
                        <span className="text-sm font-semibold">+ Vacant</span>
                      </button>
                    ) : (
                      <div
                        key={bed.id}
                        title={`${bed.label} — ${bed.tenant?.firstName ?? "Occupied"}`}
                        className="flex flex-col items-start gap-0.5 rounded-lg bg-slate-100 px-3 py-2 text-slate-800"
                      >
                        <span className="text-xs font-medium text-slate-500">
                          {bed.label}
                        </span>
                        <span className="truncate text-sm font-semibold">
                          {bed.tenant?.firstName ?? "Occupied"}
                        </span>
                        {bed.tenant?.phone && (
                          <span className="truncate text-xs tabular-nums text-slate-500">
                            {bed.tenant.phone}
                          </span>
                        )}
                      </div>
                    )
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
