import React from 'react';

export const useKey = (key: string, cb: (event: KeyboardEvent) => void): void => {
    const callback = React.useRef(cb);

    React.useEffect(() => {
        callback.current = cb;
    });

    React.useEffect(() => {
        function handle(event: KeyboardEvent): void {
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
