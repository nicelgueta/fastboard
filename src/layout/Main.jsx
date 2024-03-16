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
import { ALL_WIDGETS, widgetObjReference } from '../widgets';

// nav
import NavHeader from '../nav/nav-header';
import NavMenu from '../nav/nav';


const DashboardContainer = ({
    appName,
}) => {

    const [isLargerThan1280] = useMediaQuery('(min-width: 1280px)');
    const [menuOpen, setMenuOpen] = React.useState(false);
    const toggleMenuOpen = () => setMenuOpen(!menuOpen);
    const [widgets, setWidgets] = React.useState([]);
    const [layout, setLayout] = React.useState([
        {i: "rg-header", x: 0, y: 0, w: 48, h: 2, static: true }
    ]);

    const colors = useAppColors();
    const {colorMode, } = useColorMode();
    
    // minor states
    const [snackOpen, setSnackOpen] = React.useState(false);
    const [ introOpen, setOpenIntro ] = React.useState(false);
    

    // React.useEffect(()=>{
    //     // if no widgets, add a default one
    //     if (widgets.length === 0){
    //         addWidget('testpad')
    //     }
    // }, [])

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

                // layout
                let newLayout = layout.filter(x=>x.i!==key)
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

        let wLayout = {...newWidgeDict.defaultLayout}
        wLayout['i'] = key
        
        let newlayout = [...layout].concat([wLayout])
        setLayout(newlayout)

        let newWidgets = [...widgets].concat([newWidgeDict])
        setWidgets(newWidgets)

    }
    const toggleStatic = (key) => {
        const widgeLayout = getLayout(key);
        const newWidgeLayout = {...widgeLayout, static: !widgeLayout.static};
        const newPageLayout = layout.filter(x=>x.i !== key);
        setLayout(newPageLayout.concat([newWidgeLayout]))
    }

    const getLayout = (key) => {
        for( let i = 0; i < layout.length; i++){ 
            if ( layout[i].i === key) {
                return layout[i]
            }
        }
    }

    // console.log(layout)
    // console.log(widgets)
    return (
        <Box w={"100%"} h={"100%"}>
            <title>{appName}</title>
            <GridLayout
                className="layout" 

                layout={layout}
                height={Math.min(1080, window.screen.availHeight)}
                // if on a phone, have each widget stacked on each other
                // the free desktop-style layout isn't user-friendly
                cols={isLargerThan1280 ? 48 : 1} 
                rowHeight={20} 
                width={Math.min(1920, window.screen.availWidth)}
                margin={[0,0]}
                preventCollision
                compactType={null}
                resizeHandles={
                    ['s', 'e', 'se', 'sw',  'nw', 'w', 'n']
                }
                onLayoutChange={(lo) => {
                    setLayout(lo)
                }}
            >
                <div 
                    key="rg-header" 
                    className='rg-header-nav'
                    style={{
                        borderRadius: 0,
                        // overflow: "auto",
                        justifyContent: "center",
                        borderColor: colors.foreQuarter,
                        borderWidth: 1,
                        zIndex: 4,            
                    }}
                >
                    <NavHeader 
                        toggleNav={toggleMenuOpen} 
                        menuOpen={menuOpen} 
                        addWidget={addWidget}
                        allWidgets={ALL_WIDGETS}
                        appName={appName}
                    />
                    <NavMenu navOpen={menuOpen} navClose={toggleMenuOpen} appName={appName} />
                </div>
                {
                    widgets.map((widgeDict,i)=>
                    <div 
                        key={widgeDict.key}
                        style={{
                            borderRadius: 0,
                            backgroundColor: colors.bg,
                            // overflow: "auto",
                            justifyContent: "center",
                            height:"100%",
                            width: "100%",
                            borderColor: colors.bg,
                            // borderWidth: 1
                        }}
                    >
                        <WidgetContainer 
                            name={widgeDict.name}
                            wKey={widgeDict.key}
                            settings={widgeDict.settings}
                            isStatic={getLayout(widgeDict.key).static}
                            WidgetElement={widgetObjReference[widgeDict.type]}
                            removeWidget={removeWidget}
                            toggleStatic={toggleStatic}
                        />
                    </div>)
                }
            </GridLayout>
        </Box>
    )
}

export default DashboardContainer;