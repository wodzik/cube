import { Suspense, lazy, useState } from "react";
import { SmartCubeProvider } from "./hooks/useSmartCube";
import { useVersionCheck } from "./hooks/useVersionCheck";
import { useAlgorithmDataVersionCheck } from "./hooks/useAlgorithmDataVersionCheck";
import { useWakeLock } from "./hooks/useWakeLock";
import { useSharedSolve } from "./hooks/useSharedSolve";
import { UpdateNotice } from "./components/UpdateNotice";
import { AlgorithmDataUpdateNotice } from "./components/AlgorithmDataUpdateNotice";
import { AppLogo } from "./components/AppLogo";
import { ThemeToggle } from "./components/ThemeToggle";
import { LanguageToggle } from "./components/LanguageToggle";
import { useT } from "./i18n/useT";
import type { MessageKey } from "./i18n/i18n";

// Lazy-loaded per tab: Training/Attack pull in the (large) OLL/PLL/F2L JSON
// data via algorithmStore, which Solve never needs — code-splitting here
// keeps the default "land on Solve" bundle small.
const SolvePage = lazy(() => import("./pages/SolvePage"));
const TrainingPage = lazy(() => import("./pages/TrainingPage"));
const AttackPage = lazy(() => import("./pages/AttackPage"));
const CaseTrainerPage = lazy(() => import("./pages/CaseTrainerPage"));
const AcademyPage = lazy(() => import("./pages/AcademyPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const DebugPage = lazy(() => import("./pages/DebugPage"));
// The read-only preview a share link opens (#s=…) — loaded only when there is one.
const SharedSolveView = lazy(() => import("./components/SharedSolveView"));

type Tab = "solve" | "training" | "attack" | "trainer" | "academy" | "settings" | "debug";

const TABS: { id: Tab; label: MessageKey }[] = [
  { id: "solve", label: "nav.solve" },
  { id: "training", label: "nav.training" },
  { id: "trainer", label: "nav.trainer" },
  { id: "attack", label: "nav.attack" },
  { id: "academy", label: "nav.academy" },
  { id: "debug", label: "nav.debug" },
  { id: "settings", label: "nav.settings" },
];

export default function App() {
  const { t } = useT();
  const [tab, setTab] = useState<Tab>("solve");
  const updateAvailable = useVersionCheck();
  const dataUpdateAvailable = useAlgorithmDataVersionCheck();
  const [dataNoticeDismissed, setDataNoticeDismissed] = useState(false);
  useWakeLock();
  const { state: sharedSolve, close: closeSharedSolve } = useSharedSolve();

  return (
    <SmartCubeProvider>
      <div className="app-bg min-h-screen flex flex-col">
        <header className="sticky top-0 z-50 h-16 flex items-center px-2 sm:px-6 bg-gray-950/85 backdrop-blur-xl">
          {/* Phones: brand hidden, the tab pill scrolls horizontally (it is
              wider than the viewport). ≥sm: the original centered grid. */}
          <div className="w-full max-w-7xl mx-auto flex sm:grid sm:grid-cols-[1fr_auto_1fr] items-center min-w-0">
            <div className="flex items-center gap-2 shrink-0">
              <AppLogo className="size-12 shrink-0" />
              <span className="hidden sm:block text-sm font-bold tracking-wide text-gray-200 select-none whitespace-nowrap">
                (ANOTHER) Cube trainer
              </span>
            </div>
            <div className="min-w-0 flex-1 sm:flex-none overflow-x-auto nav-scroll">
              <div className="nav-pill w-max mx-auto">
                {TABS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setTab(item.id)}
                    className={`nav-tab ${tab === item.id ? "nav-tab-active" : "nav-tab-inactive"}`}
                  >
                    {t(item.label)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-1 shrink-0">
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>
        </header>
        <Suspense fallback={null}>
          {tab === "solve" && <SolvePage />}
          {tab === "training" && <TrainingPage />}
          {tab === "attack" && <AttackPage />}
          {tab === "trainer" && <CaseTrainerPage />}
          {tab === "academy" && <AcademyPage />}
          {tab === "settings" && <SettingsPage />}
          {tab === "debug" && <DebugPage />}
        </Suspense>

        {sharedSolve && (
          <Suspense fallback={null}>
            <SharedSolveView state={sharedSolve} onClose={closeSharedSolve} />
          </Suspense>
        )}

        {updateAvailable && <UpdateNotice />}
        {!updateAvailable && dataUpdateAvailable && !dataNoticeDismissed && (
          <AlgorithmDataUpdateNotice onClose={() => setDataNoticeDismissed(true)} />
        )}
      </div>
    </SmartCubeProvider>
  );
}
