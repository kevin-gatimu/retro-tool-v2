import { deepMerge, isPlainObject } from './utils';

describe('isPlainObject', () => {
  it('accepts plain objects', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({ a: 1 })).toBe(true);
  });

  it('rejects arrays, null, and primitives', () => {
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject('x')).toBe(false);
    expect(isPlainObject(5)).toBe(false);
  });
});

describe('deepMerge', () => {
  it('merges nested objects without clobbering sibling keys', () => {
    // This is the core guarantee for uiPreferences: patching one page's view
    // must not wipe the other page's view.
    const existing = {
      sessionViews: {
        retros: { sort: 'recent', layout: 'cards' },
        estimates: { sort: 'name' },
      },
    };
    const patch = {
      sessionViews: { retros: { sort: 'oldest' } },
    };

    expect(deepMerge(existing, patch)).toEqual({
      sessionViews: {
        retros: { sort: 'oldest', layout: 'cards' },
        estimates: { sort: 'name' },
      },
    });
  });

  it('replaces arrays wholesale rather than concatenating', () => {
    const existing = { favorites: ['a', 'b'] };
    const patch = { favorites: ['c'] };
    expect(deepMerge(existing, patch)).toEqual({ favorites: ['c'] });
  });

  it('does not mutate the original target', () => {
    const existing = { a: { b: 1 } };
    const patch = { a: { c: 2 } };
    deepMerge(existing, patch);
    expect(existing).toEqual({ a: { b: 1 } });
  });

  it('overwrites primitives and adds new keys', () => {
    expect(deepMerge({ a: 1, b: 2 }, { a: 9, c: 3 })).toEqual({
      a: 9,
      b: 2,
      c: 3,
    });
  });
});
