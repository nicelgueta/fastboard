import { describe, expect, it } from 'vitest';
import { clampSize, defaultSize, dockComesFirst, isSideDock, normalizeDock, sizeFromPointer } from './dock';

const body = { left: 100, top: 50, right: 700, bottom: 450 }; // 600 wide, 400 tall

describe('dock', () => {
    it('knows which docks are side-by-side and which come first', () => {
        expect(['bottom', 'top', 'left', 'right'].map((d) => isSideDock(d as never))).toEqual([false, false, true, true]);
        expect(['bottom', 'top', 'left', 'right'].map((d) => dockComesFirst(d as never))).toEqual([false, true, true, false]);
    });

    it('falls back to the bottom for a value that is not a dock', () => {
        expect(normalizeDock('right')).toBe('right');
        expect(normalizeDock('diagonal')).toBe('bottom');
        expect(normalizeDock(undefined)).toBe('bottom');
    });

    it('starts narrow beside the code and short under it', () => {
        expect(defaultSize('right')).toBeGreaterThan(defaultSize('bottom'));
    });
});

describe('sizeFromPointer', () => {
    it('measures from the docked edge to the pointer', () => {
        expect(sizeFromPointer('bottom', body, 400, 350)).toBe(100); // 450 - 350
        expect(sizeFromPointer('top', body, 400, 130)).toBe(80);     // 130 - 50
        expect(sizeFromPointer('right', body, 600, 200)).toBe(100);  // 700 - 600
        expect(sizeFromPointer('left', body, 260, 200)).toBe(160);   // 260 - 100
    });
});

describe('clampSize', () => {
    it('keeps the zone above its minimum', () => {
        expect(clampSize('bottom', 10, body)).toBe(80);
        expect(clampSize('right', 10, body)).toBe(160);
    });

    it('always leaves the code some room', () => {
        expect(clampSize('bottom', 9999, body)).toBe(280); // 400 tall - 120 for the code
        expect(clampSize('left', 9999, body)).toBe(480);   // 600 wide - 120
    });

    it('a widget too small for both still gets the minimum, not a negative size', () => {
        const tiny = { left: 0, top: 0, right: 100, bottom: 100 };
        expect(clampSize('bottom', 50, tiny)).toBe(80);
        expect(clampSize('right', 50, tiny)).toBe(160);
    });

    it('rounds to whole pixels', () => {
        expect(clampSize('bottom', 150.6, body)).toBe(151);
    });
});
