import { Decimal } from 'decimal.js';

export interface Token {
  type: 'NUMBER' | 'IDENTIFIER' | 'OPERATOR' | 'LPAREN' | 'RPAREN' | 'COMMA';
  value: string;
}

export class FormulaEngine {
  private static readonly STANDARD_FUNCTIONS = new Set(['MIN', 'MAX', 'ROUND', 'CEIL', 'FLOOR', 'ABS', 'IF']);

  /**
   * Tokenizes a mathematical and logical formula expression.
   */
  static tokenize(expression: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    const len = expression.length;

    while (i < len) {
      const char = expression[i];

      if (/\s/.test(char)) {
        i++;
        continue;
      }

      if (/[0-9]/.test(char) || (char === '.' && i + 1 < len && /[0-9]/.test(expression[i + 1]))) {
        let numStr = '';
        while (i < len && (/[0-9]/.test(expression[i]) || expression[i] === '.')) {
          numStr += expression[i];
          i++;
        }
        tokens.push({ type: 'NUMBER', value: numStr });
        continue;
      }

      if (/[a-zA-Z_]/.test(char)) {
        let ident = '';
        while (i < len && /[a-zA-Z0-9_]/.test(expression[i])) {
          ident += expression[i];
          i++;
        }
        tokens.push({ type: 'IDENTIFIER', value: ident.toUpperCase() });
        continue;
      }

      // Multi-character relational operators: >=, <=, ==, !=
      if (i + 1 < len) {
        const twoChar = expression.substring(i, i + 2);
        if (twoChar === '>=' || twoChar === '<=' || twoChar === '==' || twoChar === '!=') {
          tokens.push({ type: 'OPERATOR', value: twoChar });
          i += 2;
          continue;
        }
      }

      // Single character operators
      if (char === '+' || char === '-' || char === '*' || char === '/' || char === '>' || char === '<' || char === '=') {
        tokens.push({ type: 'OPERATOR', value: char });
        i++;
        continue;
      }

      if (char === '(') {
        tokens.push({ type: 'LPAREN', value: '(' });
        i++;
        continue;
      }

      if (char === ')') {
        tokens.push({ type: 'RPAREN', value: ')' });
        i++;
        continue;
      }

      if (char === ',') {
        tokens.push({ type: 'COMMA', value: ',' });
        i++;
        continue;
      }

      throw new Error(`Unexpected character in formula expression: '${char}' at index ${i}`);
    }

    return tokens;
  }

  /**
   * Extracts all referenced component codes from an expression.
   */
  static extractVariables(expression: string): string[] {
    const tokens = this.tokenize(expression);
    const vars = new Set<string>();

    for (const t of tokens) {
      if (t.type === 'IDENTIFIER' && !this.STANDARD_FUNCTIONS.has(t.value)) {
        vars.add(t.value);
      }
    }

    return Array.from(vars);
  }

