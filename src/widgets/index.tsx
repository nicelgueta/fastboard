import React from 'react';
import {
    Text
} from '@chakra-ui/react';

// Widgets

// Components
import TextSearch from '../components/TextSearch';

import { BaseWidgetDict, BaseLayout } from '../interfaces';


export const DEFAULT_LAYOUT: BaseLayout = {
    x: 12,
    y: 2,
    minW: 7,
    w: 10,
    maxW: 20,
    minH: 8,
    h: 10,
    maxH: 96,
    static: false
}

export const ALL_WIDGETS: BaseWidgetDict[] = [
    {
        type: 'testpad',
        disabled: false,
        name: 'TestPad',
        description: `
            This is a blank widget. You can add more widgets by clicking the 
            "Add Widget" button in the top right corner of the screen.
        `,
        maxNo: 20,
        defaultLayout:{
            ...DEFAULT_LAYOUT,
            minW: 7,
            w: 20,
            maxW: 20,
            minH: 8,
            h: 20,
            maxH: 96,
            static: false
        },
        settings:[]
    }
]

export const widgetObjReference: { [key: string]: React.FC } = {
    testpad: () => <h1>Some WIdge</h1>
}