import type { BaseWidgetDict } from '../../interfaces';
import { DefaultLayout } from '../../layout';

// Kept dependency-free so registry.ts can list the widget without loading it.
// The subreddit, search, post cap, sort, NSFW filter and stream URL are edited from the widget's own
// toolbar and saved with its state (see RedditWidget.tsx), so there are no
// declarative settings here - same approach as the code editor.
export const RedditWidgetConfig: BaseWidgetDict = {
    type: 'reddit',
    disabled: false,
    name: 'Reddit Feed',
    description: 'Live feed of new posts in a subreddit, or matching a search, streamed over SSE.',
    maxNo: 10,
    defaultLayout: { ...DefaultLayout, initialWidth: 520, initialHeight: 520 },
    settings: [],
};
