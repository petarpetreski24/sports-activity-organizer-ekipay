# Sport Activity Organizer (EkipAY)

Веб-платформа за организирање на рекреативни спортски настани — креирање настани,
пребарување по локација/спорт, пријавување со одобрување, коментари, оценки и
известувања. Изработено според приложениот SRS документ
(`Software Requirements Specification-259088.docx`).

## Технологии

| Слој | Технологија |
|------|-------------|
| Backend | .NET 8 Web API (Clean Architecture: API / Application / Domain / Infrastructure) |
| База | PostgreSQL 15+ со Entity Framework Core |
| Frontend | React 19 + TypeScript + Vite + Material UI |
| Авт. | JWT (access + refresh token) |
| Мапи | Google Maps JavaScript API |
| Email | SendGrid (HTTP API) |
| Деплој | Railway (backend `api.filda.cfd`, frontend `filda.cfd`) |

## Предуслови

- [.NET 8 SDK](https://dotnet.microsoft.com/download)
- [Node.js 20+](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/) (за PostgreSQL и MailHog)

## Локален развој

### 1. Инфраструктура (PostgreSQL + MailHog)

```bash
docker compose up -d db mailhog
```

- PostgreSQL: `localhost:5432` (db `sportactivityorganizer`, user `sao_user`, pass `sao_password_dev`)
- MailHog UI: <http://localhost:8025>

> **Note (Windows):** ако веќе имате нативен PostgreSQL сервис на порта `5432`,
> тој ќе го засени Docker контејнерот. Креирајте `docker-compose.override.yml`
> што ја објавува базата на друга порта (пр. `5433:5432`) и користете ја таа
> порта во connection string-от.

### 2. Backend

```bash
cd backend
dotnet restore
dotnet run --project src/SportActivityOrganizer.API --urls "http://localhost:5000"
```

Миграциите и seed податоците се применуваат автоматски при стартување.
Swagger: <http://localhost:5000/swagger>

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

App: <http://localhost:5173> (Vite proxy ги препраќа `/api` и `/uploads` на `:5000`)

### Алтернатива: сѐ преку Docker

```bash
docker compose up --build
```

## Конфигурација (environment variables)

Backend (`appsettings.json` или env):

| Клуч | Опис |
|------|------|
| `ConnectionStrings__DefaultConnection` | PostgreSQL connection string |
| `DATABASE_URL` | (Railway) има предност пред горниот |
| `Jwt__Key` / `Jwt__Issuer` / `Jwt__Audience` | JWT поставки |
| `Email__SmtpPassword` | SendGrid **API key** |
| `Email__FromEmail` / `Email__FromName` | верифициран SendGrid испраќач |
| `App__FrontendUrl` | URL на frontend (за email линкови, CORS) |

Frontend (`frontend/.env`):

| Клуч | Опис |
|------|------|
| `VITE_API_URL` | URL на backend API |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps клуч |

## Тест сметки (seed)

Сите seed корисници имаат лозинка `Password123!`.

| Сметка | Улога |
|--------|-------|
| `admin@sportactivityorganizer.com` | Администратор |
| `user2@sportactivityorganizer.com` … `user30@…` | Регистрирани корисници |

## Структура

```
backend/src/
  SportActivityOrganizer.API            # Controllers, middleware, Program.cs
  SportActivityOrganizer.Application     # DTOs, interfaces, mapping
  SportActivityOrganizer.Domain          # Entities, enums
  SportActivityOrganizer.Infrastructure  # EF Core, services, repositories
frontend/src/
  api/  components/  contexts/  pages/  types/
scripts/
  seed_future_events.py                  # additive seed of future events via API
```

## Скрипти

- `scripts/seed_future_events.py` — додава идни настани + пријави/одобрувања/
  коментари/оценки преку API (за тестирање на сите функционалности).
  Стартувајте го backend-от со празен SendGrid клуч за да избегнете праќање
  емаили при сеирање.

## Деплој

Backend и frontend имаат `railway.toml` (Dockerfile builder). CI
(`.github/workflows/ci.yml`) ги гради двата проекти и Docker сликите при
push на `main`.
