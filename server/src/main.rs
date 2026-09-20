//! Serves the built FastBoard app at / and a Reddit search stream at
//! /sse/redditSearch, a port of e3-utils' RedditWrapper.generate_searches and its
//! SSE router: poll Reddit's search.json and push the listing whenever the newest
//! post changes.
//!
//! Reddit answers many unauthenticated .json requests with 403. Set REDDIT_CLIENT_ID and
//! REDDIT_CLIENT_SECRET (a "script" app from reddit.com/prefs/apps) to poll oauth.reddit.com
//! instead, which is not blocked.
//!
//! Config (environment): PORT (8080), FASTBOARD_DIST (../dist, i.e. the repo's build output
//! when run from server/), REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET.

use std::{
    collections::HashMap,
    convert::Infallible,
    env,
    path::PathBuf,
    sync::Arc,
    time::{Duration, Instant},
};

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{
        sse::{Event, Sse},
        IntoResponse, Response,
    },
    routing::get,
    Router,
};
use futures_util::Stream;
use serde::Deserialize;
use serde_json::{json, Value};
use tokio::sync::Mutex;
use tower_http::services::{ServeDir, ServeFile};

const REDDIT_RATE_LIMIT: Duration = Duration::from_secs(2);
const MAX_QUERY_LENGTH: usize = 512;
const USER_AGENT: &str = "Ubuntu(20.04):test-app:v0.1";

#[derive(Clone)]
struct AppState {
    http: reqwest::Client,
    api_base: Arc<str>,
    token: Arc<TokenSource>,
}

/// An application-only OAuth token (client_credentials), cached until a minute before it
/// expires. With no credentials there is no token and requests go out unauthenticated.
struct TokenSource {
    auth_base: String,
    creds: Option<(String, String)>,
    cache: Mutex<Option<(String, Instant)>>,
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    expires_in: Option<u64>,
}

impl TokenSource {
    async fn get(&self, http: &reqwest::Client) -> Result<Option<String>, String> {
        let Some((id, secret)) = &self.creds else {
            return Ok(None);
        };
        let mut cache = self.cache.lock().await;
        if let Some((token, expires_at)) = &*cache {
            if Instant::now() < *expires_at {
                return Ok(Some(token.clone()));
            }
        }
        let res = http
            .post(format!("{}/api/v1/access_token", self.auth_base))
            .basic_auth(id, Some(secret))
            .form(&[("grant_type", "client_credentials")])
            .send()
            .await
            .map_err(|e| e.without_url().to_string())?;
        let status = res.status();
        let body = if status.is_success() {
            res.json::<TokenResponse>().await.ok()
        } else {
            None
        };
        match body {
            Some(t) => {
                let ttl = t.expires_in.unwrap_or(3600).saturating_sub(60);
                *cache = Some((t.access_token.clone(), Instant::now() + Duration::from_secs(ttl)));
                Ok(Some(t.access_token))
            }
            None => Err(format!("Reddit rejected the OAuth credentials ({})", status.as_u16())),
        }
    }
}

#[tokio::main]
async fn main() {
    let port: u16 = env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8080);
    let dist = PathBuf::from(env::var("FASTBOARD_DIST").unwrap_or_else(|_| "../dist".into()));
    let creds = match (non_blank("REDDIT_CLIENT_ID"), non_blank("REDDIT_CLIENT_SECRET")) {
        (Some(id), Some(secret)) => Some((id, secret)),
        _ => None,
    };
    // REDDIT_BASE_URL points both hosts at a stub, for testing.
    let (api_base, auth_base) = match non_blank("REDDIT_BASE_URL") {
        Some(b) => (b.clone(), b),
        None => (
            if creds.is_some() { "https://oauth.reddit.com" } else { "https://reddit.com" }.to_string(),
            "https://www.reddit.com".to_string(),
        ),
    };
    let oauth = creds.is_some();

    let state = AppState {
        http: reqwest::Client::builder()
            .user_agent(USER_AGENT)
            .build()
            .expect("build http client"),
        api_base: api_base.into(),
        token: Arc::new(TokenSource { auth_base, creds, cache: Mutex::new(None) }),
    };

    // wouter uses path routing (/board), so a reload on such a route needs the app shell.
    let app_shell = ServeDir::new(&dist).fallback(ServeFile::new(dist.join("index.html")));
    let app = Router::new()
        .route("/sse/redditSearch", get(reddit_search))
        .fallback_service(app_shell)
        .with_state(state);

    println!("FastBoard on http://127.0.0.1:{port} (serving {})", dist.display());
    println!(
        "{}",
        if oauth {
            "Reddit: OAuth"
        } else {
            "Reddit: unauthenticated (set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET if it answers 403)"
        }
    );
    let listener = tokio::net::TcpListener::bind(("127.0.0.1", port))
        .await
        .unwrap_or_else(|e| panic!("bind 127.0.0.1:{port}: {e}"));
    axum::serve(listener, app).await.expect("serve");
}

