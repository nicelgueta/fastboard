

const DashboardContainer = (props) => {

    const [isLargerThan1280] = useMediaQuery('(min-width: 1280px)');

    // major states
    const widgets = props.widgets // [];


    const colors = useCryptoColors();
    const {colorMode, } = useColorMode();
    

    const layout =  props.layout //[ 
    //     {i: 'main', x: 0, y: 0, w: 12, h: 12, static: true ,minH:12, minW: 5,maxH: 12, maxW: 5},
    // //     {i: 'tradingview', x: 5, y: 0, w: 7, h: 12, minH:10, minW: 4, maxH: 20, maxW: 10},
    // //     {i: 'cryptopanic', x: 0, y: 12, w: 5, h: 10, minH: 5, minW: 3, maxH: 20, maxW: 10}
    //   ]

    // minor states
    const [snackOpen, setSnackOpen] = React.useState(false);
    const [ introOpen, setOpenIntro ] = React.useState(false);
    const hideWelcomeText = props.hideWelcomeText

    const removeWidget = (key) => {

        // TODO: fix widget key nos if one in middle gets deleted
        // change key ID to be OT generatred rather than sequenntial to avoid making changes to existing widgets

        for( let i = 0; i < widgets.length; i++){ 
    
            if ( widgets[i].key === key) {
                // widgets
                let newWidgets = [].concat(widgets)
                newWidgets.splice(i, 1);
                props.setWidgets(newWidgets)
            }
        
        }
        // layout
        for( let i = 0; i < layout.length; i++){ 
            if ( layout[i].i === key) {
                let newLayout = [].concat(layout)
                newLayout.splice(i, 1);
                props.setLayout(newLayout)
            }
        }
    }
    const addWidget = (widgeDict) => {
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
        newWidgeDict['widgeTypeNumber'] = widgeTypeNumber
        newWidgeDict['key'] = key;
        // console.log(widgets)
        // make update
        const newLayoutItem = {
            i: key, 
            x: 24, 
            y: 0, 
            w: newWidgeDict.w || 15, 
            h: newWidgeDict.h || 10, 
            minH: newWidgeDict.minH || 5, 
            minW: newWidgeDict.minW || 5,
            maxH: newWidgeDict.maxH || 20, 
            maxW: newWidgeDict.maxW || 30
        };
        let newlayout = [...layout].concat([newLayoutItem])
        props.setLayout(newlayout)
        let newWidgets = [...widgets].concat([newWidgeDict])
        props.setWidgets(newWidgets)

    }
    const toggleStatic = () => {
        const mainLayout = layout.filter(x=>x.i === "main")[0];
        const newMainLayout = {...mainLayout, static: !mainLayout.static};
        const newPageLayout = layout.filter(x=>x.i !== "main");
        props.setLayout(newPageLayout.concat([newMainLayout]));
    }
}