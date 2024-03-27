import { atom, SetterOrUpdater } from 'recoil';
import { Datasets, WidgetState, WidgetStates } from '../interfaces';

export const AllDatasetsState = atom({
    key: 'datasets',
    default: {} as Datasets,
});

export const AllWidgetStates = atom({
    key: 'widgetStates',
    default: {} as WidgetStates,
});

export const useWidgetState = (
    recoilStateHookInstance: [WidgetStates, SetterOrUpdater<WidgetStates>], 
    wKey: string
): [WidgetState, (newState: WidgetState)=>void] => {
    const [widgetStates, setWidgetStates] = recoilStateHookInstance;
    const widgetState = widgetStates?.[wKey]||{};
    const setWidgetState = (newState: WidgetState): void => {
        setWidgetStates({
            ...widgetStates,
            [wKey]: newState,
        });
    };
    return [widgetState, setWidgetState];
}
