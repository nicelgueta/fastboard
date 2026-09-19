import React from 'react';

/**
 * The live content width of an element (null until first measured), updated as
 * it resizes - e.g. as a dockview panel is dragged. Falls back to null where
 * ResizeObserver doesn't exist.
 */
export default function useElementWidth<T extends HTMLElement>(ref: React.RefObject<T>): number | null {
    const [width, setWidth] = React.useState<number | null>(null);
    React.useLayoutEffect(() => {
        const el = ref.current;
        if (!el || typeof ResizeObserver === 'undefined') return;
        setWidth(el.getBoundingClientRect().width);
        const observer = new ResizeObserver((entries) => {
            const w = entries[0]?.contentRect.width;
            if (w !== undefined) setWidth(w);
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, [ref]);
    return width;
}
