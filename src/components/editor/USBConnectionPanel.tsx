import { useState, useCallback, useEffect, useRef } from 'react';
import { Usb, Plus, X, Send, Trash2, Wifi, WifiOff, Zap, Activity, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp, Radio } from 'lucide-react';
import { haptics } from '@/lib/haptics';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import { useUSBDeviceStore } from '@/store/useUSBDeviceStore';
import {
  type ConnectedDevice,
  type USBDeviceProfile,
  type USBLog,
  type ConnectionState,
  DEVICE_PROFILES,
  isWebSerialSupported,
  isWebUSBSupported,
  requestSerialPort,
  openSerialConnection,
  closeSerialConnection,
  sendSerialData,
  bytesToHex,
  generateDeviceId,
  buildENTTECProPacket,
  buildDMX512Frame,
} from '@/lib/usbEngine';

const TYPE_COLORS: Record<string, string> = {
  dmx: 'text-cyan-400',
  firing: 'text-red-400',
  timecode: 'text-yellow-400',
  serial: 'text-green-400',
};

const STATE_INDICATORS: Record<ConnectionState, { color: string; label: string }> = {
  disconnected: { color: 'bg-muted-foreground/40', label: 'Desconectado' },
  connecting: { color: 'bg-yellow-500 animate-pulse', label: 'Conectando...' },
  connected: { color: 'bg-green-500', label: 'Conectado' },
  error: { color: 'bg-destructive', label: 'Erro' },
};

