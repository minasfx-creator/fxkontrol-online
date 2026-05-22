import TwoWireBusPanel from '@/components/pairing/TwoWireBusPanel';

export default function PairingTwoWire() {
  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground">
      <header className="px-6 py-4 border-b border-border/10">
        <h1 className="text-lg font-mono font-bold tracking-widest uppercase">
          2-Wire CDS Pairing
        </h1>
        <p className="text-[10px] font-mono text-muted-foreground mt-1">
          Connect to a FireOne 2-Wire CDS bus and discover modules. Read-only —
          this surface never arms or fires.
        </p>
      </header>
      <main className="max-w-5xl mx-auto p-4">
        <div className="border border-border/10 rounded-lg h-[70vh]">
          <TwoWireBusPanel />
        </div>
      </main>
    </div>
  );
}
