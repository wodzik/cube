/**
 * Bluetooth connection panel — cube (required) + timer (optional, solve mode only).
 * Purely presentational: receives connection state + callbacks, no hooks of its own.
 */

import { Bluetooth, BluetoothConnected, BatteryFull, BatteryMedium, BatteryLow, Timer } from "lucide-react";
import type { DeviceConnection } from "../types/hardware";

interface ConnectionPanelProps {
  cube: DeviceConnection;
  onConnectCube: () => void;
  onDisconnectCube: () => void;

  /** Omit entirely on pages that don't use a separate BT timer. */
  timer?: DeviceConnection;
  onConnectTimer?: () => void;
  onDisconnectTimer?: () => void;
}

function BatteryIcon({ level }: { level: number | null }) {
  if (level === null) return null;
  const Icon = level > 60 ? BatteryFull : level > 25 ? BatteryMedium : BatteryLow;
  const colorClass = level > 25 ? "text-gray-400" : "text-red-400";
  return (
    <span className={`flex items-center gap-1 text-[11px] tabular-nums ${colorClass}`}>
      <Icon size={13} />
      {level}%
    </span>
  );
}

function DeviceButton({
  connection,
  label,
  icon,
  onConnect,
  onDisconnect,
}: {
  connection: DeviceConnection;
  label: string;
  icon: React.ReactNode;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  if (!connection.connected) {
    return (
      <button onClick={onConnect} className="btn-secondary" title={`Connect ${label}`}>
        {icon}
        {label}
      </button>
    );
  }

  return (
    <button
      onClick={onDisconnect}
      className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-400 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 transition-all group"
      title="Click to disconnect"
    >
      <BluetoothConnected size={13} className="group-hover:hidden" />
      <span className="hidden group-hover:inline">✕</span>
      <span className="max-w-24 truncate">{connection.deviceName ?? label}</span>
      <BatteryIcon level={connection.battery} />
    </button>
  );
}

export function ConnectionPanel({
  cube,
  onConnectCube,
  onDisconnectCube,
  timer,
  onConnectTimer,
  onDisconnectTimer,
}: ConnectionPanelProps) {
  return (
    <div className="flex items-center gap-2">
      <DeviceButton
        connection={cube}
        label="Cube"
        icon={<Bluetooth size={13} />}
        onConnect={onConnectCube}
        onDisconnect={onDisconnectCube}
      />
      {timer && onConnectTimer && onDisconnectTimer && (
        <DeviceButton
          connection={timer}
          label="Timer"
          icon={<Timer size={13} />}
          onConnect={onConnectTimer}
          onDisconnect={onDisconnectTimer}
        />
      )}
    </div>
  );
}
