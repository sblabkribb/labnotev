import { escapeRegExp } from '../../lib/regexUtils';

describe('escapeRegExp', () => {
  it('escapes regex metacharacters so they are matched literally', () => {
    const input = 'DNA-1.2';
    const escaped = escapeRegExp(input);
    const re = new RegExp(escaped);
    // Must only match the literal string, not "DNA-1X2"
    expect(re.test('DNA-1.2')).toBe(true);
    expect(re.test('DNA-1X2')).toBe(false);
  });

  it('escapes all PCRE-style metacharacters', () => {
    const meta = '.*+?^${}()|[]\\';
    const escaped = escapeRegExp(meta);
    // The escaped result should turn into a regex that matches the original string verbatim.
    const re = new RegExp(`^${escaped}$`);
    expect(re.test(meta)).toBe(true);
  });

  it('does not alter safe alphanumeric / hyphen strings', () => {
    expect(escapeRegExp('DNA-1737123456789')).toBe('DNA-1737123456789');
  });

  it('escapes inside a sample id with parentheses embedded (user-typed alias)', () => {
    const userInput = 'DNA-1 (old)';
    const re = new RegExp(escapeRegExp(userInput));
    expect(re.test('DNA-1 (old)')).toBe(true);
    expect(re.test('DNA-1 old')).toBe(false);
  });
});
