import type { SerializedDockview } from 'dockview-react';

export type componentType = 'success' | 'warning' | 'fail' | 'info';
export type settingType = 'input' | 'number' | 'select' | 'switch' | 'multiSelect' | 'slider' | 'textarea' | 'date';

export type Dataset = Record<string, any>[];

export interface Datasets {
    [wKey: string]: Dataset;
}
export interface WidgetState {
    name: string;
    [key: string]: any;
}

export interface WidgetStates {
    [wKey: string]: WidgetState;

}

export interface WidgetSetting {
    label: string;
    settingsKey: string;
    tooltip?: string;
    type: settingType;
    options?: SelectOption[];
    required?: boolean;
    optionsFetch?: () => SelectOption[];
    default?: number | string | boolean;
    inputTyp?: componentType;
    min?: number;
    max?: number;
    step?: number;
}

export interface BaseWidgetDict {
    type: string;
    disabled: boolean;
    name: string;
    description: string;
    maxNo: number;
    settings: WidgetSetting[];
    defaultLayout: BaseLayout
}
export type WidgetConfig = BaseWidgetDict[];
export type WidgetComponentMapping = Record<string, React.FC<WidgetElementProps>>;

export interface WidgetDict extends BaseWidgetDict {
    key: string
    typeNumber: number;
    currentSettings?: Record<string, string | number | boolean | undefined>;
}

export interface BaseLayout {
    // initial size (in pixels) for a widget's dockview panel when it is
    // first added - dockview owns positioning/resizing/docking thereafter.
    initialWidth?: number;
    initialHeight?: number;
}

export interface Board {
    name: string;
    key: string;
    widgets: WidgetDict[];
    layout: SerializedDockview;
    widgetStates: WidgetStates;
}

export interface SelectOption {
    label: string;
    value: string | number;
}

export interface WidgetElementProps {
    wKey: string;
    settingsIsOpen: boolean;
    containerRef: React.RefObject<HTMLDivElement>;
    isStatic: boolean;
}