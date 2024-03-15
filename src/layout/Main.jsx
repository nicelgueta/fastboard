import React from 'react';
import {
    useColorMode,
    useMediaQuery,
    IconButton,
    ButtonGroup,
    HStack,
    VStack,
    Box,
    Text,

} from '@chakra-ui/react';
import { stopPropagation } from '../hooks/stoppropagation';
import { Icon, Tooltip } from '@chakra-ui/react'
import { AiFillEye, AiFillPushpin } from 'react-icons/ai';
import GridLayout from 'react-grid-layout';
import useAppColors from '../hooks/colors';
import WidgetContainer from './WidgetContainer';

// widgets
import RedditFeed from '../widgets/Reddit';

const ALL_WIDGETS = [
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
        type: 'default',
        disabled: false,
        name: 'Blank',
        description: `
            This is a blank widget. You can add more widgets by clicking the 
            "Add Widget" button in the top right corner of the screen.
        `,
        maxNo: 20,
        maxH: 96,
        w: 10,
        h: 10,
        minW: 7,
        minH: 8,
        settings:[]
    }
]

const widgetObjReference = {
    redditStream: RedditFeed,
    default: () => <Text>Blank</Text>
}

const DashboardContainer = ({
    appName,
}) => {

    const [isLargerThan1280] = useMediaQuery('(min-width: 1280px)');

    const [widgets, setWidgets] = React.useState([]);
    const [layout, setLayout] = React.useState([]);

    const colors = useAppColors();
    const {colorMode, } = useColorMode();
    
    // minor states
    const [snackOpen, setSnackOpen] = React.useState(false);
    const [ introOpen, setOpenIntro ] = React.useState(false);
    

    React.useEffect(()=>{
        // if no widgets, add a default one
        if (widgets.length === 0){
            addWidget('default')
        }
    }, [])

    const removeWidget = (key) => {

        // TODO: fix widget key nos if one in middle gets deleted
        // change key ID to be OT generatred rather than sequenntial to avoid making changes to existing widgets
        console.log('removing widget: '+key)
        for( let i = 0; i < widgets.length; i++){ 
    
            if ( widgets[i].key === key) {
                // widgets
                let newWidgets = [].concat(widgets)
                newWidgets.splice(i, 1);
                setWidgets(newWidgets)
            }
        
        }
        // layout
        for( let i = 0; i < layout.length; i++){ 
            if ( layout[i].i === key) {
                let newLayout = [].concat(layout)
                newLayout.splice(i, 1);
                setLayout(newLayout)
            }
        }
    }
    const addWidget = (type) => {
        const widgeDict = ALL_WIDGETS.filter(x=>x.type===type)[0]
        // console.log('got type: '+widgeDict.type)
        let newWidgeDict = {...widgeDict}
        // check how many widgets we already have of this type
        const noExisting = widgets.filter(x=>x.type===newWidgeDict.type).length
        // debugger;
        if(noExisting>=newWidgeDict.maxNo){
            setSnackOpen(true)
            return 
        }
        const widgeTypeNumber = new Date().getTime() // generate random integer to not clash with others
        const key = newWidgeDict.type + '-' + widgeTypeNumber;
        // console.log('Key: '+key)
        newWidgeDict['typeNumber'] = widgeTypeNumber
        newWidgeDict['key'] = key;
        // console.log(widgets)
        // make update
        const newLayoutItem = {
            i: key, 
            x: 12, 
            y: 0, 
            w: newWidgeDict.w || 15, 
            h: newWidgeDict.h || 10, 
            minH: newWidgeDict.minH || 5, 
            minW: newWidgeDict.minW || 5,
            maxH: newWidgeDict.maxH || 20, 
            maxW: newWidgeDict.maxW || 30,
            static: false
            
        };
        let newlayout = [...layout].concat([newLayoutItem])
        setLayout(newlayout)
        let newWidgets = [...widgets].concat([newWidgeDict])
        setWidgets(newWidgets)

    }
    const toggleStatic = (key) => {
        const mainLayout = layout.filter(x=>x.i === key)[0];
        const newMainLayout = {...mainLayout, static: !mainLayout.static};
        const newPageLayout = layout.filter(x=>x.i !== key);
        setLayout(newPageLayout.concat([newMainLayout]));
    }
    console.log('layout: '+JSON.stringify(layout))
    console.log('widgets: '+JSON.stringify(widgets))
    return (
        <>
        <title>{appName}</title>
        <Box w={"100%"} h={"100%"}>
            <GridLayout
                    className="layout" 
                    layout={layout}
                    
                    // if on a phone, have each widget stacked on each other
                    // the free desktop-style layout isn't user-friendly
                    cols={isLargerThan1280 ? 48 : 1} 
                    rowHeight={20} 
                    width={isLargerThan1280 ? 1920 : window.screen.availWidth}
                    margin={[1,1]}
                    preventCollision
                    compactType={null}
                    onLayoutChange={(newLayout)=>setLayout(newLayout)}
            >
                {
                    widgets.map((widgeDict,i)=>
                    <div 
                        style={{
                            borderRadius: 0,
                            backgroundColor: colors.bg,
                            // overflow: "auto",
                            justifyContent: "center",
                            height:"100%",
                            width: "100%",
                            borderColor: colors.foreQuarter,
                            borderWidth: 1
                        }}  
                        key={widgeDict.key}
                    >
                        {<WidgetContainer 
                            {...widgeDict}
                            wKey={widgeDict.key}
                            WidgetElement={widgetObjReference[widgeDict.type]}
                            widgetLayout={layout.filter(x=>x.i===widgeDict.key)[0]}
                            removeWidget={removeWidget}
                            toggleStatic={toggleStatic}
                        />}
                    </div>
                    )
                }
            </GridLayout>
        </Box>
        </>
    )
}

export default DashboardContainer;