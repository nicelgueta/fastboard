import {
    Text
} from '@chakra-ui/react';

// widgets
import RedditFeed from './Reddit';

// components
import TextSearch from '../components/TextSearch';


export const DEFAULT_LAYOUT = {
    x: 12,
    y: 2,

    minW: 7,
    w: 10,
    maxW: 20,

    minH: 8,
    h: 10,
    maxH: 96,

}

export const ALL_WIDGETS = [
    {
        type: 'redditStream',
        disabled: false,
        name: 'Reddit Stream',
        description: `
            Configure a live stream for data from reddit. Future
            functionality for this tool will allow you to 
            perform more advanced analytics such as VADER sentiment analysis and 
            real-time aggregation.`,
        maxNo: 20,
        maxH: 96,
        w: 10,
        h: 10,
        minW: 7,
        minH: 8,
        settings:[
            {
                label: "Search terms",
                settingsKey: "q",
                tooltip: `
                    Enter any number of search terms here. Max characters 512.
                    This is the only mandatory field.
                `,
                type: "free_text",
                default: ""
            },
            {
                label: "Max number of posts",
                settingsKey: "limit",
                type: "select",
                options: [1,2,5,10,15,20,25,30,50,100],
                default: 25
            },
            {
                label: "Sort by",
                settingsKey: "sort",
                type: "select",
                options: ["relevance", "hot", "top", "new", "comments"],
                default: "relevance"
            },
            {
                label: "From last",
                settingsKey: "t",
                type: "select",
                options: ["hour", "day", "week", "month", "year", "all"],
                default: "day"
            },

        ]
    },
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


export const widgetObjReference = {
    redditStream: RedditFeed,
    testpad: () => <h1>Some WIdge</h1>
}   