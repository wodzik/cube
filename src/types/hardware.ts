/**
 * Hardware connection types.
 *
 * Brand/protocol identification comes straight from smartcube-web-bluetooth's
 * SmartCubeProtocolInfo — we don't maintain our own brand enum, since the
 * library already detects GAN/Giiker/GoCube/MoYu/QiYi and any brand it adds
 * later shows up here automatically.
 */

export interface DeviceConnection {
  connected: boolean;
  deviceName: string | null;
  protocolId: string | null;
  battery: number | null;
}

export const INITIAL_DEVICE_CONNECTION: DeviceConnection = {
  connected: false,
  deviceName: null,
  protocolId: null,
  battery: null,
};
