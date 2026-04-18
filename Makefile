.PHONY: dev test test-watch coverage lint typecheck format check fix clean stats help

dev:            ## Start Expo dev server
	npm start

test:           ## Run all tests
	npm test

test-watch:     ## Run tests in watch mode
	npm run test:watch

coverage:       ## Run tests with coverage report
	npm run test:coverage

lint:           ## Run ESLint
	npm run lint

typecheck:      ## Run TypeScript compiler checks
	npm run typecheck

format:         ## Auto-format code with Prettier
	npm run format

check:          ## Run all quality checks (lint + typecheck + format + test)
	npm run lint
	npm run typecheck
	npm run format:check
	npm test

fix:            ## Auto-fix formatting and lint issues
	npm run format
	npm run lint -- --fix

clean:          ## Remove build artifacts and caches
	rm -rf coverage/ .expo/ ios/ android/

stats:          ## Show project statistics (files, LOC, tests, coverage)
	@echo "=== Source Files ===" && find src -name '*.ts' -o -name '*.tsx' | wc -l | tr -d ' '
	@echo "=== Test Files ===" && find __tests__ -name '*.test.*' | wc -l | tr -d ' '
	@echo "=== Lines of Code ===" && find src -name '*.ts' -o -name '*.tsx' | xargs wc -l 2>/dev/null | tail -1
	@echo "=== Module Breakdown ==="
	@for dir in hrv ble integrations hooks plugins sync share workout utils screens components; do \
		count=$$(find src/$$dir -name '*.ts' -o -name '*.tsx' 2>/dev/null | xargs wc -l 2>/dev/null | tail -1 | awk '{print $$1}'); \
		printf "  %-15s %s LOC\n" "$$dir/" "$$count"; \
	done

help:           ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
