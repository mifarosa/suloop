import { describe, expect, it } from 'vitest';
import {
  codeInLink,
  decodeProgressCode,
  encodeProgressCode,
  progressLink
} from '../src/app/progressCode.js';

describe('progress codes', () => {
  it('carry the solved count there and back', () => {
    for (const solved of [0, 1, 14, 60, 79, 924, 123_456]) {
      expect(decodeProgressCode(encodeProgressCode(solved))).toBe(solved);
    }
  });

  it('are short and easy to read', () => {
    expect(encodeProgressCode(79)).toMatch(/^[0-9A-HJKMNP-TV-Z]{5}$/);
    expect(encodeProgressCode(5000).length).toBeLessThanOrEqual(6);
  });

  it('are read the way people type them', () => {
    const code = encodeProgressCode(79);
    const typed = ` ${code.slice(0, 2)}-${code.slice(2)} `.toLowerCase();
    expect(decodeProgressCode(typed)).toBe(79);
  });

  it('take the letters O, I and L for the digits they look like', () => {
    const code = encodeProgressCode(60);
    const misread = code.replace(/0/g, 'O').replace(/1/g, 'I');
    expect(decodeProgressCode(misread)).toBe(60);
  });

  it('catch a mistyped character', () => {
    const code = encodeProgressCode(79);
    for (let i = 0; i < code.length; i++) {
      const digit = code[i] === 'Z' ? 'Y' : 'Z';
      expect(decodeProgressCode(code.slice(0, i) + digit + code.slice(i + 1))).toBeNull();
    }
  });

  it('turn down anything that is not a code', () => {
    for (const text of ['', '   ', 'U', 'merhaba!', '0123456789AB']) {
      expect(decodeProgressCode(text)).toBeNull();
    }
  });
});

describe('progress links', () => {
  it('put the code after the address of the game', () => {
    const link = progressLink('https://mifarosa.com/suloop/', '2FQ7M');
    expect(link).toBe('https://mifarosa.com/suloop/#ilerleme=2FQ7M');
    expect(codeInLink(link)).toBe('2FQ7M');
  });

  it('replace whatever was after the address before', () => {
    expect(progressLink('https://mifarosa.com/suloop/#x', 'AB')).toBe(
      'https://mifarosa.com/suloop/#ilerleme=AB'
    );
  });

  it('are told apart from other addresses', () => {
    expect(codeInLink('https://mifarosa.com/suloop/')).toBeNull();
    expect(codeInLink('https://mifarosa.com/suloop/#baska=1')).toBeNull();
    expect(codeInLink('https://mifarosa.com/suloop/#ilerleme=%E0')).toBe('');
  });
});
