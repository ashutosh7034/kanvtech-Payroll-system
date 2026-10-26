import { describe, it, expect } from 'vitest';
import { FormulaEngine } from '../src/modules/compensation/formulaEngine.js';
import { Decimal } from 'decimal.js';

describe('Safe Formula Engine & Circular Dependency Detection', () => {
  it('correctly evaluates standard arithmetic expressions with variables', () => {
    const context = {
      CTC: 120000,
      BASIC: 48000,
      HRA_PCT: 0.50
    };

    const res1 = FormulaEngine.evaluate('BASIC * HRA_PCT', context);
    expect(res1.toNumber()).toBe(24000);

    const res2 = FormulaEngine.evaluate('(CTC - BASIC) / 2 + 500', context);
    expect(res2.toNumber()).toBe(36500);
  });

  it('correctly evaluates statutory MIN and MAX functions', () => {
    const context = {
      BASIC: 25000,
      PF_RATE: 0.12,
      CEILING_PF: 1800
    };

    // min(1800, 25000 * 0.12) => min(1800, 3000) => 1800
    const res = FormulaEngine.evaluate('MIN(CEILING_PF, BASIC * PF_RATE)', context);
    expect(res.toNumber()).toBe(1800);

    const lowBasicContext = {
      BASIC: 10000,
      PF_RATE: 0.12,
      CEILING_PF: 1800
    };
    // min(1800, 10000 * 0.12) => min(1800, 1200) => 1200
    const resLow = FormulaEngine.evaluate('MIN(CEILING_PF, BASIC * PF_RATE)', lowBasicContext);
    expect(resLow.toNumber()).toBe(1200);
  });

  it('correctly evaluates ROUND, CEIL, and FLOOR functions', () => {
    const resRound = FormulaEngine.evaluate('ROUND(1250.456, 2)', {});
    expect(resRound.toNumber()).toBe(1250.46);

    const resCeil = FormulaEngine.evaluate('CEIL(1250.1)', {});
    expect(resCeil.toNumber()).toBe(1251);

    const resFloor = FormulaEngine.evaluate('FLOOR(1250.9)', {});
    expect(resFloor.toNumber()).toBe(1250);
  });

  it('safely throws on division by zero', () => {
    expect(() => FormulaEngine.evaluate('100 / 0', {})).toThrow(/Division by zero/);
  });

  it('safely rejects invalid tokens and syntax', () => {
    expect(() => FormulaEngine.evaluate('alert("hack")', {})).toThrow();
    expect(() => FormulaEngine.evaluate('10 + * 5', {})).toThrow();
  });

  it('extracts variable dependencies accurately', () => {
    const vars = FormulaEngine.extractVariables('MIN(1800, BASIC * 0.12) + SPECIAL_ALLOWANCE');
    expect(vars.sort()).toEqual(['BASIC', 'SPECIAL_ALLOWANCE'].sort());
  });

  it('detects direct and indirect circular dependencies', () => {
    const validGraph = [
      { code: 'BASIC', formula: 'CTC * 0.40' },
      { code: 'HRA', formula: 'BASIC * 0.50' },
      { code: 'SPECIAL', formula: 'CTC - BASIC - HRA' }
    ];
    expect(FormulaEngine.detectCycle(validGraph)).toBeNull();

    const circularGraph = [
      { code: 'A', formula: 'B + 100' },
      { code: 'B', formula: 'C * 2' },
      { code: 'C', formula: 'A - 50' }
    ];
    const cycle = FormulaEngine.detectCycle(circularGraph);
    expect(cycle).not.toBeNull();
    expect(cycle).toContain('A');
    expect(cycle).toContain('B');
    expect(cycle).toContain('C');
  });

  it('evaluates IF conditional logic and relational operators accurately', () => {
    const contextHigh = { BASIC: 20000 };
    const resHigh = FormulaEngine.evaluate('IF(BASIC > 15000, 1800, BASIC * 0.12)', contextHigh);
    expect(resHigh.toNumber()).toBe(1800);

    const contextLow = { BASIC: 10000 };
    const resLow = FormulaEngine.evaluate('IF(BASIC > 15000, 1800, BASIC * 0.12)', contextLow);
    expect(resLow.toNumber()).toBe(1200);

    const resGte = FormulaEngine.evaluate('IF(BASIC >= 20000, 500, 0)', contextHigh);
    expect(resGte.toNumber()).toBe(500);

    const resEq = FormulaEngine.evaluate('IF(BASIC == 10000, 999, 111)', contextLow);
    expect(resEq.toNumber()).toBe(999);
  });

  it('correctly sorts components in topological dependency order', () => {
    const graph = [
      { code: 'SPECIAL', formula: 'CTC - BASIC - HRA' },
      { code: 'HRA', formula: 'BASIC * 0.50' },
      { code: 'BASIC', formula: 'CTC * 0.40' }
    ];

    const order = FormulaEngine.topologicalSort(graph);
    // BASIC must come before HRA, and both before SPECIAL
    expect(order.indexOf('BASIC')).toBeLessThan(order.indexOf('HRA'));
    expect(order.indexOf('BASIC')).toBeLessThan(order.indexOf('SPECIAL'));
    expect(order.indexOf('HRA')).toBeLessThan(order.indexOf('SPECIAL'));
  });
});

