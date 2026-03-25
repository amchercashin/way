import { createContext, useContext, useState, type ReactNode } from 'react';

interface OnboardingContextValue {
  /** Whether onboarding tour is currently active */
  active: boolean;
  setActive: (v: boolean) => void;
  /** Drawer state controlled by onboarding tour */
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <OnboardingContext.Provider value={{ active, setActive, drawerOpen, setDrawerOpen }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}
