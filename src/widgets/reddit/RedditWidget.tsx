import React from 'react';
import {
    Box, Checkbox, Flex, HStack, Image, Input, Link, Modal, ModalBody, ModalCloseButton, ModalContent,
    ModalHeader, ModalOverlay, Select, Text, VStack,
} from '@chakra-ui/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import useAppColors, { RADIUS } from '../../hooks/useAppColors';
import { stopPropagation } from '../../components/common';
import FBButton from '../../components/primitive/Button';
import type { WidgetElementProps } from '../../interfaces';
import { useWidgetState } from '../../store/hooks';
import ConnectionBadge from '../ConnectionBadge';
import {
    DEFAULT_MAX_POSTS,
    DEFAULT_STREAM_URL,
    DEFAULT_SUBREDDIT,
    MAX_POSTS_OPTIONS,
    STREAM_EVENTS,
    buildStreamUrl,
    mergePosts,
    normalizeQuery,
    normalizeSubreddit,
    timeAgo,
    type RedditPost,
} from './posts';

/** Persisted with the widget's state (and so with saved boards); edited from the toolbar. */
interface RedditPersistedState {
    subreddit?: string;
    query?: string;
    maxPosts?: number;
    streamUrl?: string;
    showNsfw?: boolean;
}

type Status = 'connecting' | 'live' | 'reconnecting';

const isImageUrl = (u: string) => /\.(png|jpe?g|gif|webp)(\?|$)/i.test(u);

/** One-line plain-text summary of a post. Score/comments/flair only appear when the data source provides them. */
const PostMeta: React.FC<{ post: RedditPost; showSubreddit: boolean }> = ({ post: p, showSubreddit }) => {
    const [colors] = useAppColors();
    return (
        <HStack spacing={2} fontSize="xs" color={colors.foreHalf} wrap="wrap">
            {p.flair && <Text color={colors.info}>{p.flair}</Text>}
            <Link href={`https://www.reddit.com/user/${p.author}`} isExternal>u/{p.author}</Link>
            {showSubreddit && p.subreddit && (
                <Link href={`https://www.reddit.com/r/${p.subreddit}`} isExternal>r/{p.subreddit}</Link>
            )}
            <Text>{timeAgo(p.createdUtc)}</Text>
            {p.score !== undefined && <Text>{p.score} pts</Text>}
            <Link href={p.permalink} isExternal>
                {p.numComments === undefined ? 'comments' : `${p.numComments} comments`}
            </Link>
            {p.over18 && <Text color={colors.fail}>NSFW</Text>}
        </HStack>
    );
};

