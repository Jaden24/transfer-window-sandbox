/**
 * Club financial positions.
 *
 * ⚠️ ILLUSTRATIVE FIGURES. See the note at the top of `players.ts`.
 *
 * These are tuned so each club sits in a *different* and recognisable PSR
 * situation, because the interesting thing to demonstrate is the constraint,
 * not any particular club's real accounts:
 *
 *   Aston Villa  — squeezed. A little headroom, gone the moment you sign a star.
 *   Newcastle    — comfortable, but a big wage bill leaves less room than it looks.
 *   Forest       — tight, and reliant on selling to stay compliant.
 *   Everton      — already deep in the red, with almost nothing left to give.
 */

import type { Club } from '../engine/types';

const M = 1_000_000;

export const CLUBS: Club[] = [
  {
    id: 'aston-villa',
    name: 'Aston Villa',
    shortName: 'Villa',
    psrPriorSeasons: [
      { season: '2023/24', adjustedProfit: -46 * M },
      { season: '2024/25', adjustedProfit: -38 * M },
    ],
    projectedRevenue: 275 * M,
    nonWageOperatingCosts: 137 * M,
    allowableDeductions: 25 * M,
  },
  {
    id: 'newcastle',
    name: 'Newcastle United',
    shortName: 'Newcastle',
    psrPriorSeasons: [
      { season: '2023/24', adjustedProfit: -22 * M },
      { season: '2024/25', adjustedProfit: -18 * M },
    ],
    projectedRevenue: 320 * M,
    nonWageOperatingCosts: 194 * M,
    allowableDeductions: 30 * M,
  },
  {
    id: 'forest',
    name: 'Nottingham Forest',
    shortName: 'Forest',
    psrPriorSeasons: [
      { season: '2023/24', adjustedProfit: -52 * M },
      { season: '2024/25', adjustedProfit: -21 * M },
    ],
    projectedRevenue: 195 * M,
    nonWageOperatingCosts: 143 * M,
    allowableDeductions: 18 * M,
  },
  {
    id: 'everton',
    name: 'Everton',
    shortName: 'Everton',
    psrPriorSeasons: [
      { season: '2023/24', adjustedProfit: -61 * M },
      { season: '2024/25', adjustedProfit: -34 * M },
    ],
    projectedRevenue: 205 * M,
    nonWageOperatingCosts: 142 * M,
    allowableDeductions: 20 * M,
  },
];

export const DEFAULT_CLUB_ID = 'aston-villa';

export function clubById(id: string): Club | undefined {
  return CLUBS.find((c) => c.id === id);
}
