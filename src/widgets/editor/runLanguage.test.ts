import { describe, expect, it } from 'vitest';
import { isRunnableLanguage, languageForEngine } from './runLanguage';

describe('languageForEngine', () => {
    it('maps each engine to its own language', () => {
        expect(languageForEngine('qpl')).toBe('qpl');
        expect(languageForEngine('duckdb')).toBe('sql');
    });

    it('has no answer for an unlinked table or an engine without an editor language', () => {
        expect(languageForEngine(undefined)).toBeUndefined();
        expect(languageForEngine('snowflake')).toBeUndefined();
    });
});

describe('isRunnableLanguage', () => {
    it('is true only for SQL and qpl', () => {
        expect(isRunnableLanguage('sql')).toBe(true);
        expect(isRunnableLanguage('qpl')).toBe(true);
        expect(isRunnableLanguage('json')).toBe(false);
        expect(isRunnableLanguage('javascript')).toBe(false);
    });
});
