

export interface WidgetSetting {
    label: string;
    settingsKey: string;
    tooltip?: string;
    type: string;
    options?: (number | string)[];
    default: number | string;
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

export interface SavedBoard {
    key: string;
    name: string;
    widgets: WidgetDict[];
    layout: Layout[];
}