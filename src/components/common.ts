
export type componentType = 'success' | 'warning' | 'fail' | 'info';
export const stopPropagation = (event) => {
    // fixes bug in fullscreen mode that prevent interaction with widgets
    // instead interpreting every click as a drag event
    event.stopPropagation();
};
