import { describe, expect, it } from 'vitest';
import { lastRowFor } from './paging';

describe('lastRowFor', () => {
    it('reports the total whatever block is being loaded', () => {
        expect(lastRowFor(1234)).toBe(1234);
        expect(lastRowFor(25)).toBe(25);
    });

    it('an empty result is a known total of zero, not an unknown one', () => {
        expect(lastRowFor(0)).toBe(0);
    });

    it('is undefined only when the total genuinely is not known', () => {
        expect(lastRowFor(undefined)).toBeUndefined();
        expect(lastRowFor(NaN)).toBeUndefined();
        expect(lastRowFor(-1)).toBeUndefined();
    });
});
