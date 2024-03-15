import React from "react";
import useAppColors from "../hooks/colors";
import Axios from "axios";
import { 
    Badge, 
    Box, 
    Center, 
    HStack, 
    Icon, 
    Image, 
    Link, 
    Progress,
    Modal,
    ModalBody,
    ModalCloseButton,
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalOverlay,
    Spinner,
    StackDivider,
    Text, 
    VStack, 
    useColorMode,
    Button
} from "@chakra-ui/react";
import { AiOutlineArrowDown, AiOutlineArrowUp } from "react-icons/ai";
import { stopPropagation } from "../hooks/stoppropagation";

const getTimeDiff = (currentTime, postTime) => {
    const timeDiffSeconds = currentTime - postTime
    let timeDiff;

    if (timeDiffSeconds < 60){
        timeDiff = "just now"
    } else if (timeDiffSeconds < 3600){
        timeDiff = `${Math.floor(timeDiffSeconds/60)} minute(s) ago`
    } else if (timeDiffSeconds < 86400){
        timeDiff = `${Math.floor(timeDiffSeconds/3600)} hour(s) ago`
    } else {
        timeDiff = `${Math.floor(timeDiffSeconds/86400)} day(s) ago`
    }
    return timeDiff;
}

const FeedItem = ({ data, openPreview }) => {
    const dataItem = data.data;
    const postTime = dataItem.created
    const currentTime = Math.floor(new Date().getTime() / 1000);
    const timeDiff = getTimeDiff(currentTime, postTime)

    const colors = useAppColors();
    return (
        <VStack 
            padding={1} 
            w="-webkit-fill-available"
            onMouseDown={stopPropagation}
            onTouchStart={stopPropagation}
            h="100%"
        >
            <HStack spacing={2} w="-webkit-fill-available" >
                <Box w="100%" justifyItems={"flex-start"}>
                    <HStack w="100%" alignItems="baseline">
                        <Link 
                            fontSize="sm"
                            isExternal={true}
                            href={`https://reddit.com${dataItem.permalink}`}
                            color={colors.foreActive}
                        >
                            {dataItem.author} in {dataItem.subreddit_name_prefixed}
                        </Link>
                        <Badge ml='1' colorScheme='orange'>
                            {timeDiff}
                        </Badge>
                    </HStack>
                    <Text 
                        fontWeight='bold' 
                        fontSize="sm" 
                        onClick={()=>openPreview(dataItem)}
                        style={{
                            cursor: 'pointer'
                        }}
                        
                    >
                        {dataItem.title}
                    </Text>
                    <HStack>
                        <Link 
                            isExternal={true}
                            href={`https://reddit.com${dataItem.permalink}`}
                            color={colors.foreActive}
                        >
                            <Badge ml='1' bg={colors.fore} textColor={colors.bg}>
                                {dataItem.num_comments} comments
                            </Badge>
                        </Link>
                        <Badge ml='1' colorScheme="green">
                            {dataItem.ups} <Icon as={AiOutlineArrowUp} />
                        </Badge>
                        <Badge ml='1' colorScheme="red">
                            {dataItem.downs} <Icon as={AiOutlineArrowDown} />
                        </Badge>
                        <Badge ml='1' colorScheme="purple">
                            {
                                dataItem.post_hint === "self" ?
                                "post" :
                                dataItem.post_hint
                            }
                        </Badge>
                    </HStack>
                </Box>
                <Box w="25%" onClick={()=>openPreview(dataItem)}>
                    {
                        ["default", "self"].indexOf(dataItem.thumbnail) < 0 ?
                        <Image src={dataItem.thumbnail} />
                        :
                        null
                    }
                </Box>
            </HStack>
        </VStack>
    )
}


