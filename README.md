# Sports Activity Organizer (EkipAY)

Веб-платформа за организирање на рекреативни спортски настани

## Технологии

| Слој | Технологија |
|------|-------------|
| Backend | .NET 8 |
| База | PostgreSQL |
| Frontend | React 19 + TypeScript + Vite + Material UI |
| Авт. | JWT (access + refresh token) |
| Мапи | Google Maps JavaScript API |
| Email | SendGrid (HTTP API) |
| Деплој | Railway (frontend `filda.cfd`) |

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

## Тест корисници (seed)

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