export default function USBConnectionPanel({ onClose }: { onClose: () => void }) {
  const isMobile = useIsMobile();
  const { registerDevice, unregisterDevice } = useUSBDeviceStore();
  const [devices, setDevices] = useState<ConnectedDevice[]>([]);
  const [logs, setLogs] = useState<USBLog[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>(DEVICE_PROFILES[0].label);
  const [customBaud, setCustomBaud] = useState(9600);
  const [sendText, setSendText] = useState('');
  const [expandedDevice, setExpandedDevice] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(true);
  const readLoopRefs = useRef<Map<string, boolean>>(new Map());

  const serialSupported = isWebSerialSupported();
  const usbSupported = isWebUSBSupported();

  const addLog = useCallback((log: Omit<USBLog, 'timestamp'>) => {
    setLogs(prev => [{ ...log, timestamp: new Date() }, ...prev].slice(0, 200));
  }, []);

  // Read loop for a connected serial device
  const startReadLoop = useCallback(async (device: ConnectedDevice) => {
    if (!device.reader) return;
    readLoopRefs.current.set(device.id, true);

    try {
      while (readLoopRefs.current.get(device.id)) {
        const { value, done } = await device.reader.read();
        if (done) break;
        if (value && value.length > 0) {
          setDevices(prev => prev.map(d =>
            d.id === device.id
              ? { ...d, lastData: value, lastDataTime: Date.now(), bytesReceived: d.bytesReceived + value.length }
              : d
          ));
          addLog({
            deviceId: device.id,
            direction: 'rx',
            message: `${value.length} bytes recebidos`,
            data: value,
          });
        }
      }
    } catch (e: any) {
      if (readLoopRefs.current.get(device.id)) {
        addLog({ deviceId: device.id, direction: 'error', message: e.message || 'Erro na leitura' });
      }
    }
  }, [addLog]);

  // Connect to a device
  const connectDevice = useCallback(async () => {
    const profile = DEVICE_PROFILES.find(p => p.label === selectedProfile) || DEVICE_PROFILES[DEVICE_PROFILES.length - 1];
    const effectiveProfile = profile.type === 'serial' ? { ...profile, baudRate: customBaud } : profile;

    const deviceId = generateDeviceId();

    try {
      addLog({ deviceId, direction: 'info', message: `Solicitando porta para ${effectiveProfile.label}...` });

      const port = await requestSerialPort(effectiveProfile);

      setDevices(prev => [...prev, {
        id: deviceId,
        profile: effectiveProfile,
        state: 'connecting',
        port,
        bytesReceived: 0,
        bytesSent: 0,
      }]);

      const { reader, writer } = await openSerialConnection(port, effectiveProfile);

      setDevices(prev => prev.map(d =>
        d.id === deviceId
          ? { ...d, state: 'connected' as ConnectionState, reader, writer }
          : d
      ));

      addLog({ deviceId, direction: 'info', message: `✓ Conectado a ${effectiveProfile.label} @ ${effectiveProfile.baudRate} baud` });
      toast.success(`Conectado: ${effectiveProfile.label}`);

      // Need to get the updated device with reader for read loop
      const connectedDevice: ConnectedDevice = {
        id: deviceId,
        profile: effectiveProfile,
        state: 'connected',
        port,
        reader,
        writer,
        bytesReceived: 0,
        bytesSent: 0,
      };
      startReadLoop(connectedDevice);
      registerDevice(connectedDevice);

      if (navigator.vibrate) navigator.vibrate(50);
    } catch (e: any) {
      if (e.name === 'NotFoundError') {
        addLog({ deviceId, direction: 'info', message: 'Seleção cancelada pelo usuário' });
        setDevices(prev => prev.filter(d => d.id !== deviceId));
        return;
      }
      setDevices(prev => prev.map(d =>
        d.id === deviceId
          ? { ...d, state: 'error' as ConnectionState, error: e.message }
          : d
      ));
      addLog({ deviceId, direction: 'error', message: e.message || 'Falha na conexão' });
      toast.error(e.message || 'Falha na conexão USB');
    }
  }, [selectedProfile, customBaud, addLog, startReadLoop]);

  // Disconnect a device
  const disconnectDevice = useCallback(async (deviceId: string) => {
    readLoopRefs.current.set(deviceId, false);
    const device = devices.find(d => d.id === deviceId);
    if (device) {
      await closeSerialConnection(device);
      addLog({ deviceId, direction: 'info', message: 'Desconectado' });
    }
    unregisterDevice(deviceId);
    setDevices(prev => prev.filter(d => d.id !== deviceId));
    if (navigator.vibrate) navigator.vibrate(30);
  }, [devices, addLog, unregisterDevice]);

  // Send data to device
  const sendToDevice = useCallback(async (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    if (!device || device.state !== 'connected') return;

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(sendText + '\n');
      await sendSerialData(device, data);
      setDevices(prev => prev.map(d =>
        d.id === deviceId ? { ...d, bytesSent: d.bytesSent + data.length } : d
      ));
      addLog({ deviceId, direction: 'tx', message: `"${sendText}"`, data });
      setSendText('');
    } catch (e: any) {
      addLog({ deviceId, direction: 'error', message: e.message });
    }
  }, [devices, sendText, addLog]);

  // Send DMX test frame
  const sendDMXTest = useCallback(async (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    if (!device || device.state !== 'connected') return;

    try {
      const channels = new Uint8Array(512);
      // Rainbow test pattern
      for (let i = 0; i < 512; i += 3) {
        channels[i] = Math.round(Math.sin(i * 0.05) * 127 + 128);
        channels[i + 1] = Math.round(Math.sin(i * 0.05 + 2) * 127 + 128);
        channels[i + 2] = Math.round(Math.sin(i * 0.05 + 4) * 127 + 128);
      }

      let data: Uint8Array;
      if (device.profile.label.includes('Pro')) {
        data = buildENTTECProPacket(6, buildDMX512Frame(channels));
      } else {
        data = buildDMX512Frame(channels);
      }

      await sendSerialData(device, data);
      setDevices(prev => prev.map(d =>
        d.id === deviceId ? { ...d, bytesSent: d.bytesSent + data.length } : d
      ));
      addLog({ deviceId, direction: 'tx', message: `DMX Test Frame (${data.length} bytes)`, data });
      toast.success('DMX test frame enviado');
    } catch (e: any) {
      addLog({ deviceId, direction: 'error', message: e.message });
    }
  }, [devices, addLog]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      readLoopRefs.current.forEach((_, key) => readLoopRefs.current.set(key, false));
    };
  }, []);

  const profile = DEVICE_PROFILES.find(p => p.label === selectedProfile);

  return (
    <div className={`h-full bg-surface-1 border-l border-border flex flex-col ${isMobile ? 'w-full' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-border shrink-0">
        <div className="flex items-center gap-1.5">
          <Usb className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground">Conexão USB</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-0.5 mr-1">
            {serialSupported && (
              <span className="text-[7px] px-1 py-0.5 rounded bg-green-500/20 text-green-400">Serial</span>
            )}
            {usbSupported && (
              <span className="text-[7px] px-1 py-0.5 rounded bg-cyan-500/20 text-cyan-400">USB</span>
            )}
            {!serialSupported && !usbSupported && (
              <span className="text-[7px] px-1 py-0.5 rounded bg-destructive/20 text-destructive">N/A</span>
            )}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3 scrollbar-thin">
        {/* API Support Warning */}
        {!serialSupported && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-sm p-2 text-[9px] text-destructive">
            <p className="font-bold mb-0.5">⚠ Web Serial API indisponível</p>
            <p>Use Chrome/Edge/Opera em Android ou Desktop. Safari/Firefox não suportam Web Serial.</p>
          </div>
        )}

        {/* Device Status */}
        <div className="grid grid-cols-3 gap-1 text-center">
          <div className="bg-surface-2 rounded-sm p-1">
            <p className="text-sm font-bold text-primary font-mono-code">{devices.length}</p>
            <p className="text-[8px] text-muted-foreground">Devices</p>
          </div>
          <div className="bg-surface-2 rounded-sm p-1">
            <p className="text-sm font-bold text-green-400 font-mono-code">
              {devices.filter(d => d.state === 'connected').length}
            </p>
            <p className="text-[8px] text-muted-foreground">Online</p>
          </div>
          <div className="bg-surface-2 rounded-sm p-1">
            <p className="text-sm font-bold font-mono-code text-foreground">
              {devices.reduce((s, d) => s + d.bytesReceived + d.bytesSent, 0)}
            </p>
            <p className="text-[8px] text-muted-foreground">Bytes</p>
          </div>
        </div>

        {/* Connect New Device */}
        <div className="space-y-1.5 border border-border/50 rounded-sm p-2">
          <span className="text-[9px] text-muted-foreground font-semibold uppercase">Conectar Equipamento</span>

          <Select value={selectedProfile} onValueChange={setSelectedProfile}>
            <SelectTrigger className="h-7 text-[10px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEVICE_PROFILES.map(p => (
                <SelectItem key={p.label} value={p.label} className="text-[10px]">
                  <span className={TYPE_COLORS[p.type]}>{p.type.toUpperCase()}</span> — {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {profile && (
            <p className="text-[8px] text-muted-foreground">{profile.description} · {profile.baudRate} baud</p>
          )}

          {profile?.type === 'serial' && (
            <div className="flex items-center gap-1">
              <span className="text-[8px] text-muted-foreground">Baud:</span>
              <Select value={String(customBaud)} onValueChange={v => setCustomBaud(Number(v))}>
                <SelectTrigger className="h-6 text-[9px] w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200, 250000].map(b => (
                    <SelectItem key={b} value={String(b)} className="text-[9px]">{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button
            size="sm"
            className={`h-7 text-[10px] w-full gap-1 ${isMobile ? 'h-10 text-xs' : ''}`}
            onClick={connectDevice}
            disabled={!serialSupported}
          >
            <Plus className="h-3 w-3" />
            Parear Dispositivo USB
          </Button>
        </div>

        {/* Connected Devices */}
        {devices.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">Dispositivos</span>
            {devices.map(device => {
              const stateInfo = STATE_INDICATORS[device.state];
              const isExpanded = expandedDevice === device.id;
              return (
                <div key={device.id} className="bg-surface-2 rounded-sm overflow-hidden">
                  {/* Device Header */}
                  <button
                    onClick={() => setExpandedDevice(isExpanded ? null : device.id)}
                    className="w-full flex items-center gap-1.5 p-1.5 text-left"
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${stateInfo.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-[10px] font-semibold truncate ${TYPE_COLORS[device.profile.type]}`}>
                        {device.profile.label}
                      </p>
                      <p className="text-[7px] text-muted-foreground">
                        {stateInfo.label} · ↑{device.bytesSent}B ↓{device.bytesReceived}B
                      </p>
                    </div>
                    {isExpanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
                  </button>

                  {/* Expanded Controls */}
                  {isExpanded && (
                    <div className="border-t border-border/30 p-1.5 space-y-1.5">
                      {/* Send data */}
                      {device.state === 'connected' && (
                        <>
                          <div className="flex gap-1">
                            <Input
                              value={sendText}
                              onChange={e => setSendText(e.target.value)}
                              placeholder="Enviar texto..."
                              className={`h-6 text-[9px] font-mono-code bg-surface-0 flex-1 ${isMobile ? 'h-9 text-xs' : ''}`}
                              onKeyDown={e => e.key === 'Enter' && sendToDevice(device.id)}
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              className={`h-6 px-2 ${isMobile ? 'h-9 px-3' : ''}`}
                              onClick={() => sendToDevice(device.id)}
                              disabled={!sendText}
                            >
                              <Send className="h-3 w-3" />
                            </Button>
                          </div>

                          {device.profile.type === 'dmx' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className={`h-6 text-[9px] w-full gap-1 ${isMobile ? 'h-9 text-xs' : ''}`}
                              onClick={() => sendDMXTest(device.id)}
                            >
                              <Zap className="h-3 w-3" />
                              DMX Test Frame (Rainbow)
                            </Button>
                          )}

                          {/* Last received data */}
                          {device.lastData && (
                            <div className="bg-surface-0 rounded-sm p-1">
                              <p className="text-[7px] text-muted-foreground mb-0.5">Último RX:</p>
                              <p className="text-[7px] font-mono-code text-primary/80 break-all">
                                {bytesToHex(device.lastData)}
                              </p>
                            </div>
                          )}
                        </>
                      )}

                      {device.error && (
                        <p className="text-[8px] text-destructive">{device.error}</p>
                      )}

                      <Button
                        size="sm"
                        variant="destructive"
                        className={`h-6 text-[9px] w-full gap-1 ${isMobile ? 'h-9 text-xs' : ''}`}
                        onClick={() => disconnectDevice(device.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                        Desconectar
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Data Log */}
        <div className="border-t border-border/50 pt-2 space-y-1.5">
          <button
            onClick={() => setShowLogs(v => !v)}
            className="flex items-center gap-1.5 w-full text-left"
          >
            <Activity className="h-3 w-3 text-primary" />
            <span className="text-[9px] text-muted-foreground font-semibold uppercase flex-1">Log de Dados</span>
            <span className="text-[8px] text-muted-foreground">{showLogs ? '▼' : '▶'}</span>
          </button>

          {showLogs && (
            <div className="space-y-1">
              <div className="max-h-40 overflow-y-auto scrollbar-thin space-y-0.5">
                {logs.length === 0 && (
                  <p className="text-[8px] text-muted-foreground text-center py-2">
                    Conecte um dispositivo para ver logs
                  </p>
                )}
                {logs.map((log, i) => (
                  <div key={i} className="bg-surface-2 rounded-sm px-1.5 py-0.5 flex items-start gap-1">
                    <span className={`text-[7px] font-bold shrink-0 ${
                      log.direction === 'tx' ? 'text-cyan-400' :
                      log.direction === 'rx' ? 'text-green-400' :
                      log.direction === 'error' ? 'text-destructive' :
                      'text-muted-foreground'
                    }`}>
                      {log.direction === 'tx' ? '↑TX' : log.direction === 'rx' ? '↓RX' : log.direction === 'error' ? '✕ERR' : 'ℹ'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[8px] text-foreground truncate">{log.message}</p>
                      {log.data && (
                        <p className="text-[7px] font-mono-code text-primary/60 break-all">{bytesToHex(log.data, 16)}</p>
                      )}
                    </div>
                    <span className="text-[6px] text-muted-foreground shrink-0">
                      {log.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
              {logs.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 text-[8px] w-full text-muted-foreground"
                  onClick={() => setLogs([])}
                >
                  Limpar logs
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="bg-surface-2 rounded-sm p-2 text-[9px] text-muted-foreground space-y-1">
          <p><strong>Web Serial:</strong> Chrome/Edge/Opera (Android + Desktop)</p>
          <p><strong>DMX USB:</strong> ENTTEC Open DMX, ENTTEC Pro (FTDI)</p>
          <p><strong>Firing:</strong> RS-232/RS-485 via adaptador USB-Serial</p>
          <p className="text-primary/70">Conecte o cabo USB OTG no mobile e clique "Parear"</p>
        </div>
      </div>
    </div>
  );
}
