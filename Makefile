BLUE=\033[0;34m
GREEN=\033[0;32m
RESET=\033[0m

.PHONY: help up down build logs shell migrate superuser test clean setup detect-abandoned

help:
	@echo "$(BLUE)EduTest Pro — Commands$(RESET)"
	@echo "  $(GREEN)make setup$(RESET)          First-time setup"
	@echo "  $(GREEN)make up$(RESET)             Start all services"
	@echo "  $(GREEN)make down$(RESET)           Stop all services"
	@echo "  $(GREEN)make build$(RESET)          Rebuild images"
	@echo "  $(GREEN)make logs$(RESET)           View all logs"
	@echo "  $(GREEN)make shell$(RESET)          Django shell"
	@echo "  $(GREEN)make migrate$(RESET)        Run migrations"
	@echo "  $(GREEN)make superuser$(RESET)      Create superuser"
	@echo "  $(GREEN)make test$(RESET)           Run backend tests"
	@echo "  $(GREEN)make clean$(RESET)          Remove containers and volumes"

setup:
	@test -f .env || cp .env.example .env 2>/dev/null || echo ".env already exists"
	@mkdir -p data/postgres data/redis
	@echo "$(GREEN)✓ Setup complete. Edit .env then run: make up$(RESET)"

up:
	docker compose up --build -d
	@echo "$(GREEN)✓ Running at http://localhost$(RESET)"

up-logs:
	docker compose up --build

down:
	docker compose down

build:
	docker compose build --no-cache

logs:
	docker compose logs -f --tail=100

logs-b:
	docker compose logs -f backend

detect-abandoned:
	docker compose exec backend python manage.py detect_abandoned

shell:
	docker compose exec backend python manage.py shell

bash:
	docker compose exec backend bash

migrate:
	docker compose exec backend python manage.py migrate

superuser:
	docker compose exec backend python manage.py createsuperuser

test:
	docker compose exec backend pytest

test-parallel:
	docker compose exec backend pytest -n auto

psql:
	docker compose exec postgres psql -U edutest -d edutest

redis:
	docker compose exec redis redis-cli -a redis123

clean:
	docker compose down -v
	docker image prune -f
