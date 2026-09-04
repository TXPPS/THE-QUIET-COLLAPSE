import { describe, expect, it } from 'vitest';
import { PROJECT_TITLE, PROJECT_VERSION } from '@/config/project';

describe('project config', () => {
  it('exposes the centralized title and version', () => {
    expect(PROJECT_TITLE).toBe('THE QUIET COLLAPSE');
    expect(PROJECT_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});
