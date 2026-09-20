# cargo comes from rustup, which non-login shells (and make) may not have on PATH.
export PATH := $(HOME)/.cargo/bin:$(PATH)

# Reddit OAuth credentials for the server, from an optional .env (KEY=value lines, no quotes)
# or the environment. See the readme's Reddit section.
-include .env
export REDDIT_CLIENT_ID REDDIT_CLIENT_SECRET

.PHONY: install build build-web build-server build-site run run-server dev dev-web dev-server test

install:
	yarn install

# Production: build the app into dist/ and the server, then `make run` serves both on :8080.
build: build-web build-server

build-web:
	yarn build

build-server:
	cd server && cargo build --release

# Static, front-end only build for GitHub Pages: no server, so the Reddit widget's stream is unavailable.
# Emits into the site repo under SITE_PATH (served at https://<user>.github.io/<SITE_PATH>/).
SITE_REPO ?= ../nicelgueta.github.io
SITE_PATH ?= fastboard
SITE_DIR  := $(SITE_REPO)/$(SITE_PATH)

build-site:
	rm -rf "$(SITE_DIR)"
	@test -n "$(SITE_PATH)" && test -d "$(SITE_REPO)" || { echo "SITE_REPO ($(SITE_REPO)) must exist and SITE_PATH must be non-empty"; exit 1; }
	yarn tsc --noEmit
	yarn vite build --base=/$(SITE_PATH)/ --outDir $(abspath $(SITE_DIR)) --emptyOutDir
	# GitHub Pages has no SPA fallback: give the /board route its own entry point.
	mkdir -p $(SITE_DIR)/board && cp $(SITE_DIR)/index.html $(SITE_DIR)/board/index.html

run: build-web run-server

run-server:
	cd server && cargo run --release

# Development: Vite (hot reload) plus the server for the Reddit widget's stream (Vite proxies /sse to it).
dev:
	$(MAKE) -j2 dev-web dev-server

dev-web:
	yarn dev

dev-server: run-server

test:
	yarn test
