/**
 * E2E guardian — Stale-chunk recovery END-TO-END com renderização de frame.
 *
 * Diferente de installChunkErrorRecovery.e2e.test.ts (que valida só o
 * one-shot reload), este teste cobre o CICLO COMPLETO que o usuário vê:
 *
 *   1) Um React.lazy() simula um chunk stale na 1ª tentativa
 *      (`Failed to fetch dynamically imported module`).
 *   2) lazyRetry intercepta, espera 150ms e tenta de novo.
 *   3) Na 2ª tentativa o import() resolve (cenário "post-reload" /
 *      dev-server estabilizou).
 *   4) Suspense desmonta o fallback "Booting…".
 *   5) O componente real monta e pinta um "frame" do viewport — aqui,
 *      um HUD identificável (data-testid="viewport-hud-frame"),
 *      provando que o usuário NÃO ficou em tela preta/branca.
 *
 * Esse é o invariante de UX: stale chunk → recovery silenciosa → frame visível.
 */
import { describe, it, expect, vi } from 'vitest';
import { lazy, Suspense } from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { lazyRetry } from '@/lib/lazyRetry';

// ---------------------------------------------------------------------------
// Fake "viewport frame" — substitui o SkyCanvas real (que precisa de WebGL,
// indisponível em jsdom). Mantém a mesma forma: default export, render
// síncrono, marcador visual estável que prova "um frame foi pintado".
// ---------------------------------------------------------------------------
function FakeViewportFrame() {
  return (
    <div data-testid="viewport-hud-frame" role="img" aria-label="SkyCanvas HUD">
      <span data-testid="viewport-stars">★ ★ ★</span>
      <span data-testid="viewport-hud-label">SWARM CMD · TGT-LOCK</span>
    </div>
  );
}

const STALE_MSG =
  'Failed to fetch dynamically imported module: /assets/SkyCanvas-deadbeef.js';

describe('E2E · stale-chunk recovery → viewport renderiza frame', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('lazy() falha 1x com stale chunk, recupera no retry e pinta o HUD', async () => {
    // Importer que falha na primeira chamada e resolve na segunda — exatamente
    // o cenário "Vite rotacionou o hash; segunda tentativa pega o asset novo".
    let calls = 0;
    const importer = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error(STALE_MSG);
      }
      return { default: FakeViewportFrame };
    });

    // Silencia o warn esperado do lazyRetry para manter o output do teste limpo.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const LazyViewport = lazy(lazyRetry(importer, 'test:fake-viewport'));

    render(
      <Suspense
        fallback={<div data-testid="viewport-fallback">Booting SkyCanvas…</div>}
      >
        <LazyViewport />
      </Suspense>,
    );

    // Estado inicial: Suspense fallback visível, frame ainda não.
    expect(screen.getByTestId('viewport-fallback')).toBeInTheDocument();
    expect(screen.queryByTestId('viewport-hud-frame')).not.toBeInTheDocument();

    // Após o retry (150ms de espera + microtasks), o frame deve aparecer.
    await waitFor(
      () => {
        expect(screen.getByTestId('viewport-hud-frame')).toBeInTheDocument();
      },
      { timeout: 2000 },
    );

    // Frame realmente pintado: estrelas + HUD label.
    expect(screen.getByTestId('viewport-stars')).toHaveTextContent('★');
    expect(screen.getByTestId('viewport-hud-label')).toHaveTextContent(
      /SWARM CMD/,
    );

    // Fallback foi desmontado (não há mais "Booting…").
    expect(screen.queryByTestId('viewport-fallback')).not.toBeInTheDocument();

    // Importer foi chamado exatamente 2x: 1 falha + 1 sucesso.
    expect(importer).toHaveBeenCalledTimes(2);

    // lazyRetry registrou o caminho de recovery.
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('dynamic import failed'),
      expect.any(Error),
    );
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringContaining('recovered'),
    );
  });

  it('quando o import() resolve de primeira, NÃO há retry e o frame aparece direto', async () => {
    const importer = vi.fn(async () => ({ default: FakeViewportFrame }));
    const LazyViewport = lazy(lazyRetry(importer, 'test:happy-path'));

    render(
      <Suspense fallback={<div data-testid="viewport-fallback">Booting…</div>}>
        <LazyViewport />
      </Suspense>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('viewport-hud-frame')).toBeInTheDocument(),
    );

    // Sem retry — caminho feliz.
    expect(importer).toHaveBeenCalledTimes(1);
  });
});
