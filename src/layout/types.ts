import { WidgetSetting } from '../interfaces';

// The `params` shape stored on every widget's dockview panel. This is what
// gets serialized/restored via SerializedDockview, so it fully describes
// how to re-render both the panel's tab and its content.
export interface WidgetPanelParams {
    widgetType: string;
    name: string;
    settingsConfig: WidgetSetting[];
    currentSettings?: Record<string, any>;
}

export const getDefaultSettings = (settingsConfig: WidgetSetting[]): Record<string, any> => {
    const defaults: Record<string, any> = {};
    settingsConfig.forEach((setting) => {
        defaults[setting.settingsKey] = setting.default;
    });
    return defaults;
};
