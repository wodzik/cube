import { Suspense, lazy, useState } from "react";
import { SmartCubeProvider } from "./hooks/useSmartCube";
import { useVersionCheck } from "./hooks/useVersionCheck";
import { useWakeLock } from "./hooks/useWakeLock";
import { UpdateNotice } from "./components/UpdateNotice";

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

type Tab = "solve" | "training" | "attack" | "trainer" | "academy" | "settings" | "debug";

const TABS: { id: Tab; label: string }[] = [
  { id: "solve", label: "Solve" },
  { id: "training", label: "Drill Algorithms" },
  { id: "trainer", label: "Skill Trainers" },
  { id: "attack", label: "Time Attack" },
  { id: "academy", label: "Academy" },
  { id: "debug", label: "Debug" },
  { id: "settings", label: "Settings" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("solve");
  const updateAvailable = useVersionCheck();
  useWakeLock();

  return (
    <SmartCubeProvider>
      <div className="app-bg min-h-screen">
        <header className="sticky top-0 z-50 h-16 flex items-center px-2 sm:px-6 border-b border-white/5 bg-gray-950/75 backdrop-blur-xl">
          {/* Phones: brand hidden, the tab pill scrolls horizontally (it is
              wider than the viewport). ≥sm: the original centered grid. */}
          <div className="w-full max-w-7xl mx-auto flex sm:grid sm:grid-cols-[1fr_auto_1fr] items-center min-w-0">
            <span className="hidden sm:block text-sm font-black tracking-[0.25em] text-gray-600 select-none">NACT</span>
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
            <span className="hidden sm:block" />
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

        {updateAvailable && <UpdateNotice />}
      </div>
    </SmartCubeProvider>
  );
}
