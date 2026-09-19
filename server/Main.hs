{-# LANGUAGE OverloadedStrings #-}

-- | Serves the built FastBoard app at / and a Reddit search stream at
-- /sse/redditSearch, a port of e3-utils' RedditWrapper.generate_searches and its
-- SSE router: poll Reddit's search.json and push the listing whenever the newest
-- post changes.
--
-- Config (environment): PORT (8080), FASTBOARD_DIST (../dist, i.e. the repo's build output when run from server/).
module Main (main) where

import Control.Concurrent (threadDelay)
import Control.Exception (SomeException, try)
import Data.Aeson (FromJSON (..), Value, decode, encode, object, withObject, (.:), (.=))
import Data.Aeson.Types (parseMaybe)
import qualified Data.ByteString.Builder as B
import qualified Data.ByteString.Char8 as BC
import qualified Data.ByteString.Lazy as BL
import qualified Data.Text as T
import qualified Data.Text.Encoding as T
import qualified Data.Text.Lazy as TL
import Data.Maybe (fromMaybe)
import Network.HTTP.Simple
import Network.HTTP.Types (status200, status400, urlEncode)
import Network.Wai.Handler.Warp (defaultSettings, setHost, setPort)
import Network.Wai.Middleware.Static (addBase, noDots, staticPolicy, (>->))
import System.Environment (lookupEnv)
import System.FilePath ((</>))
import Web.Scotty

redditRateLimit :: Int -- seconds
redditRateLimit = 2

maxQueryLength :: Int
maxQueryLength = 512

userAgent :: BC.ByteString
userAgent = "Ubuntu(20.04):test-app:v0.1"

main :: IO ()
main = do
  port <- maybe 8080 read <$> lookupEnv "PORT"
  dist <- fromMaybe "../dist" <$> lookupEnv "FASTBOARD_DIST"
  base <- fromMaybe "https://reddit.com" <$> lookupEnv "REDDIT_BASE_URL" -- overridable so it can be pointed at a stub
  let index = do
        setHeader "Content-Type" "text/html; charset=utf-8"
        status status200
        file (dist </> "index.html")
  putStrLn ("FastBoard on http://127.0.0.1:" <> show (port :: Int) <> " (serving " <> dist <> ")")
  scottyOpts defaultOptions {settings = setHost "127.0.0.1" (setPort port defaultSettings)} $ do
    middleware (staticPolicy (noDots >-> addBase dist))
    get "/sse/redditSearch" (redditSearch base)
    get "/" index
    -- wouter uses path routing (/board), so a reload on such a route needs the app shell.
    notFound index

-- | @?search_term=..&subreddit=..&period=..&limit=..&sort=..@. Only @search_term@ or
-- @subreddit@ is required; with no search term it follows the subreddit's /new.
redditSearch :: String -> ActionM ()
redditSearch base = do
  term <- queryParamMaybe "search_term"
  subreddit <- queryParamMaybe "subreddit"
  period <- queryParamMaybe "period"
  limit <- queryParamMaybe "limit"
  sort <- queryParamMaybe "sort"
  case (nonEmpty term, nonEmpty subreddit) of
    (Nothing, Nothing) -> bad "Provide search_term and/or subreddit"
    (Just t, _) | T.length t > maxQueryLength -> bad ("Search term is too long - reduce to " <> TL.pack (show maxQueryLength) <> " characters.")
    (t, sub) -> do
      setHeader "Content-Type" "text/event-stream"
      setHeader "Cache-Control" "no-cache"
      let req = listingRequest base t sub (or' period "hour") (or' limit "5") (or' sort "new")
      stream $ \send flush -> pollForever req send flush Nothing
  where
    bad msg = status status400 >> text msg
    nonEmpty = (>>= \s -> if T.null s then Nothing else Just (s :: T.Text))
    or' v def = fromMaybe def (nonEmpty v)

-- | The GET for one poll. The subreddit is percent-encoded into the path, so it
-- can't reach anywhere but /r/<name>/.
listingRequest :: String -> Maybe T.Text -> Maybe T.Text -> T.Text -> T.Text -> T.Text -> Request
listingRequest base term sub period limit sort =
  setRequestHeader "User-Agent" [userAgent]
    . setRequestQueryString [(k, Just (T.encodeUtf8 v)) | (k, v) <- params]
    . setRequestPath (T.encodeUtf8 path)
    $ parseRequest_ base
  where
    prefix = maybe "" (\s -> "/r/" <> T.decodeUtf8 (urlEncode False (T.encodeUtf8 s))) sub
    (path, params) = case term of
      Just q ->
        ( prefix <> "/search.json"
        , [("q", q), ("t", period), ("limit", limit), ("sort", sort)] <> [("restrict_sr", "1") | Just _ <- [sub]]
        )
      Nothing -> (prefix <> "/new.json", [("limit", limit)])

newtype Listing = Listing [Value]

instance FromJSON Listing where
  parseJSON = withObject "listing" $ \o -> Listing <$> (o .: "data" >>= (.: "children"))

firstName :: Value -> Maybe T.Text
firstName = parseMaybe (withObject "child" $ \o -> o .: "data" >>= (.: "name"))

-- | Polls until a write fails, which is how a closed connection shows up. The
-- keepalive comment on every poll makes sure there is a write to fail.
pollForever :: Request -> (B.Builder -> IO ()) -> IO () -> Maybe T.Text -> IO ()
pollForever req send flush lastSeen = do
  fetched <- try (httpLBS req) :: IO (Either SomeException (Response BL.ByteString))
  send ": keepalive\n\n"
  seen <- case fetched of
    Left err -> failed (T.pack (takeWhile (/= '\n') (show err)))
    Right res
      | getResponseStatusCode res /= 200 -> failed ("Reddit responded " <> T.pack (show (getResponseStatusCode res)))
      -- only send when the newest post has changed
      | Just (Listing children@(c : _)) <- decode (getResponseBody res)
      , Just name <- firstName c
      , Just name /= lastSeen -> send (event "message" (object ["data" .= children])) >> pure (Just name)
      | otherwise -> pure lastSeen
  flush
  threadDelay (redditRateLimit * 1000000)
  pollForever req send flush seen
  where
    failed message = send (event "stream-error" (object ["message" .= message])) >> pure lastSeen
    event name payload = "event: " <> B.byteString name <> "\ndata: " <> B.lazyByteString (encode payload) <> "\n\n"
