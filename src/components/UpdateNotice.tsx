/**
 * Blocking "new version deployed" popup — shown once useVersionCheck flags
 * a build-id mismatch. Deliberately not dismissable: the running bundle is
 * stale, and mixing its lazily-loaded chunks with a newer deployment's
 * hashed filenames is a 404 waiting to happen. Reload is the only exit.
 */

import { RefreshCw } from "lucide-react";

export function UpdateNotice() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-white/15 rounded-2xl shadow-2xl shadow-black/80 p-6 max-w-sm w-full text-center">
        <h2 className="text-white font-semibold text-lg">New version available</h2>
        <p className="text-sm text-gray-400 mt-1.5 mb-5">
          NACT has been updated — reload to get the latest version. Your sessions and solves are stored locally and stay
          untouched.
        </p>
        <button onClick={() => location.reload()} className="btn-primary w-full justify-center">
          <RefreshCw size={14} /> Reload now
        </button>
      </div>
    </div>
  );
}
