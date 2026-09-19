import React from 'react';
import { Center, Spinner } from '@chakra-ui/react';
import { Redirect, Route, Router, Switch } from 'wouter';
import Providers from './Providers';
import Landing from './landing/Landing';

// Lazy so the landing page does not pull in dockview, duckdb, Monaco or ag-grid.
const BoardPage = React.lazy(() => import('./BoardPage'));

// Vite's `base` (BASE_URL is "/" unless the app is served from a sub-path);
// wouter wants it without the trailing slash.
const ROUTER_BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

const App: React.FC = () => (
    <Providers>
        <Router base={ROUTER_BASE}>
            <Switch>
                <Route path="/">
                    <Landing />
                </Route>
                <Route path="/board">
                    <React.Suspense fallback={<Center h="100%"><Spinner /></Center>}>
                        <BoardPage />
                    </React.Suspense>
                </Route>
                <Route>
                    <Redirect to="/" />
                </Route>
            </Switch>
        </Router>
    </Providers>
);

export default App;
