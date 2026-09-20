# cargo comes from rustup, which non-login shells (and make) may not have on PATH.
export PATH := $(HOME)/.cargo/bin:$(PATH)

# Reddit OAuth credentials for the server, from an optional .env (KEY=value lines, no quotes)
# or the environment. See the readme's Reddit section.
-include .env
export REDDIT_CLIENT_ID REDDIT_CLIENT_SECRET

.PHONY: install build build-web build-server run run-server dev dev-web dev-server test

install:
	yarn install

# Production: build the app into dist/ and the server, then `make run` serves both on :8080.
build: build-web build-server

build-web:
	yarn build

build-server:
	cd server && cargo build --release

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
