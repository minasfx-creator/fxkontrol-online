import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { buildSkycV2Zip } from '@/lib/exporters/skycExporterV2Zip';
import type { SkycV2BuildOptions } from '@/lib/exporters/skycExporterV2Zip';

const baseOpts = (): SkycV2BuildOptions => ({
  projectName: 'FXK Demo',
  positions: [
    { id: 'd1', name: 'D1', type: 'drone-pad', x: 0, y: 0, z: 0, heading: 0, pitch: 0, roll: 0, color: '#22ee88' },
    { id: 'd2', name: 'D2', type: 'drone-pad', x: 4, y: 0, z: 0, heading: 0, pitch: 0, roll: 0, color: '#22ee88' },
  ] as never,
  trajectories: [],
  formations: [],
  duration: 60,
  gpsOrigin: { lat: -22.95, lng: -43.21, heading: 0, altitude: 0 },
});

describe('skycExporterV2Zip · honest preview', () => {
  it('produces a ZIP with required artifacts', async () => {
    const r = await buildSkycV2Zip(baseOpts());
    expect(r.bytes).toBeGreaterThan(0);
    expect(r.filename.endsWith('.skyc.zip')).toBe(true);

    const zip = await JSZip.loadAsync(r.blob);
    for (const f of ['show.json', 'cues.json', 'validation.json', 'show.csv', '_FXK_DISCLAIMER.txt']) {
      expect(zip.file(f), `missing ${f}`).toBeTruthy();
    }
    expect(zip.folder('trajectories')).toBeTruthy();
    expect(zip.folder('lights')).toBeTruthy();
  });

  it('stamps validation.json with marketing_hypothesis claim', async () => {
    const r = await buildSkycV2Zip(baseOpts());
    const zip = await JSZip.loadAsync(r.blob);
    const v = JSON.parse(await zip.file('validation.json')!.async('string'));
    expect(v.claim).toBe('marketing_hypothesis');
    expect(typeof v.note).toBe('string');
    expect(v.note.length).toBeGreaterThan(10);
  });

  it('disclaimer text is present and warns operator', async () => {
    const r = await buildSkycV2Zip(baseOpts());
    const zip = await JSZip.loadAsync(r.blob);
    const txt = await zip.file('_FXK_DISCLAIMER.txt')!.async('string');
    expect(txt).toMatch(/marketing_hypothesis/i);
    expect(txt).toMatch(/NOT been validated/i);
  });

  it('emits one trajectory and one lights file per drone', async () => {
    const r = await buildSkycV2Zip(baseOpts());
    const zip = await JSZip.loadAsync(r.blob);
    expect(zip.file('trajectories/d1.json')).toBeTruthy();
    expect(zip.file('trajectories/d2.json')).toBeTruthy();
    expect(zip.file('lights/d1.json')).toBeTruthy();
    expect(zip.file('lights/d2.json')).toBeTruthy();
  });
});
