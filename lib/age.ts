import type { AgeGroup } from './types';

// Vacancies with mixed/unknown age info are always shown (never hide an option).
export function matchesAge(group: AgeGroup, ageYears: number): boolean {
  if (group === 'mixed' || group === 'unknown') return true;
  if (ageYears < 3) return group === 'under3';
  return group === 'over3';
}
