import { describe, expect, it } from 'vitest';
import {
  MAX_AMORTISATION_YEARS,
  PSR_LIMIT,
  annualAmortisation,
  bookValue,
  computeSquad,
  evaluateCompliance,
  fmtMoney,
  profitOnSale,
} from './rules';
import type { Club, PlannedMove, Player } from './types';

const M = 1_000_000;

function player(over: Partial<Player> = {}): Player {
  return {
    id: 'p1', name: 'Test Player', position: 'MF', age: 26, clubId: 'c1',
    homegrown: false, clubTrained: false,
    signedFee: 50 * M, contractLengthAtSigning: 5, yearsElapsed: 2,
    weeklyWage: 100_000, marketValue: 60 * M,
    ...over,
  };
}

const club: Club = {
  id: 'c1', name: 'Test FC', shortName: 'Test',
  psrPriorSeasons: [
    { season: '2023/24', adjustedProfit: -50 * M },
    { season: '2024/25', adjustedProfit: -40 * M },
  ],
  projectedRevenue: 200 * M,
  nonWageOperatingCosts: 100 * M,
  allowableDeductions: 10 * M,
};

describe('amortisation', () => {
  it('spreads a fee evenly across the contract', () => {
    expect(annualAmortisation(player({ signedFee: 50 * M, contractLengthAtSigning: 5 })))
      .toBe(10 * M);
  });

  it('caps the amortisation period at five years however long the deal', () => {
    const long = player({ signedFee: 100 * M, contractLengthAtSigning: 10, yearsElapsed: 0 });
    expect(annualAmortisation(long)).toBe(100 * M / MAX_AMORTISATION_YEARS);
  });

  it('charges nothing for an academy graduate', () => {
    expect(annualAmortisation(player({ clubTrained: true, signedFee: 0 }))).toBe(0);
  });

  it('stops once the contract has run out', () => {
    expect(annualAmortisation(player({ contractLengthAtSigning: 5, yearsElapsed: 5 }))).toBe(0);
  });
});

describe('book value', () => {
  it('is the unamortised residual', () => {
    // £50m over 5 years, 2 served => 3 years left => £30m on the books.
    expect(bookValue(player())).toBe(30 * M);
  });

  it('is zero for an academy graduate, so the whole fee is profit', () => {
    const academy = player({ clubTrained: true, signedFee: 0 });
    expect(bookValue(academy)).toBe(0);
    expect(profitOnSale(academy, 25 * M)).toBe(25 * M);
  });

  it('books a loss when a player is sold under their residual value', () => {
    expect(profitOnSale(player(), 20 * M)).toBe(-10 * M);
  });
});

describe('PSR', () => {
  it('flags a breach past the £105m aggregate limit', () => {
    const squad = [player({ id: 'a' }), player({ id: 'b' })];
    const report = evaluateCompliance(club, squad, []);
    expect(report.psr.limit).toBe(PSR_LIMIT);
    if (report.psr.breach) {
      expect(report.psr.breachAmount).toBeGreaterThan(0);
      expect(report.violations.some((v) => v.code === 'PSR_BREACH')).toBe(true);
      expect(report.legal).toBe(false);
    }
  });

  it('treats a signing as annual amortisation, not the whole fee', () => {
    const squad = [player({ id: 'a' })];
    const target = player({ id: 'target', clubId: null, signedFee: 0 });
    const plan: PlannedMove[] = [{
      id: 'm', kind: 'signing', playerId: 'target',
      fee: 100 * M, contractYears: 5, weeklyWage: 0,
    }];
    const before = evaluateCompliance(club, [...squad, target], []);
    const after = evaluateCompliance(club, [...squad, target], plan);
    const delta = before.psr.aggregate - after.psr.aggregate;
    // £100m over 5 years is a £20m charge this season, not £100m.
    expect(delta).toBe(20 * M);
  });

  it('books profit on sale immediately and in full', () => {
    const academy = player({ id: 'kid', clubTrained: true, signedFee: 0, weeklyWage: 0 });
    const plan: PlannedMove[] = [{ id: 'm', kind: 'sale', playerId: 'kid', fee: 30 * M }];
    const before = evaluateCompliance(club, [academy], []);
    const after = evaluateCompliance(club, [academy], plan);
    expect(after.psr.aggregate - before.psr.aggregate).toBe(30 * M);
  });
});

describe('squad registration', () => {
  const many = (n: number, over: Partial<Player>) =>
    Array.from({ length: n }, (_, i) => player({ id: `x${i}`, signedFee: 0, weeklyWage: 0, ...over }));

  it('does not count under-21s against the 25-man limit', () => {
    const squad = [...many(25, { age: 28 }), ...many(5, { age: 20 })];
    const pos = computeSquad(club, squad.map((p, i) => ({ ...p, id: `p${i}` })), []);
    expect(pos.seniorCount).toBe(25);
    expect(pos.u21Exempt).toBe(5);
  });

  it('rejects a 26th senior player', () => {
    const squad = many(26, { age: 28, homegrown: true }).map((p, i) => ({ ...p, id: `p${i}` }));
    const report = evaluateCompliance(club, squad, []);
    expect(report.violations.some((v) => v.code === 'SQUAD_SIZE')).toBe(true);
    expect(report.legal).toBe(false);
  });

  it('rejects an 18th non-homegrown player', () => {
    const squad = [
      ...many(18, { age: 28, homegrown: false }),
      ...many(5, { age: 28, homegrown: true }),
    ].map((p, i) => ({ ...p, id: `p${i}` }));
    const report = evaluateCompliance(club, squad, []);
    const v = report.violations.find((x) => x.code === 'NON_HOMEGROWN_LIMIT');
    expect(v).toBeDefined();
    expect(v?.overBy).toBe(1);
  });
});

describe('fmtMoney', () => {
  it('renders football money', () => {
    expect(fmtMoney(41_200_000)).toBe('£41.2m');
    expect(fmtMoney(-105_000_000)).toBe('-£105m');
    expect(fmtMoney(480_000)).toBe('£480k');
  });
});
