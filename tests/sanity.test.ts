// tests/sanity.test.ts
import { describe, it, expect } from 'vitest';
import { add } from '../lib/sanity';
describe('sanity', () => { it('adds', () => { expect(add(2, 3)).toBe(5); }); });
