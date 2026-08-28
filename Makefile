SHELL := /bin/sh
.DEFAULT_GOAL := help

.PHONY: help install build test typecheck check pack clean \
	release release-patch release-minor release-major

help:
	@printf '%s\n' \
		'Usage:' \
		'  make install        Install dependencies from package-lock.json' \
		'  make build          Build server, TUI, installer, and CLI entries' \
		'  make test           Run the test suite' \
		'  make typecheck      Run TypeScript type checking' \
		'  make check          Run type checking, build, and tests' \
		'  make pack           Validate and create the npm package tarball' \
		'  make clean          Remove generated build and package files' \
		'  make release-patch  Release the next patch version' \
		'  make release-minor  Release the next minor version' \
		'  make release-major  Release the next major version'

install:
	npm ci

build:
	npm run build

test:
	npm test

typecheck:
	npm run typecheck

check:
	npm run check

pack: check
	npm pack --ignore-scripts

clean:
	rm -rf dist *.tgz

release-patch:
	@$(MAKE) release BUMP=patch

release-minor:
	@$(MAKE) release BUMP=minor

release-major:
	@$(MAKE) release BUMP=major

release:
	@set -eu; \
	case "$(BUMP)" in patch|minor|major) ;; *) echo 'BUMP must be patch, minor, or major' >&2; exit 1 ;; esac; \
	test "$$(git branch --show-current)" = main || { echo 'Release must run from the main branch' >&2; exit 1; }; \
	test -z "$$(git status --porcelain)" || { echo 'Working tree must be clean before release' >&2; exit 1; }; \
	git remote get-url origin >/dev/null 2>&1 || { echo 'The origin remote is not configured' >&2; exit 1; }; \
	git fetch origin main; \
	git merge-base --is-ancestor origin/main HEAD || { echo 'Local main is behind or diverged from origin/main' >&2; exit 1; }; \
	npm run check; \
	npm version "$(BUMP)"; \
	git push origin main --follow-tags
