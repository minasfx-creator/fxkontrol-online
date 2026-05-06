/**
 * Honesty Layer — ProvenanceBadge canonical labels.
 *
 * Guarantees the four canonical labels (SIMULATED / REPLAY /
 * LIVE READ-ONLY / NOT INTEGRATED) render exactly as the human-
 * facing audit contract requires. If any of these strings drift,
 * forensic dashboards and operator briefings break.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProvenanceBadge } from '@/components/safety/ProvenanceBadge';

describe('ProvenanceBadge', () => {
  it('renders all four canonical integration modes with their honest label', () => {
    render(
      <>
        <ProvenanceBadge mode="simulated" />
        <ProvenanceBadge mode="replay" />
        <ProvenanceBadge mode="live_read_only" />
        <ProvenanceBadge mode="not_integrated" />
      </>,
    );
    expect(screen.getByText('SIMULATED')).toBeInTheDocument();
    expect(screen.getByText('REPLAY')).toBeInTheDocument();
    expect(screen.getByText('LIVE READ-ONLY')).toBeInTheDocument();
    expect(screen.getByText('NOT INTEGRATED')).toBeInTheDocument();
  });

  it('compact mode collapses LIVE READ-ONLY into LIVE-RO without losing the data-prov hook', () => {
    const { container } = render(<ProvenanceBadge mode="live_read_only" compact />);
    expect(screen.getByText('LIVE-RO')).toBeInTheDocument();
    expect(container.querySelector('[data-prov="live_read_only"]')).not.toBeNull();
  });
});
