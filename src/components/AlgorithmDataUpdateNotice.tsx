/**
 * Dismissable "default algorithms changed" popup — shown once
 * useAlgorithmDataVersionCheck flags a newer ALGORITHM_DATA_VERSION. Unlike
 * UpdateNotice (stale bundle, mandatory), this is purely informational:
 * the user's existing progress still works fine, resetting is optional.
 */
import { RotateCcw, X } from "lucide-react";
import { listGroups, resetBuiltInGroup } from "../services/algGroupRegistry";
import { acknowledgeAlgorithmDataVersion } from "../hooks/useAlgorithmDataVersionCheck";
import { useT } from "../i18n/useT";

export function AlgorithmDataUpdateNotice({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const dismiss = () => {
    acknowledgeAlgorithmDataVersion();
    onClose();
  };

  const resetAndReload = () => {
    listGroups()
      .filter((g) => g.isBuiltIn)
      .forEach((g) => resetBuiltInGroup(g.id));
    acknowledgeAlgorithmDataVersion();
    location.reload();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-white/15 rounded-2xl shadow-2xl shadow-black/80 p-6 max-w-sm w-full text-center relative">
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 p-1 rounded text-gray-600 hover:text-gray-300 transition-colors"
          title={t("common.dismiss")}
        >
          <X size={15} />
        </button>
        <h2 className="text-white font-semibold text-lg">{t("algUpdate.title")}</h2>
        <p className="text-sm text-gray-400 mt-1.5 mb-5">
          {t("algUpdate.body")}
        </p>
        <div className="flex flex-col gap-2">
          <button onClick={resetAndReload} className="btn-danger w-full justify-center">
            <RotateCcw size={13} /> {t("algUpdate.reset")}
          </button>
          <button onClick={dismiss} className="btn-secondary w-full justify-center">
            {t("algUpdate.keep")}
          </button>
        </div>
      </div>
    </div>
  );
}
