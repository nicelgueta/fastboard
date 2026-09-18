import React from 'react';

/** True when the keystroke belongs to an editable surface the user is typing into. */
const isTypingTarget = (target: EventTarget | null): boolean => {
    const el = target as HTMLElement | null;
    if (!el || typeof el.tagName !== 'string') return false;
    const tag = el.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if (el.isContentEditable === true) return true;
    if (typeof el.closest !== 'function') return false;
    // Monaco (>=0.55) uses the EditContext API: its editable surface is a
    // <div class="native-edit-context"> which is NOT contentEditable and so
    // matches none of the checks above. Treat any keystroke originating inside
    // an editor instance as typing. Without this, a bare "1" fires the Boards
    // hotkey mid-keystroke and steals focus out of the code editor.
    return el.closest('.monaco-editor, [contenteditable="true"], [contenteditable=""]') !== null;
};

export const useKey = (key: string, cb: (event: KeyboardEvent) => void): void => {
    const callback = React.useRef(cb);

    React.useEffect(() => {
        callback.current = cb;
    });

    React.useEffect(() => {
        function handle(event: KeyboardEvent): void {
            // These are global shortcuts on `document`, so without this guard a
            // bare key like "1" fires while the user is typing - stealing focus
            // mid-keystroke in the code editor, the expression builder or any
            // input. See isTypingTarget for the editor-specific case.
            if (isTypingTarget(event.target)) {
                return;
            }
            if (event.code === key) {
                callback.current(event);
            } else if (key === 'ctrlc' && event.key === 'c' && event.ctrlKey) {
                callback.current(event);
            }
        }

        document.addEventListener('keydown', handle);
        return () => document.removeEventListener('keydown', handle);
    }, [key]);
}
