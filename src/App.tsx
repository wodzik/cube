import { Suspense, lazy, useEffect, useState } from "react";
import { type AnalyzeRequest, onOpenAnalyze } from "./services/analyzeNav";
import { type DrillRequest, onOpenDrill } from "./services/drillNav";
import { SmartCubeProvider } from "./hooks/useSmartCube";
import { CubeLookProvider } from "./hooks/useCubeLook";
import { useVersionCheck } from "./hooks/useVersionCheck";
import { useAlgorithmDataVersionCheck } from "./hooks/useAlgorithmDataVersionCheck";
import { useWakeLock } from "./hooks/useWakeLock";
import { useSharedSolve } from "./hooks/useSharedSolve";
import { UpdateNotice } from "./components/UpdateNotice";
import { AlgorithmDataUpdateNotice } from "./components/AlgorithmDataUpdateNotice";
import { AppLogo } from "./components/AppLogo";
import { ThemeToggle } from "./components/ThemeToggle";

// Lazy-loaded per tab: Training/Attack pull in the (large) OLL/PLL/F2L JSON
// data via algorithmStore, which Solve never needs — code-splitting here
// keeps the default "land on Solve" bundle small.
const SolvePage = lazy(() => import("./pages/SolvePage"));
const TrainingPage = lazy(() => import("./pages/TrainingPage"));
const AttackPage = lazy(() => import("./pages/AttackPage"));
const TrainersPage = lazy(() => import("./pages/TrainersPage"));
const BldTrainerPage = lazy(() => import("./pages/BldTrainerPage"));
const VersusPage = lazy(() => import("./pages/VersusPage"));
const AnalyzePage = lazy(() => import("./pages/AnalyzePage"));
const CaseStatsPage = lazy(() => import("./pages/CaseStatsPage"));
const AcademyPage = lazy(() => import("./pages/AcademyPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const DebugPage = lazy(() => import("./pages/DebugPage"));
// The read-only preview a share link opens (#s=…) — loaded only when there is one.
const SharedSolveView = lazy(() => import("./components/SharedSolveView"));

type Tab = "solve" | "training" | "attack" | "trainer" | "bld" | "versus" | "analyze" | "stats" | "academy" | "settings" | "debug";

const TABS: { id: Tab; label: string }[] = [
  { id: "solve", label: "Solve" },
  { id: "training", label: "Drill Algorithms" },
  { id: "trainer", label: "Trainers" },
  { id: "bld", label: "Blindfolded" },
  { id: "versus", label: "Versus" },
  { id: "analyze", label: "Analyze" },
  { id: "stats", label: "Stats" },
  { id: "attack", label: "Time Attack" },
  { id: "academy", label: "Academy" },
  { id: "debug", label: "Debug" },
  { id: "settings", label: "Settings" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("solve");
  // Analyze a scramble from anywhere (a solve's analysis…): switch to the tab with it filled in.
  const [analyzeRequest, setAnalyzeRequest] = useState<AnalyzeRequest | null>(null);
  useEffect(
    () =>
      onOpenAnalyze((r) => {
        setAnalyzeRequest(r);
        setTab("analyze");
      }),
    []
  );
  // Drill one case's algorithm from anywhere (a solve's case, the case stats): switch to Drill Algorithms on it.
  const [drillRequest, setDrillRequest] = useState<DrillRequest | null>(null);
  useEffect(
    () =>
      onOpenDrill((r) => {
        setDrillRequest(r);
        setTab("training");
      }),
    []
  );
  const updateAvailable = useVersionCheck();
  const dataUpdateAvailable = useAlgorithmDataVersionCheck();
  const [dataNoticeDismissed, setDataNoticeDismissed] = useState(false);
  useWakeLock();
  const { state: sharedSolve, close: closeSharedSolve } = useSharedSolve();

  return (
    <SmartCubeProvider>
      <CubeLookProvider>
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
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`nav-tab ${tab === t.id ? "nav-tab-active" : "nav-tab-inactive"}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end shrink-0">
              <ThemeToggle />
            </div>
          </div>
        </header>
        <Suspense fallback={null}>
          {tab === "solve" && <SolvePage />}
          {tab === "training" && <TrainingPage request={drillRequest} />}
          {tab === "attack" && <AttackPage />}
          {tab === "trainer" && <TrainersPage />}
          {tab === "bld" && <BldTrainerPage />}
          {tab === "versus" && <VersusPage />}
          {tab === "analyze" && <AnalyzePage request={analyzeRequest} />}
          {tab === "stats" && <CaseStatsPage />}
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
      </CubeLookProvider>
    </SmartCubeProvider>
  );
}
