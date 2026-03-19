/**
 * FFIC Test Report Importer
 * Uploads PDF test reports and extracts product specs via AI.
 */

import { useState, useCallback } from 'react';
import { FileText, Upload, X, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface ExtractedProductSpec {
  productName: string;
  caliber: string;
  tubeDimensions: { heightMM: number; outerDiaMM: number; innerDiaMM: number };
  effectChargeG: number;
  liftChargeG: number;
  burstChargeG: number;
  totalWeightG: number;
  fuseDelayMin: number;
  fuseDelayMax: number;
  unNumber: string;
  classCode: string;
  chemicalComposition: { compound: string; percentage: number }[];
}

interface TestReportImporterProps {
  onClose?: () => void;
  onImport?: (spec: ExtractedProductSpec) => void;
}

export default function TestReportImporter({ onClose, onImport }: TestReportImporterProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedProductSpec | null>(null);
  const [fileName, setFileName] = useState('');

  const handleUpload = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setFileName(file.name);
      setIsLoading(true);
      setExtracted(null);

      try {
        // Convert PDF to base64 for the edge function
        const buffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );

        const { data, error } = await supabase.functions.invoke('parse-test-report', {
          body: { pdfBase64: base64, fileName: file.name },
        });

        if (error) throw error;

        if (data?.spec) {
          setExtracted(data.spec);
          toast.success(`Extracted: ${data.spec.productName}`);
          onImport?.(data.spec);
        } else {
          toast.error('Could not extract product data from report');
        }
      } catch (err: any) {
        console.error('Report parse error:', err);
        if (err?.message?.includes('429')) {
          toast.error('Rate limit exceeded. Please wait and try again.');
        } else if (err?.message?.includes('402')) {
          toast.error('AI credits exhausted. Add funds in Settings → Workspace → Usage.');
        } else {
          toast.error('Failed to parse test report');
        }
      } finally {
        setIsLoading(false);
      }
    };
    input.click();
  }, [onImport]);

  return (
    <div className="h-full flex flex-col bg-surface-0 border-l border-border/50">
      <div className="p-3 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-foreground uppercase tracking-wider">Test Report Importer</span>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}><X className="w-3 h-3" /></Button>
        )}
      </div>

      <div className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
        <div className="text-[9px] text-muted-foreground">
          Upload FFIC / BAM test report PDFs to automatically extract product specifications,
          chemical composition, and fuse timing data.
        </div>

        <Button onClick={handleUpload} disabled={isLoading} variant="outline" size="sm" className="w-full text-xs gap-2">
          {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
          {isLoading ? 'Analyzing...' : 'Upload Test Report PDF'}
        </Button>

        {fileName && (
          <div className="text-[9px] text-muted-foreground truncate">
            📄 {fileName}
          </div>
        )}

        {extracted && (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Extracted Product Spec
            </div>

            <div className="bg-surface-2/50 rounded p-2 space-y-1 text-[9px]">
              <Row label="Product" value={extracted.productName} />
              <Row label="Caliber" value={extracted.caliber} />
              <Row label="UN / Class" value={`${extracted.unNumber} / ${extracted.classCode}`} />
              <Row label="Effect Charge" value={`${extracted.effectChargeG}g`} />
              <Row label="Lift Charge" value={`${extracted.liftChargeG}g`} />
              <Row label="Burst Charge" value={`${extracted.burstChargeG}g`} />
              <Row label="Total Weight" value={`${extracted.totalWeightG}g`} />
              <Row label="Fuse Delay" value={`${extracted.fuseDelayMin}s – ${extracted.fuseDelayMax}s`} />
              <Row label="Tube" value={`${extracted.tubeDimensions.heightMM}×${extracted.tubeDimensions.outerDiaMM}mm`} />
            </div>

            {extracted.chemicalComposition.length > 0 && (
              <div className="space-y-1">
                <div className="text-[8px] uppercase tracking-wider text-muted-foreground font-bold">Chemical Composition</div>
                <div className="bg-surface-2/50 rounded p-2 space-y-0.5">
                  {extracted.chemicalComposition.map((c, i) => (
                    <div key={i} className="flex justify-between text-[9px]">
                      <span className="text-foreground/80">{c.compound}</span>
                      <span className="text-primary/70 font-mono">{c.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-medium">{value}</span>
    </div>
  );
}
