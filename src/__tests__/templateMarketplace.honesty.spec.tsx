/**
 * Honesty guard — TemplateMarketplace must not contain hardcoded sample
 * cloud templates and must call the real `listPackages` registry on mount.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/modules/swarmgpt/marketplace-online/registryClient', () => ({
  listPackages: vi.fn(async () => []),
  searchPackages: vi.fn(async () => []),
}));
vi.mock('@/modules/swarmgpt/marketplace-online', () => ({
  installOnlinePackage: vi.fn(),
}));

import TemplateMarketplace from '@/components/editor/TemplateMarketplace';
import { listPackages } from '@/modules/swarmgpt/marketplace-online/registryClient';

describe('TemplateMarketplace · honesty', () => {
  it('source no longer contains SAMPLE_CLOUD_TEMPLATES', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/components/editor/TemplateMarketplace.tsx'),
      'utf8',
    );
    expect(src).not.toMatch(/SAMPLE_CLOUD_TEMPLATES/);
    expect(src).not.toMatch(/Olympic Rings Ceremony/);
  });

  it('calls the real registry listPackages on mount', async () => {
    render(
      <MemoryRouter>
        <TemplateMarketplace />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(listPackages).toHaveBeenCalled();
    });
  });
});
