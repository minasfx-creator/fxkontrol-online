/**
 * FXK-M1 NFC Tap-to-Pair & BLE Connection Page
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { bleService, initialModuleState, type FXKModuleState } from '@/services/bleService';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft, Bluetooth, BluetoothConnected, Nfc, Wifi, WifiOff,
  Battery, BatteryFull, BatteryLow, BatteryMedium, BatteryCharging,
  Shield, ShieldAlert, ShieldCheck, ShieldOff,
  Zap, Radio, CircleDot, AlertTriangle, Check, X, Loader2
} from 'lucide-react';

type PairStep = 'idle' | 'nfc-scanning' | 'nfc-found' | 'ble-connecting' | 'connected' | 'error';

function BatteryIcon({ level }: { level: number | null }) {
  if (level === null) return <Battery className="w-4 h-4 text-muted-foreground" />;
  if (level > 75) return <BatteryFull className="w-4 h-4 text-emerald-400" />;
  if (level > 40) return <BatteryMedium className="w-4 h-4 text-amber-400" />;
  return <BatteryLow className="w-4 h-4 text-red-400" />;
}

function ContinuityGrid({ cds }: { cds: boolean[] }) {
  return (
    <div className="grid grid-cols-8 gap-1">
      {cds.map((ok, i) => (
        <div
          key={i}
          className={`h-7 rounded flex items-center justify-center text-[9px] font-mono font-bold border transition-colors ${
            ok
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
              : 'bg-muted/20 border-border/20 text-muted-foreground/40'
          }`}
        >
          {i + 1}
        </div>
      ))}
    </div>
  );
}

export default function DevicePairing() {
  const navigate = useNavigate();
  const [step, setStep] = useState<PairStep>('idle');
  const [moduleState, setModuleState] = useState<FXKModuleState>(initialModuleState);
  const [nfcDeviceName, setNfcDeviceName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = bleService.subscribe(setModuleState);
    return () => { unsub(); };
  }, []);

  const startNFCPairing = useCallback(async () => {
    setStep('nfc-scanning');
    setError(null);
    const name = await bleService.connectViaNFC();
    if (name) {
      setNfcDeviceName(name);
      setStep('nfc-found');
      // Auto-connect via BLE after NFC
      setTimeout(() => connectBLE(name), 800);
    } else {
      // NFC not supported or no tag found — fallback to manual BLE
      setStep('idle');
      setError('NFC indisponível — use pareamento manual BLE');
    }
  }, []);

  const connectBLE = useCallback(async (deviceName?: string) => {
    setStep('ble-connecting');
    setError(null);
    const success = await bleService.connect(deviceName || undefined);
    if (success) {
      setStep('connected');
    } else {
      setStep('error');
      setError('Falha na conexão BLE — verifique se o módulo está ligado');
    }
  }, []);

  const disconnect = useCallback(async () => {
    await bleService.disconnect();
    setStep('idle');
    setNfcDeviceName(null);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/30 bg-card/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-sm font-bold">Pareamento FXK-M1</h1>
            <p className="text-[10px] text-muted-foreground font-mono">NFC Tap-to-Pair · BLE 5.0</p>
          </div>
          <div className={`w-2 h-2 rounded-full ${moduleState.connected ? 'bg-emerald-400 animate-pulse' : 'bg-muted-foreground/30'}`} />
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* ═══ Step: Idle ═══ */}
        {(step === 'idle' || step === 'error') && (
          <div className="space-y-4">
            {/* NFC Card */}
            <button
              onClick={startNFCPairing}
              className="w-full bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-6 text-left hover:border-primary/40 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Nfc className="w-7 h-7 text-primary" />
                </div>
                <div className="flex-1">
                  <h2 className="text-base font-bold text-foreground">Tap-to-Pair</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Encoste o celular no módulo FXK-M1 para parear instantaneamente
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-[10px] font-mono text-primary/60">
                <Radio className="w-3 h-3" />
                <span>NFC → BLE automático</span>
              </div>
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border/30" />
              <span className="text-[10px] text-muted-foreground font-mono uppercase">ou</span>
              <div className="flex-1 h-px bg-border/30" />
            </div>

            {/* Manual BLE */}
            <button
              onClick={() => connectBLE()}
              className="w-full bg-card border border-border/30 rounded-2xl p-5 text-left hover:border-border/60 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Bluetooth className="w-6 h-6 text-blue-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-sm font-bold text-foreground">Pareamento Manual BLE</h2>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Buscar módulos FXK-M1 próximos via Bluetooth
                  </p>
                </div>
              </div>
            </button>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* ═══ Step: NFC Scanning ═══ */}
        {step === 'nfc-scanning' && (
          <div className="flex flex-col items-center py-12 space-y-6">
            <div className="w-28 h-28 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center animate-pulse">
              <Nfc className="w-14 h-14 text-primary" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-lg font-bold">Aproxime o celular</h2>
              <p className="text-sm text-muted-foreground">
                Encoste o dispositivo na tag NFC do módulo FXK-M1
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              Aguardando leitura NFC...
            </div>
            <Button variant="ghost" size="sm" onClick={() => setStep('idle')}>
              Cancelar
            </Button>
          </div>
        )}

        {/* ═══ Step: NFC Found ═══ */}
        {step === 'nfc-found' && (
          <div className="flex flex-col items-center py-12 space-y-4">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center">
              <Check className="w-10 h-10 text-emerald-400" />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-bold text-emerald-400">Módulo Detectado</h2>
              <p className="text-sm font-mono text-muted-foreground mt-1">{nfcDeviceName}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              Conectando via BLE...
            </div>
          </div>
        )}

        {/* ═══ Step: BLE Connecting ═══ */}
        {step === 'ble-connecting' && (
          <div className="flex flex-col items-center py-12 space-y-6">
            <div className="w-24 h-24 rounded-full bg-blue-500/10 border-2 border-blue-500/30 flex items-center justify-center">
              <Bluetooth className="w-12 h-12 text-blue-400 animate-pulse" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-lg font-bold">Conectando...</h2>
              <p className="text-sm text-muted-foreground">
                Pareando com módulo FXK-M1 via BLE 5.0
              </p>
            </div>
            <Progress value={65} className="w-48" />
          </div>
        )}

        {/* ═══ Step: Connected ═══ */}
        {step === 'connected' && (
          <div className="space-y-4">
            {/* Status Card */}
            <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <BluetoothConnected className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-emerald-400">Conectado</h2>
                    <p className="text-[11px] font-mono text-muted-foreground">
                      {moduleState.deviceName || 'FXK-M1'}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={disconnect} className="text-xs text-destructive hover:text-destructive">
                  <X className="w-3 h-3 mr-1" /> Desconectar
                </Button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="bg-card/50 rounded-lg p-2.5 text-center">
                  <BatteryIcon level={moduleState.batteryLevel} />
                  <p className="text-xs font-bold mt-1">{moduleState.batteryLevel ?? '--'}%</p>
                  <p className="text-[9px] text-muted-foreground">Bateria</p>
                </div>
                <div className="bg-card/50 rounded-lg p-2.5 text-center">
                  <Radio className="w-4 h-4 text-blue-400 mx-auto" />
                  <p className="text-xs font-bold mt-1">{moduleState.rssi ?? '--'} dBm</p>
                  <p className="text-[9px] text-muted-foreground">RSSI</p>
                </div>
                <div className="bg-card/50 rounded-lg p-2.5 text-center">
                  <Zap className="w-4 h-4 text-amber-400 mx-auto" />
                  <p className="text-xs font-bold mt-1">{moduleState.channelCount}</p>
                  <p className="text-[9px] text-muted-foreground">Canais</p>
                </div>
              </div>
            </div>

            {/* Arm/Disarm */}
            <div className="bg-card border border-border/30 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {moduleState.armed
                    ? <ShieldAlert className="w-5 h-5 text-red-400" />
                    : <ShieldCheck className="w-5 h-5 text-emerald-400" />}
                  <div>
                    <p className="text-sm font-bold">{moduleState.armed ? 'ARMADO' : 'SEGURO'}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {moduleState.armed ? 'Pronto para disparo' : 'Sistema desarmado'}
                    </p>
                  </div>
                </div>
                <Button
                  variant={moduleState.armed ? 'destructive' : 'default'}
                  size="sm"
                  onClick={() => moduleState.armed ? bleService.disarm() : bleService.arm()}
                  className="text-xs"
                >
                  {moduleState.armed ? 'Desarmar' : 'Armar'}
                </Button>
              </div>
            </div>

            {/* CDS Continuity Grid */}
            <div className="bg-card border border-border/30 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CircleDot className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-bold">Continuidade (CDS)</h3>
                </div>
                <Button variant="outline" size="sm" onClick={() => bleService.testCDS()} className="text-[10px] h-7">
                  Testar
                </Button>
              </div>
              <ContinuityGrid cds={moduleState.cdsStatus} />
              <p className="text-[9px] text-muted-foreground text-center">
                {moduleState.cdsStatus.filter(Boolean).length}/{moduleState.channelCount} ignitores conectados
              </p>
            </div>

            {/* E-STOP */}
            <Button
              variant="destructive"
              className="w-full h-14 text-base font-bold gap-2"
              onClick={() => bleService.eStop()}
            >
              <ShieldOff className="w-5 h-5" />
              E-STOP EMERGÊNCIA
            </Button>

            {/* Firmware info */}
            {moduleState.firmwareVersion && (
              <p className="text-[10px] text-muted-foreground text-center font-mono">
                Firmware v{moduleState.firmwareVersion} · FXK-M1 Rev.1
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