export const RedditFeed = (props) =>{
    const {colorMode, } = useColorMode();
    const colors = useAppColors();
    const [ feedItems, setFeedItems ] = React.useState([]);
    const [ noResults, setNoResults ] = React.useState(false);
    const [ loading, setLoading ] = React.useState(true);
    const [ lastSearch, setLastSearch ] = React.useState("");
    const [ postViewOpen, setPostViewOpen ] = React.useState(false);
    const [ postViewData, setPostViewData ] = React.useState({});
    
    const openPreview = (dataItem) => {
        // escape certain chars:
        // console.log(dataItem.selftext)
        dataItem.selftext = dataItem.selftext.replaceAll("&amp;#x200B;","")
        dataItem.selftext = dataItem.selftext.replaceAll("\n"," \n")
        setPostViewData(dataItem);
        setPostViewOpen(true);
    }
    const closePreview = () => {
        setPostViewData({});
        setPostViewOpen(false);
    }

    const checkFeedUpdate = () => {
        // updates the feed directly from reddit
        if (!props){
            return
        }
        //setNoResults(false)
        const url = "https://www.reddit.com/search.json"
        Axios.get(url, {
            params: {...props}
        }).then((response)=>{
            const listingChildren = response.data.data.children;
            if (listingChildren.length < 1){
                setNoResults(true)
                setFeedItems([])

            } else {
                if (noResults){setNoResults(false)}
                // console.log(listingChildren)
                setFeedItems(listingChildren)
            }
        }).catch((error)=>{
            setNoResults(true)
            setFeedItems([])
        })
    }
    React.useEffect(()=>{
        const intervalId = setInterval(() => {
            checkFeedUpdate()
        }, 30000);
        return(()=>{
            clearInterval(intervalId);
        })
    })
    React.useEffect(()=>{
        setLoading(false)
    }, [feedItems])

    React.useEffect(()=>{
        setLoading(false)
    }, [noResults])

    //  add hoc call if search term changed
    if (lastSearch !== JSON.stringify(props) && props.q.length > 0){
        setLoading(true)
        // console.log(lastSearch !== JSON.stringify(props))
        // console.log(props)
        // console.log(lastSearch)
        setLastSearch(JSON.stringify(props))
        checkFeedUpdate()
    }
    let timeDiff;
    if (Object.keys(postViewData).length > 0){
        const postTime = postViewData.created
        const currentTime = Math.floor(new Date().getTime() / 1000);
        timeDiff = getTimeDiff(currentTime, postTime)
    }
    const flairColorMapping = {
        light: "#fff",
        dark: "#000"
    }
    // console.log(postViewData)
    return (
    <>
        <Modal 
            isOpen={postViewOpen} 
            onClose={closePreview} 
            size={"4xl"}
            scrollBehavior="inside"
        >
            <ModalOverlay />
            <ModalContent 
                bgColor={colors.bg} 
                borderRadius={10}
                className={colorMode === "dark" ? "cryptoGridDark" : "cryptoGridLight"}
                borderColor={colors.fore}
                borderWidth={1}
                padding={3}
                onMouseDown={stopPropagation}
                onTouchStart={stopPropagation}
            >
                <ModalHeader 
                    borderBottomColor={colors.fore} 
                    borderBottomWidth={1} 
                    paddingBottom={2}
                    fontSize={18}
                >
                    <VStack alignItems={"left"}>
                        <HStack>
                        <Text fontSize="sm">
                                Posted by
                            </Text>
                            <Link href={`https://reddit.com/u/${postViewData.author}`} isExternal>
                                <Text fontSize="sm">
                                    u/{postViewData.author}
                                </Text>
                            </Link>
                            <Text fontSize="sm">
                                in
                            </Text>
                            <Link href={`https://reddit.com/r/${postViewData.subreddit}`} isExternal>
                                <Text fontSize="sm">
                                    r/{postViewData.subreddit}
                                </Text>
                            </Link>
                            <Badge 
                                bg={postViewData.author_flair_background_color}
                                textColor={flairColorMapping[postViewData.author_flair_text_color]}
                            >
                                {postViewData.author_flair_text}
                            </Badge>
                            <Badge ml='1' colorScheme='orange'>
                                {timeDiff}
                            </Badge>
                        </HStack>
                        <Link 
                            isExternal={true}
                            href={`https://reddit.com${postViewData.permalink}`}
                            color={colors.foreActive}
                        >
                            {postViewData.title}
                        </Link>
                        <HStack>
                            <Link 
                                isExternal
                                href={`https://www.reddit.com/r/${postViewData.subreddit}/search?q=flair_name:"${postViewData.link_flair_text}"&restrict_sr=1`}>
                                <Badge 
                                    bg={postViewData.link_flair_background_color}
                                    textColor={flairColorMapping[postViewData.link_flair_text_color]}
                                >
                                    {postViewData.link_flair_text}
                                </Badge>
                            </Link>
                            <Link 
                                isExternal={true}
                                href={`https://reddit.com${postViewData.permalink}`}
                                color={colors.foreActive}
                            >
                                <Badge ml='1' bg={colors.fore} textColor={colors.bg}>
                                    {postViewData.num_comments} comments
                                </Badge>
                            </Link>
                            <Badge ml='1' colorScheme="green">
                                {postViewData.ups} <Icon as={AiOutlineArrowUp} />
                            </Badge>
                            <Badge ml='1' colorScheme="red">
                                {postViewData.downs} <Icon as={AiOutlineArrowDown} />
                            </Badge>
                        </HStack>
                    </VStack>
                </ModalHeader>
                <ModalCloseButton 
                    borderWidth={1} 
                    borderRadius={0}
                    borderTopRightRadius={5} 
                    borderColor={colors.fore}
                    _hover={{bgColor: colors.fore, color: colors.bg}} 
                />
                <ModalBody padding={2}>
                    {
                        postViewData.post_hint === "image" ?
                        <Image src={postViewData.url} />

                        :
                        postViewData.post_hint === "link" ?
                        <Link isExternal href={postViewData.url} textColor={colors.foreActive}>
                            {postViewData.url}
                        </Link>
                        :
                        ["hosted:video", "rich:video"].indexOf(postViewData.post_hint) > -1 ?
                        <Box h="100%" w="100%" padding={5}>
                            <Button 
                                bg={colors.bg}
                                textColor={colors.fore} 
                                _text={{
                                    fontFamily: "courier new"
                                }}
                                borderColor={colors.fore}
                                borderRadius={5}
                                borderWidth={1}
                                _hover={{
                                    textColor: colors.bg,
                                    bg: colors.foreActive,
                                    borderColor: colors.foreActive
                                }}
                                _active={{
                                    textColor: colors.bg,
                                    bg: colors.foreActive
                                }}
                                onClick={()=>window.open(postViewData.url, '_blank').focus()}
                            >
                                View video on reddit
                            </Button>
                        </Box>
                        :
                        postViewData.selftext
                    }
                </ModalBody>
                <ModalFooter>
                    
                </ModalFooter>
            </ModalContent>
        </Modal>
        {props &&  props.q.length > 0 ?
        <VStack h="100%" overflow="auto" w="100%" maxH="100%">
            <HStack 
                w="100%"
                bgGradient={`linear(to-r, ${colors.fore}, ${colors.fore})`}
            >
                    {
                        loading || (feedItems.length < 1 && !noResults) ?
                        <Text 
                            color={colors.bg} 
                            fontFamily="courier new" 
                            w="100%"
                            paddingLeft={2}
                        >
                            Searching Reddit for: "{props.q}" 
                        </Text>
                        :
                        <HStack 
                            spacing={4} 
                            w="100%" 
                            // justifyContent={"space-between"}
                            paddingRight={5}
                        
                        >
                            <Text
                                color={colors.bg} 
                                fontFamily="courier new" 
                                paddingLeft={2}
                            >
                                Live
                            </Text>
                            <Box 
                                alignSelf={"flex-center"}
                                justifySelf={"end"}
                                w={2} 
                                h={2} 
                                className="circle pulse" 
                                bg="rgb(255,0,0)"
                            />
                            <Text
                                color={colors.bg} 
                                fontFamily="courier new" 
                            >
                                | {props.q}
                            </Text>

                            
                        </HStack>
                    }
            </HStack>
            <Box h="100%" overflow="auto" w="100%" maxH="100%">
                {
                    noResults && !loading ?
                    <Center 
                        h="100%" 
                        padding={10}
                        textColor={colors.fore} 
                        fontFamily={"courier new"}
                    >
                        <Box borderWidth={1} borderColor={colors.fore} padding={5}>
                            <Text>Sorry, there are currently no results for "{props.q}".</Text>
                            <br/>
                            <Text>
                                You can try searching for something else or wait until one pops 
                                up for your search term.
                            </Text>
                        </Box>
                    </Center>
                    :                    
                    loading || feedItems.length < 1 ?
                    <>
                    <Progress size='xs' isIndeterminate />
                    <Center h="90%" w="100%">
                        <VStack>
                            <Spinner
                                thickness='4px'
                                speed='0.65s'
                                emptyColor={colors.bg}
                                color={colors.fore}
                                size='xl'
                            />
                        </VStack>

                    </Center>
                    </>
                    :
                    <VStack divider={<StackDivider borderColor={colors.fore}/>}
                        alignItems="baseline"
                    > 
                        {
                            feedItems.map((x,i)=>
                                <FeedItem 
                                    key={`fi-${i}`} 
                                    data={x}
                                    openPreview={openPreview}
                                />
                            )
                        }
                    </VStack>
                }
                
            </Box>
        </VStack>
        :
        <Center 
            h="100%" 
            padding={10}
            textColor={colors.fore} 
            fontFamily={"courier new"}
            fontWeight={"bold"}
            overflow="auto"
            maxH="100%" 
        >
            <Box borderWidth={1} borderColor={colors.fore} padding={5} >
                Configure your feed using the widget settings
            </Box>
        </Center>
    }
    </>
    )
}
export default RedditFeed;