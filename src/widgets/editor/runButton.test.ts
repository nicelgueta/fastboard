import { describe, expect, it } from 'vitest';
import { FULL_LABEL_MIN_WIDTH, SHORT_LABEL_MIN_WIDTH, runLabelMode } from './runButton';

describe('runLabelMode', () => {
    it('shows the full label when there is room', () => {
        expect(runLabelMode(FULL_LABEL_MIN_WIDTH)).toBe('full');
        expect(runLabelMode(1400)).toBe('full');
    });

    it('drops to "Run" as the widget narrows, then to the icon alone', () => {
        expect(runLabelMode(FULL_LABEL_MIN_WIDTH - 1)).toBe('short');
        expect(runLabelMode(SHORT_LABEL_MIN_WIDTH)).toBe('short');
        expect(runLabelMode(SHORT_LABEL_MIN_WIDTH - 1)).toBe('icon');
        expect(runLabelMode(0)).toBe('icon');
    });

    it('assumes room until the toolbar has been measured', () => {
        expect(runLabelMode(null)).toBe('full');
    });
});
