import React from 'react';
import useKvStore from '../hooks/useKvStore';
import { INTRO_SEEN_KEY, INTRO_VERSION } from './IntroModal';

/**
 * Open/closed state for the walkthrough, shared by the board header and the
 * landing page. With `autoOpen` it opens once on mount if this browser has not
 * seen the current INTRO_VERSION; `dismiss` records that it has (unless the
 * user unticked "Don't show again").
 */
export default function useIntro(autoOpen: boolean) {
  const { get, set } = useKvStore('prefs');
  const [open, setOpen] = React.useState(false);

  // useKvStore().get() returns JSON.parse(... || "{}"), so a key that was never
  // set comes back as {} rather than undefined - hence the typeof check. Reading
  // and calling setState is idempotent, so safe under StrictMode's double effects.
  React.useEffect(() => {
    if (!autoOpen) return;
    const seen = get(INTRO_SEEN_KEY);
    if (typeof seen !== 'number' || seen < INTRO_VERSION) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen]);

  const dismiss = (dontShowAgain: boolean) => {
    if (dontShowAgain) set(INTRO_SEEN_KEY, INTRO_VERSION);
  };

  return { open, setOpen, dismiss };
}
