"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import TenantOnboardingDrawer from "./TenantOnboardingDrawer";

/* --------------------------------- Context -------------------------------- */

export interface OpenOnboardingOptions {
  roomId?: string;
  bedId?: string;
}

interface TenantOnboardingContextValue {
  isOnboardingOpen: boolean;
  preselectedRoomId?: string;
  preselectedBedId?: string;
  openOnboarding: (opts?: OpenOnboardingOptions) => void;
  closeOnboarding: () => void;
}

const TenantOnboardingContext =
  createContext<TenantOnboardingContextValue | null>(null);

export function useTenantOnboarding(): TenantOnboardingContextValue {
  const ctx = useContext(TenantOnboardingContext);
  if (!ctx) {
    throw new Error(
      "useTenantOnboarding must be used inside <TenantOnboardingProvider>."
    );
  }
  return ctx;
}

/* --------------------------------- Provider --------------------------------
 * Single source of truth for the onboarding modal. Mount once in the
 * dashboard layout — then the TopHeader "+ Add Tenant" button and any
 * "+ Vacant" bed card can call `openOnboarding()` on the same dialog.
 * The drawer remounts (via `key`) on every open so pre-selected room/bed
 * values are applied cleanly without effect-driven state syncing.
 * -------------------------------------------------------------------------- */

export function TenantOnboardingProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [preselectedRoomId, setPreselectedRoomId] = useState<string | undefined>();
  const [preselectedBedId, setPreselectedBedId] = useState<string | undefined>();
  // Bumped on every open so the drawer remounts with fresh pre-selection.
  const [session, setSession] = useState(0);
  const router = useRouter();

  const openOnboarding = useCallback((opts?: OpenOnboardingOptions) => {
    setPreselectedRoomId(opts?.roomId);
    setPreselectedBedId(opts?.bedId);
    setSession((s) => s + 1);
    setIsOnboardingOpen(true);
  }, []);

  const closeOnboarding = useCallback(() => {
    setIsOnboardingOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      isOnboardingOpen,
      preselectedRoomId,
      preselectedBedId,
      openOnboarding,
      closeOnboarding,
    }),
    [isOnboardingOpen, preselectedRoomId, preselectedBedId, openOnboarding, closeOnboarding]
  );

  return (
    <TenantOnboardingContext.Provider value={value}>
      {children}
      <TenantOnboardingDrawer
        key={`onboarding-${session}`}
        isOpen={isOnboardingOpen}
        onClose={closeOnboarding}
        initialRoomId={preselectedRoomId}
        initialBedId={preselectedBedId}
        onComplete={() => router.refresh()}
      />
    </TenantOnboardingContext.Provider>
  );
}
