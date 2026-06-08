import { describe, it, expect } from 'vitest';
import {
  slugify,
  truncate,
  capitalize,
  toTitleCase,
  camelToSnake,
  snakeToCamel,
  deriveProjectKey,
  parseMentions,
  stripMentionMarkup,
  maskEmail,
  pluralize,
  normalizeWhitespace,
  tokenize,
} from '../../src/shared/strings';

describe('strings', () => {
  describe('slugify', () => {
    it('lowercases and hyphenates', () => {
      expect(slugify('Hello World')).toBe('hello-world');
    });

    it('collapses runs of separators and trims edges', () => {
      expect(slugify('  Foo --- Bar!!  ')).toBe('foo-bar');
    });

    it('strips diacritics', () => {
      expect(slugify('Café Déjà')).toBe('cafe-deja');
    });

    it('caps the output at 64 characters', () => {
      expect(slugify('a'.repeat(100)).length).toBe(64);
    });
  });

  describe('truncate', () => {
    it('returns the input unchanged when within the limit', () => {
      expect(truncate('short', 10)).toBe('short');
    });

    it('truncates and appends the suffix', () => {
      // maxLength 8, default suffix '…' (length 1) -> slice(0, 7) = 'hello w'
      expect(truncate('hello world', 8)).toBe('hello w…');
    });

    it('supports a custom suffix', () => {
      expect(truncate('hello world', 9, '...')).toBe('hello...');
    });
  });

  describe('capitalize', () => {
    it('uppercases the first character', () => {
      expect(capitalize('hello')).toBe('Hello');
    });

    it('returns the input untouched when empty', () => {
      expect(capitalize('')).toBe('');
    });
  });

  describe('toTitleCase', () => {
    it('capitalizes each word and lowercases the rest', () => {
      expect(toTitleCase('the QUICK brown FOX')).toBe('The Quick Brown Fox');
    });
  });

  describe('camelToSnake / snakeToCamel', () => {
    it('converts camelCase to snake_case', () => {
      expect(camelToSnake('createdAtTime')).toBe('created_at_time');
    });

    it('converts snake_case to camelCase', () => {
      expect(snakeToCamel('created_at_time')).toBe('createdAtTime');
    });

    it('round-trips', () => {
      expect(snakeToCamel(camelToSnake('someFieldName'))).toBe('someFieldName');
    });
  });

  describe('deriveProjectKey', () => {
    it('uses initials of multiple words', () => {
      expect(deriveProjectKey('Mobile Application Platform')).toBe('MAP');
    });

    it('takes the first three letters of a single word, padded', () => {
      expect(deriveProjectKey('Mobile')).toBe('MOB');
      expect(deriveProjectKey('Go')).toBe('GOX');
    });

    it('falls back to PRJ when no usable characters remain', () => {
      expect(deriveProjectKey('!!!')).toBe('PRJ');
    });

    it('caps initials at three words', () => {
      expect(deriveProjectKey('one two three four five')).toBe('OTT');
    });
  });

  describe('parseMentions', () => {
    it('extracts structured mentions', () => {
      const body = 'Hey @[Alice](user:11111111-1111-1111-1111-111111111111) and @[Bob](user:22222222-2222-2222-2222-222222222222)';
      expect(parseMentions(body)).toEqual([
        { display: 'Alice', userId: '11111111-1111-1111-1111-111111111111' },
        { display: 'Bob', userId: '22222222-2222-2222-2222-222222222222' },
      ]);
    });

    it('deduplicates repeated user ids', () => {
      const body = '@[Alice](user:aaaa1111-1111-1111-1111-111111111111) @[Alice again](user:aaaa1111-1111-1111-1111-111111111111)';
      const mentions = parseMentions(body);
      expect(mentions).toHaveLength(1);
      expect(mentions[0].userId).toBe('aaaa1111-1111-1111-1111-111111111111');
    });

    it('returns an empty array when there are no mentions', () => {
      expect(parseMentions('plain text')).toEqual([]);
    });

    it('is stable when called twice (lastIndex reset)', () => {
      const body = '@[Alice](user:11111111-1111-1111-1111-111111111111)';
      expect(parseMentions(body)).toEqual(parseMentions(body));
    });
  });

  describe('stripMentionMarkup', () => {
    it('replaces markup with a plain @display', () => {
      const body = 'cc @[Alice](user:11111111-1111-1111-1111-111111111111)!';
      expect(stripMentionMarkup(body)).toBe('cc @Alice!');
    });
  });

  describe('maskEmail', () => {
    it('masks the local part keeping the first two characters', () => {
      expect(maskEmail('alice@example.com')).toBe('al***@example.com');
    });

    it('masks short local parts to a single character', () => {
      expect(maskEmail('ab@x.io')).toBe('a***@x.io');
    });

    it('returns the input when there is no @', () => {
      expect(maskEmail('not-an-email')).toBe('not-an-email');
    });
  });

  describe('pluralize', () => {
    it('uses the singular for a count of one', () => {
      expect(pluralize(1, 'task')).toBe('1 task');
    });

    it('appends s by default for other counts', () => {
      expect(pluralize(0, 'task')).toBe('0 tasks');
      expect(pluralize(3, 'task')).toBe('3 tasks');
    });

    it('uses an explicit plural form when provided', () => {
      expect(pluralize(2, 'person', 'people')).toBe('2 people');
    });
  });

  describe('normalizeWhitespace', () => {
    it('collapses internal whitespace and trims', () => {
      expect(normalizeWhitespace('  a\t b\n  c  ')).toBe('a b c');
    });
  });

  describe('tokenize', () => {
    it('lowercases, splits on non-alphanumerics and drops 1-char tokens', () => {
      expect(tokenize('Fix the DB-stale bug, ASAP!')).toEqual([
        'fix',
        'the',
        'db',
        'stale',
        'bug',
        'asap',
      ]);
    });
  });
});
