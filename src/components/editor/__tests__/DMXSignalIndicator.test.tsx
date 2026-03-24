import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * Extracted DMX Signal LED indicator for testability.
 * Tests the visual states: online/offline, relay connected/disconnected.
 */

function DMXSignalIndicator({
  artNetConnected,
  relayConnected,
  artNetIp = '192.168.15.2',
  artNetPort = 6454,
}: {
  artNetConnected: boolean;
  relayConnected: boolean;
  artNetIp?: string;
  artNetPort?: number;
}) {
  return (
    <div
      data-testid="dmx-signal"
      title={
        artNetConnected
          ? `DMX Signal: Active · ${artNetIp}:${artNetPort}`
          : 'DMX Signal: No Signal'
      }
      className="flex items-center gap-1"
    >
      <div className="flex items-end gap-[1px]">
        <div
          data-testid="dmx-led"
          className={
            artNetConnected
              ? 'rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)] w-1.5 h-1.5'
              : 'rounded-full bg-muted-foreground/20 w-1.5 h-1.5'
          }
          style={
            artNetConnected
              ? { animation: 'pulse 2s ease-in-out infinite' }
              : undefined
          }
        />
        {[0.3, 0.55, 0.8, 1].map((h, i) => (
          <div
            key={i}
            data-testid={`signal-bar-${i}`}
            className={
              artNetConnected
                ? i < 3
                  ? 'bg-green-500 w-[2px] rounded-[1px]'
                  : relayConnected
                    ? 'bg-green-500 w-[2px] rounded-[1px]'
                    : 'bg-green-500/30 w-[2px] rounded-[1px]'
                : 'bg-muted-foreground/15 w-[2px] rounded-[1px]'
            }
            style={{ height: `${Math.round(h * 8)}px` }}
          />
        ))}
      </div>
      <span
        data-testid="dmx-label"
        className={
          artNetConnected
            ? 'font-mono text-green-500/70 text-[6px]'
            : 'font-mono text-muted-foreground/40 text-[6px]'
        }
      >
        DMX
      </span>
    </div>
  );
}

describe('DMX Signal LED Indicator', () => {
  describe('Offline state (no Art-Net connection)', () => {
    it('shows "No Signal" title', () => {
      render(<DMXSignalIndicator artNetConnected={false} relayConnected={false} />);
      expect(screen.getByTestId('dmx-signal')).toHaveAttribute('title', 'DMX Signal: No Signal');
    });

    it('LED has inactive styling (no green)', () => {
      render(<DMXSignalIndicator artNetConnected={false} relayConnected={false} />);
      const led = screen.getByTestId('dmx-led');
      expect(led.className).toContain('bg-muted-foreground/20');
      expect(led.className).not.toContain('bg-green-500');
    });

    it('LED has no pulse animation', () => {
      render(<DMXSignalIndicator artNetConnected={false} relayConnected={false} />);
      const led = screen.getByTestId('dmx-led');
      expect(led.style.animation).toBeFalsy();
    });

    it('all signal bars are inactive', () => {
      render(<DMXSignalIndicator artNetConnected={false} relayConnected={false} />);
      for (let i = 0; i < 4; i++) {
        const bar = screen.getByTestId(`signal-bar-${i}`);
        expect(bar.className).toContain('bg-muted-foreground/15');
        expect(bar.className).not.toContain('bg-green-500');
      }
    });

    it('DMX label has muted color', () => {
      render(<DMXSignalIndicator artNetConnected={false} relayConnected={false} />);
      expect(screen.getByTestId('dmx-label').className).toContain('text-muted-foreground/40');
    });
  });

  describe('Online state (Art-Net connected, no relay)', () => {
    it('shows active title with IP and port', () => {
      render(<DMXSignalIndicator artNetConnected={true} relayConnected={false} artNetIp="10.0.0.1" artNetPort={6454} />);
      expect(screen.getByTestId('dmx-signal')).toHaveAttribute('title', 'DMX Signal: Active · 10.0.0.1:6454');
    });

    it('LED is green with glow shadow', () => {
      render(<DMXSignalIndicator artNetConnected={true} relayConnected={false} />);
      const led = screen.getByTestId('dmx-led');
      expect(led.className).toContain('bg-green-500');
      expect(led.className).toContain('shadow-');
    });

    it('LED has pulse animation', () => {
      render(<DMXSignalIndicator artNetConnected={true} relayConnected={false} />);
      const led = screen.getByTestId('dmx-led');
      expect(led.style.animation).toContain('pulse');
    });

    it('first 3 signal bars are green, 4th is dimmed (no relay)', () => {
      render(<DMXSignalIndicator artNetConnected={true} relayConnected={false} />);
      for (let i = 0; i < 3; i++) {
        expect(screen.getByTestId(`signal-bar-${i}`).className).toContain('bg-green-500');
        expect(screen.getByTestId(`signal-bar-${i}`).className).not.toContain('/30');
      }
      expect(screen.getByTestId('signal-bar-3').className).toContain('bg-green-500/30');
    });

    it('DMX label has green color', () => {
      render(<DMXSignalIndicator artNetConnected={true} relayConnected={false} />);
      expect(screen.getByTestId('dmx-label').className).toContain('text-green-500/70');
    });
  });

  describe('Full connection (Art-Net + Relay)', () => {
    it('all 4 signal bars are fully green', () => {
      render(<DMXSignalIndicator artNetConnected={true} relayConnected={true} />);
      for (let i = 0; i < 4; i++) {
        const bar = screen.getByTestId(`signal-bar-${i}`);
        expect(bar.className).toContain('bg-green-500');
        expect(bar.className).not.toContain('/30');
        expect(bar.className).not.toContain('/15');
      }
    });
  });

  describe('Signal bar heights are progressive', () => {
    it('bars increase in height', () => {
      render(<DMXSignalIndicator artNetConnected={true} relayConnected={true} />);
      const heights = [0, 1, 2, 3].map(i => {
        const bar = screen.getByTestId(`signal-bar-${i}`);
        return parseInt(bar.style.height, 10);
      });
      for (let i = 1; i < heights.length; i++) {
        expect(heights[i]).toBeGreaterThanOrEqual(heights[i - 1]);
      }
    });
  });
});