  /**
   * Evaluates an expression using recursive descent parsing and Decimal.js arithmetic.
   * Completely free of eval() or Function().
   */
  static evaluate(expression: string, context: Record<string, Decimal | number | string>): Decimal {
    const tokens = this.tokenize(expression);
    let pos = 0;

    function peek(): Token | undefined {
      return tokens[pos];
    }

    function consume(expectedType?: string, expectedValue?: string): Token {
      const token = tokens[pos];
      if (!token) {
        throw new Error('Unexpected end of formula expression');
      }
      if (expectedType && token.type !== expectedType) {
        throw new Error(`Expected token type ${expectedType} but found ${token.type} (${token.value})`);
      }
      if (expectedValue && token.value !== expectedValue) {
        throw new Error(`Expected token value ${expectedValue} but found ${token.value}`);
      }
      pos++;
      return token;
    }

    // expression := comparison
    function parseExpression(): Decimal {
      return parseComparison();
    }

    // comparison := additive (('>' | '<' | '>=' | '<=' | '==' | '!=' | '=') additive)?
    function parseComparison(): Decimal {
      let left = parseAdditive();

      const next = peek();
      if (next && next.type === 'OPERATOR' && ['>', '<', '>=', '<=', '==', '!=', '='].includes(next.value)) {
        const op = consume().value;
        const right = parseAdditive();

        if (op === '>') {
          return left.greaterThan(right) ? new Decimal(1) : new Decimal(0);
        } else if (op === '<') {
          return left.lessThan(right) ? new Decimal(1) : new Decimal(0);
        } else if (op === '>=') {
          return left.greaterThanOrEqualTo(right) ? new Decimal(1) : new Decimal(0);
        } else if (op === '<=') {
          return left.lessThanOrEqualTo(right) ? new Decimal(1) : new Decimal(0);
        } else if (op === '==' || op === '=') {
          return left.equals(right) ? new Decimal(1) : new Decimal(0);
        } else if (op === '!=') {
          return !left.equals(right) ? new Decimal(1) : new Decimal(0);
        }
      }

      return left;
    }

    // additive := term (('+' | '-') term)*
    function parseAdditive(): Decimal {
      let result = parseTerm();

      while (pos < tokens.length) {
        const next = peek();
        if (next && next.type === 'OPERATOR' && (next.value === '+' || next.value === '-')) {
          const op = consume().value;
          const right = parseTerm();
          if (op === '+') {
            result = result.plus(right);
          } else {
            result = result.minus(right);
          }
        } else {
          break;
        }
      }

      return result;
    }

    // term := factor (('*' | '/') factor)*
    function parseTerm(): Decimal {
      let result = parseFactor();

      while (pos < tokens.length) {
        const next = peek();
        if (next && next.type === 'OPERATOR' && (next.value === '*' || next.value === '/')) {
          const op = consume().value;
          const right = parseFactor();
          if (op === '*') {
            result = result.times(right);
          } else {
            if (right.isZero()) {
              throw new Error('Division by zero in formula calculation');
            }
            result = result.dividedBy(right);
          }
        } else {
          break;
        }
      }

      return result;
    }

    // factor := primary | ('+' | '-') factor
    function parseFactor(): Decimal {
      const next = peek();
      if (next && next.type === 'OPERATOR' && (next.value === '+' || next.value === '-')) {
        const op = consume().value;
        const val = parseFactor();
        return op === '-' ? val.negated() : val;
      }
      return parsePrimary();
    }

    // primary := NUMBER | FUNCTION | VARIABLE | '(' expression ')'
    function parsePrimary(): Decimal {
      const token = peek();
      if (!token) {
        throw new Error('Unexpected end of formula');
      }

      if (token.type === 'NUMBER') {
        consume('NUMBER');
        return new Decimal(token.value);
      }

      if (token.type === 'LPAREN') {
        consume('LPAREN');
        const expr = parseExpression();
        consume('RPAREN');
        return expr;
      }

      if (token.type === 'IDENTIFIER') {
        const ident = consume('IDENTIFIER').value;

        // Check if it's a function call e.g. MIN(a, b), MAX(a, b), ROUND(a, b), IF(c, a, b)
        if (peek() && peek()!.type === 'LPAREN') {
          consume('LPAREN');
          const args: Decimal[] = [];
          if (peek() && peek()!.type !== 'RPAREN') {
            args.push(parseExpression());
            while (peek() && peek()!.type === 'COMMA') {
              consume('COMMA');
              args.push(parseExpression());
            }
          }
          consume('RPAREN');

          if (ident === 'MIN') {
            if (args.length === 0) throw new Error('MIN function requires at least 1 argument');
            return Decimal.min(...args);
          } else if (ident === 'MAX') {
            if (args.length === 0) throw new Error('MAX function requires at least 1 argument');
            return Decimal.max(...args);
          } else if (ident === 'ROUND') {
            if (args.length === 0) throw new Error('ROUND function requires argument');
            const decimals = args[1] ? args[1].toNumber() : 2;
            return args[0].toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
          } else if (ident === 'CEIL') {
            return args[0].ceil();
          } else if (ident === 'FLOOR') {
            return args[0].floor();
          } else if (ident === 'ABS') {
            return args[0].abs();
          } else if (ident === 'IF') {
            if (args.length < 3) throw new Error('IF function requires 3 arguments: IF(condition, trueVal, falseVal)');
            return !args[0].isZero() ? args[1] : args[2];
          } else {
            throw new Error(`Unsupported formula function: ${ident}`);
          }
        }

        // Variable lookup
        const val = context[ident];
        if (val === undefined || val === null) {
          // If variable not in context, default to 0 for optional/uncalculated components
          return new Decimal(0);
        }
        return new Decimal(val.toString());
      }

      throw new Error(`Unexpected token '${token.value}' of type ${token.type}`);
    }

    const finalResult = parseExpression();
    if (pos < tokens.length) {
      throw new Error(`Unexpected extra tokens after formula: '${tokens[pos].value}'`);
    }

    return finalResult;
  }

