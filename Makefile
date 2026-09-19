# cabal comes from ghcup, which non-login shells (and make) may not have on PATH.
export PATH := $(HOME)/.ghcup/bin:$(PATH)

.PHONY: install build build-web build-server run run-server dev dev-web dev-server test

install:
	yarn install

# Production: build the app into dist/ and the server, then `make run` serves both on :8080.
build: build-web build-server

build-web:
	yarn build

build-server:
	cd server && cabal build

run: build-web run-server

run-server:
	cd server && cabal run fastboard-server

# Development: Vite (hot reload) plus the server for the Reddit widget's stream (Vite proxies /sse to it).
dev:
	$(MAKE) -j2 dev-web dev-server

dev-web:
	yarn dev

dev-server: run-server

test:
	yarn test
