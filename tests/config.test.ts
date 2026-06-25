import { describe, it, expect } from 'vitest';
import { HOME } from '../lib/config';
describe('config', () => {
  it('home coords are in Oslo bounds', () => {
    expect(HOME.lat).toBeGreaterThan(59.8); expect(HOME.lat).toBeLessThan(60.1);
    expect(HOME.lon).toBeGreaterThan(10.5); expect(HOME.lon).toBeLessThan(11.1);
  });
});