fn non_blank(key: &str) -> Option<String> {
    env::var(key).ok().filter(|v| !v.is_empty())
}

/// `?search_term=..&subreddit=..&period=..&limit=..&sort=..`. Only `search_term` or
/// `subreddit` is required; with no search term it follows the subreddit's /new.
async fn reddit_search(State(state): State<AppState>, Query(params): Query<HashMap<String, String>>) -> Response {
    let param = |k: &str| params.get(k).map(String::as_str).filter(|v| !v.is_empty());
    let (term, subreddit) = (param("search_term"), param("subreddit"));
    match (term, subreddit) {
        (None, None) => return bad("Provide search_term and/or subreddit".into()),
        (Some(t), _) if t.chars().count() > MAX_QUERY_LENGTH => {
            return bad(format!("Search term is too long - reduce to {MAX_QUERY_LENGTH} characters."))
        }
        _ => {}
    }
    let Some(url) = listing_url(
        &state.api_base,
        term,
        subreddit,
        param("period").unwrap_or("hour"),
        param("limit").unwrap_or("5"),
        param("sort").unwrap_or("new"),
    ) else {
        return bad("Invalid Reddit base URL".into());
    };
    let mut response = Sse::new(poll_forever(state, url)).into_response();
    response
        .headers_mut()
        .insert("Cache-Control", "no-cache".parse().expect("static header"));
    response
}

fn bad(message: String) -> Response {
    (StatusCode::BAD_REQUEST, message).into_response()
}

/// The GET for one poll. The subreddit is pushed as a single percent-encoded path
/// segment, so it can't reach anywhere but /r/<name>/.
fn listing_url(
    base: &str,
    term: Option<&str>,
    sub: Option<&str>,
    period: &str,
    limit: &str,
    sort: &str,
) -> Option<reqwest::Url> {
    let mut url = reqwest::Url::parse(base).ok()?;
    {
        let mut path = url.path_segments_mut().ok()?;
        path.pop_if_empty();
        if let Some(s) = sub {
            path.push("r").push(s);
        }
        path.push(if term.is_some() { "search.json" } else { "new.json" });
    }
    {
        let mut q = url.query_pairs_mut();
        match term {
            Some(t) => {
                q.append_pair("q", t)
                    .append_pair("t", period)
                    .append_pair("limit", limit)
                    .append_pair("sort", sort)
                    .append_pair("raw_json", "1");
                if sub.is_some() {
                    q.append_pair("restrict_sr", "1");
                }
            }
            None => {
                q.append_pair("limit", limit).append_pair("raw_json", "1");
            }
        }
    }
    Some(url)
}

/// Polls until the client goes away, which drops the stream. The keepalive comment on
/// every poll keeps idle connections open. An unchanged newest post sends nothing.
fn poll_forever(state: AppState, url: reqwest::Url) -> impl Stream<Item = Result<Event, Infallible>> {
    async_stream::stream! {
        let mut last_seen: Option<String> = None;
        loop {
            let fetched = fetch_listing(&state, &url).await;
            yield Ok(Event::default().comment("keepalive"));
            match fetched {
                Err(message) => yield Ok(stream_error(&message)),
                Ok(children) => {
                    let newest = children.first().and_then(first_name);
                    if let Some(name) = newest {
                        if last_seen.as_deref() != Some(name.as_str()) {
                            yield Ok(Event::default()
                                .event("message")
                                .json_data(json!({ "data": children }))
                                .expect("serialize listing"));
                            last_seen = Some(name);
                        }
                    }
                }
            }
            tokio::time::sleep(REDDIT_RATE_LIMIT).await;
        }
    }
}

async fn fetch_listing(state: &AppState, url: &reqwest::Url) -> Result<Vec<Value>, String> {
    let token = state.token.get(&state.http).await?;
    let mut req = state.http.get(url.clone());
    if let Some(t) = token {
        req = req.bearer_auth(t);
    }
    let res = req.send().await.map_err(|e| e.without_url().to_string())?;
    if res.status().as_u16() != 200 {
        return Err(format!("Reddit responded {}", res.status().as_u16()));
    }
    // A body that isn't a listing is treated like an unchanged one, as before.
    let body: Value = res.json().await.unwrap_or(Value::Null);
    Ok(body
        .pointer("/data/children")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default())
}

fn first_name(child: &Value) -> Option<String> {
    child.pointer("/data/name")?.as_str().map(str::to_owned)
}

fn stream_error(message: &str) -> Event {
    Event::default()
        .event("stream-error")
        .json_data(json!({ "message": message }))
        .expect("serialize error")
}