const RedditWidget: React.FC<WidgetElementProps> = ({ wKey, isStatic }) => {
    const [colors] = useAppColors();
    const [state, setState] = useWidgetState<RedditPersistedState>(wKey);
    const subredditSetting = state.subreddit ?? (state.query ? '' : DEFAULT_SUBREDDIT);
    const querySetting = state.query ?? '';
    const maxPosts = state.maxPosts ?? DEFAULT_MAX_POSTS;
    const streamUrl = state.streamUrl ?? DEFAULT_STREAM_URL;
    const showNsfw = state.showNsfw ?? false;

    // Text fields are edited locally and committed on Enter/blur, so typing doesn't
    // reconnect the stream on every keystroke.
    const [subredditDraft, setSubredditDraft] = React.useState(subredditSetting);
    const [queryDraft, setQueryDraft] = React.useState(querySetting);
    const [streamUrlDraft, setStreamUrlDraft] = React.useState(streamUrl);
    React.useEffect(() => setSubredditDraft(subredditSetting), [subredditSetting]);
    React.useEffect(() => setQueryDraft(querySetting), [querySetting]);
    React.useEffect(() => setStreamUrlDraft(streamUrl), [streamUrl]);

    const subreddit = normalizeSubreddit(subredditSetting) ?? undefined;
    const query = normalizeQuery(querySetting) ?? undefined;
    const subredditInvalid = !!subredditSetting.trim() && !subreddit;
    const hasTarget = !subredditInvalid && !!(subreddit || query);

    const [posts, setPosts] = React.useState<RedditPost[]>([]);
    // Ids that arrived after the initial snapshot - highlighted as "new".
    const [liveIds, setLiveIds] = React.useState<Set<string>>(() => new Set());
    const [status, setStatus] = React.useState<Status>('connecting');
    const [streamError, setStreamError] = React.useState<string>();
    const [paused, setPaused] = React.useState(false);
    const [preview, setPreview] = React.useState<RedditPost>();
    // Re-render once a minute so the "5m" ages stay current.
    const [, setTick] = React.useState(0);

    // maxPosts is read through a ref so changing it trims the list without tearing down the stream.
    const maxRef = React.useRef(maxPosts);
    maxRef.current = maxPosts;

    React.useEffect(() => {
        const t = setInterval(() => setTick((n) => n + 1), 60_000);
        return () => clearInterval(t);
    }, []);

    React.useEffect(() => {
        setPosts([]);
        setLiveIds(new Set());
        setStreamError(undefined);
        if (!hasTarget || paused) return;
        setStatus('connecting');

        const es = new EventSource(buildStreamUrl(streamUrl, { subreddit, query }));
        // EventSource reconnects on its own after a drop; the server then sends a fresh
        // snapshot, which mergePosts dedupes against what we already have.
        es.onopen = () => setStatus('live');
        es.onerror = () => setStatus(es.readyState === EventSource.CLOSED ? 'connecting' : 'reconnecting');
        es.addEventListener(STREAM_EVENTS.snapshot, (e) => {
            setPosts((prev) => mergePosts(prev, JSON.parse((e as MessageEvent).data), maxRef.current));
        });
        es.addEventListener(STREAM_EVENTS.post, (e) => {
            const post: RedditPost = JSON.parse((e as MessageEvent).data);
            setPosts((prev) => mergePosts(prev, [post], maxRef.current));
            setLiveIds((prev) => new Set(prev).add(post.id));
        });
        es.addEventListener(STREAM_EVENTS.streamError, (e) => {
            setStreamError(JSON.parse((e as MessageEvent).data).message);
        });
        es.addEventListener(STREAM_EVENTS.streamOk, () => setStreamError(undefined));
        return () => es.close();
    }, [subreddit, query, streamUrl, paused, hasTarget]);

    const allowed = React.useMemo(() => posts.filter((p) => showNsfw || !p.over18), [posts, showNsfw]);
    const visible = React.useMemo(() => allowed.slice(0, Math.max(1, maxPosts)), [allowed, maxPosts]);
    const hiddenNsfw = posts.length - allowed.length;

    const controlProps = {
        size: 'sm' as const,
        borderRadius: RADIUS.md,
        borderColor: colors.infoHalf,
        color: colors.fore,
        bg: colors.surface,
        _hover: { borderColor: colors.info },
    };

    const commitText = (key: 'subreddit' | 'query' | 'streamUrl', next: string, current: string) => {
        const value = next.trim();
        if (value !== current) setState({ [key]: value });
    };
    const commitOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && e.currentTarget.blur();

    // A link post can carry text as well as its URL, so show both: the URL first, then the body.
    const previewBody = preview && (
        preview.postHint === 'image' || (!preview.isSelf && isImageUrl(preview.url)) ? (
            <Image src={preview.url} maxH="70vh" mx="auto" />
        ) : (
            <VStack align="stretch" spacing={4}>
                {!preview.isSelf && (
                    <Link isExternal href={preview.url} color={colors.info} fontSize="sm" wordBreak="break-all">{preview.url}</Link>
                )}
                {preview.selftext ? (
                    <Box
                        fontSize="sm" color={colors.fore}
                        sx={{ 'p, ul, ol, pre': { mb: 3 }, a: { color: colors.info, textDecoration: 'underline' }, ul: { pl: 5 }, ol: { pl: 5 } }}
                    >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{preview.selftext}</ReactMarkdown>
                    </Box>
                ) : preview.isSelf ? (
                    <Text fontSize="sm" color={colors.foreHalf}>This post has no text.</Text>
                ) : null}
            </VStack>
        )
    );

    return (
        <Flex direction="column" h="100%" onMouseDown={stopPropagation} onTouchStart={stopPropagation}>
            <HStack spacing={2} p={2} wrap="wrap" flexShrink={0} borderBottomWidth={1} borderColor={colors.border} bg={colors.surface}>
                <Input
                    {...controlProps} w="130px" placeholder="subreddit" aria-label="Subreddit"
                    value={subredditDraft} isDisabled={isStatic}
                    isInvalid={!!subredditDraft.trim() && !normalizeSubreddit(subredditDraft)}
                    onChange={(e) => setSubredditDraft(e.target.value)}
                    onBlur={() => commitText('subreddit', subredditDraft, subredditSetting)}
                    onKeyDown={commitOnEnter}
                />
                <Input
                    {...controlProps} w="150px" placeholder="search (optional)" aria-label="Search query"
                    title="Only follow posts matching this search. Leave the subreddit empty to search all of Reddit."
                    value={queryDraft} isDisabled={isStatic}
                    onChange={(e) => setQueryDraft(e.target.value)}
                    onBlur={() => commitText('query', queryDraft, querySetting)}
                    onKeyDown={commitOnEnter}
                />
                <Select
                    {...controlProps} w="110px" aria-label="Max posts" value={maxPosts} isDisabled={isStatic}
                    onChange={(e) => setState({ maxPosts: Number(e.target.value) })}
                >
                    {MAX_POSTS_OPTIONS.map((n) => <option key={n} value={n}>{n} posts</option>)}
                </Select>
                <Input
                    {...controlProps} w="150px" placeholder="Stream URL" aria-label="Stream URL"
                    title="SSE endpoint that emits Reddit posts. The dev/preview server provides the default; point elsewhere for a hosted deployment."
                    value={streamUrlDraft} isDisabled={isStatic}
                    onChange={(e) => setStreamUrlDraft(e.target.value)}
                    onBlur={() => commitText('streamUrl', streamUrlDraft.trim() || DEFAULT_STREAM_URL, streamUrl)}
                    onKeyDown={commitOnEnter}
                />
                <Checkbox
                    size="sm" isChecked={showNsfw} isDisabled={isStatic} color={colors.fore}
                    onChange={(e) => setState({ showNsfw: e.target.checked })}
                >
                    NSFW
                </Checkbox>
                <FBButton typ="info" variant="outline" size="sm" onClick={() => setPaused((p) => !p)} isDisabled={!hasTarget}>
                    {paused ? 'Resume' : 'Pause'}
                </FBButton>
                <Box flex={1} />
                {hasTarget && !paused ? (
                    <ConnectionBadge connected={status === 'live'} label={status === 'live' ? (subreddit ? `r/${subreddit}` : 'search') : undefined} />
                ) : (
                    <Text fontSize="xs" color={colors.foreHalf}>{paused ? 'Paused' : 'Enter a subreddit or search'}</Text>
                )}
            </HStack>

            {subredditInvalid && (
                <Text px={3} py={2} fontSize="xs" color={colors.fail}>"{subredditSetting}" is not a valid subreddit name.</Text>
            )}
            {streamError && (
                <Text px={3} py={2} fontSize="xs" color={colors.warning}>{streamError} - retrying.</Text>
            )}

            <Box flex={1} minH={0} overflowY="auto">
                {visible.length === 0 && hasTarget && !paused && !streamError && (
                    <Text p={4} fontSize="sm" color={colors.foreHalf}>Waiting for posts...</Text>
                )}
                {visible.map((p) => (
                    <HStack
                        key={p.id} px={3} py={2} spacing={3} align="start"
                        borderBottomWidth={1} borderColor={colors.border}
                        borderLeftWidth={3} borderLeftColor={liveIds.has(p.id) ? colors.info : 'transparent'}
                        _hover={{ bg: colors.surfaceSubtle }}
                    >
                        <VStack align="start" spacing={1} flex={1} minW={0}>
                            <Text
                                as="button" textAlign="left" fontSize="sm" fontWeight="medium" color={colors.fore}
                                onClick={() => setPreview(p)} _hover={{ color: colors.info }}
                            >
                                {p.title}
                            </Text>
                            <PostMeta post={p} showSubreddit={!subreddit} />
                        </VStack>
                        {p.thumbnail && (
                            <Image
                                src={p.thumbnail} alt="" w="72px" maxH="72px" objectFit="cover" borderRadius={RADIUS.sm}
                                cursor="pointer" flexShrink={0} onClick={() => setPreview(p)}
                            />
                        )}
                    </HStack>
                ))}
                {hiddenNsfw > 0 && (
                    <Text px={3} py={2} fontSize="xs" color={colors.foreHalf}>
                        {hiddenNsfw} NSFW post{hiddenNsfw === 1 ? '' : 's'} hidden.
                    </Text>
                )}
            </Box>

            <Modal isOpen={!!preview} onClose={() => setPreview(undefined)} size="3xl" scrollBehavior="inside">
                <ModalOverlay bg={colors.overlay} />
                <ModalContent
                    bg={colors.surfaceAlt} borderWidth={1} borderColor={colors.border} borderRadius={RADIUS.lg}
                    onMouseDown={stopPropagation} onTouchStart={stopPropagation}
                >
                    {preview && (
                        <>
                            <ModalHeader borderBottomWidth={1} borderColor={colors.border} pr={12}>
                                <VStack align="start" spacing={1}>
                                    <Link href={preview.permalink} isExternal fontSize="md" color={colors.fore}>{preview.title}</Link>
                                    <PostMeta post={preview} showSubreddit />
                                </VStack>
                            </ModalHeader>
                            <ModalCloseButton />
                            <ModalBody py={4}>{previewBody}</ModalBody>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </Flex>
    );
};

export default RedditWidget;
