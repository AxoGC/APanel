.PHONY: build build-web build-api dev-api dev-web docs-dev docs-build clean

build: build-web build-api

build-web:
	cd web && npm install && npm run build
	rm -rf api/internal/httpserver/dist
	cp -r web/dist api/internal/httpserver/dist

build-api:
	cd api && go build -o apanel ./cmd/apanel


# apanel itself has no notion of a .env file (production loads one via
# systemd's EnvironmentFile=, see deploy/); for local dev, source one here
# if present.
dev-api:
	cd api && set -a && [ -f dev.env ] && . ./dev.env; set +a; go run ./cmd/apanel

dev-web:
	cd web && npm run dev

# docs/ is a separate vitepress project, kept out of `build`/`dev-web` —
# build it explicitly with `make docs-build` (or `make docs-dev` to preview).
docs-dev:
	cd docs && npm install && npm run dev

docs-build:
	cd docs && npm install && npm run build

clean:
	rm -f api/apanel
	rm -rf web/dist
	rm -rf docs/.vitepress/dist
