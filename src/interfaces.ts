import { componentType } from "./components/common";


export interface WidgetSetting {
    label: string;
    settingsKey: string;
    tooltip?: string;
    type: string;
    options?: SelectOption[];
    default?: number | string | boolean;
    inputTyp?: componentType;
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

export interface WidgetDict extends BaseWidgetDict {
    key: string
    typeNumber: number;
    currentSettings?: Record<string, string | number | boolean | undefined>;
}

export interface BaseLayout {
    x: number;
    y: number;

    minW?: number;
    w: number;
    maxW?: number;

    minH?: number;
    h: number;
    maxH?: number;

    static: boolean;
}

export interface Layout extends BaseLayout {
    i: string;
}

export interface Board {
    name: string;
    key: string;
    widgets: WidgetDict[];
    layout: Layout[];
}

export interface SelectOption {
    label: string;
    value: string | number;
}