  /**
   * Detects circular dependencies among a set of components and formulas.
   * Returns null if valid (no cycles), or an array of component codes forming the cycle.
   */
  static detectCycle(components: Array<{ code: string; dependencies?: string[]; formula?: string }>): string[] | null {
    const adj = new Map<string, string[]>();
    for (const c of components) {
      let deps = c.dependencies || [];
      if (c.formula) {
        deps = Array.from(new Set([...deps, ...this.extractVariables(c.formula)]));
      }
      adj.set(c.code.toUpperCase(), deps.map(d => d.toUpperCase()));
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();
    const cyclePath: string[] = [];

    function dfs(node: string): boolean {
      visited.add(node);
      recStack.add(node);
      cyclePath.push(node);

      const neighbors = adj.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          cyclePath.push(neighbor);
          return true;
        }
      }

      recStack.delete(node);
      cyclePath.pop();
      return false;
    }

    for (const code of adj.keys()) {
      if (!visited.has(code)) {
        cyclePath.length = 0;
        if (dfs(code)) {
          return cyclePath;
        }
      }
    }

    return null;
  }

  static detectCycles(components: Array<{ code: string; dependencies?: string[]; formula?: string }>): string[] | null {
    return FormulaEngine.detectCycle(components);
  }

  /**
   * Topological sort of components based on their formula dependencies.
   * Ensures components are evaluated in the correct order.
   */
  static topologicalSort(components: Array<{ code: string; dependencies?: string[]; formula?: string }>): string[] {
    const cycle = this.detectCycle(components);
    if (cycle) {
      throw new Error(`Circular formula dependency detected: ${cycle.join(' ➔ ')}`);
    }

    const adj = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    for (const c of components) {
      const code = c.code.toUpperCase();
      if (!adj.has(code)) adj.set(code, []);
      if (!inDegree.has(code)) inDegree.set(code, 0);
    }

    for (const c of components) {
      const code = c.code.toUpperCase();
      let deps = c.dependencies || [];
      if (c.formula) {
        deps = Array.from(new Set([...deps, ...this.extractVariables(c.formula)]));
      }
      for (const dep of deps) {
        const depCode = dep.toUpperCase();
        if (adj.has(depCode)) {
          adj.get(depCode)!.push(code);
          inDegree.set(code, (inDegree.get(code) || 0) + 1);
        }
      }
    }

    const queue: string[] = [];
    for (const [code, deg] of inDegree.entries()) {
      if (deg === 0) queue.push(code);
    }

    const order: string[] = [];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      order.push(curr);
      for (const neighbor of adj.get(curr) || []) {
        const newDeg = (inDegree.get(neighbor) || 1) - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg === 0) queue.push(neighbor);
      }
    }

    return order;
  }
}
