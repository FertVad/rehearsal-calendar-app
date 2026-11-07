# Rehearsal Calendar - Documentation

Complete documentation for the Rehearsal Calendar Native App project.

---

## Quick Start

**New to this project?**
- Start with [Quick Reference](quick-reference.md) - Critical rules (5 min read)
- Then read [CLAUDE.md](../../CLAUDE.md) - Full architecture overview and all critical patterns

---

## Documentation Index

### Core

| Document | Description |
|----------|-------------|
| [CLAUDE.md](../../CLAUDE.md) | **Primary reference** - Architecture, tech stack, critical patterns, environment setup |
| [Quick Reference](quick-reference.md) | Critical rules, common errors and fixes |
| [App Store Release](app-store-release.md) | Пошаговый план релиза в App Store, настройка пушей |
| [Known Issues](known-issues.md) | Найденные, но пока не исправленные дефекты — что именно, где и почему отложено |
| [Сервисы](services.md) | Все внешние сервисы: зачем каждый, какой переменной подключается, что сломается без него |

### API

| Document | Description |
|----------|-------------|
| [API Documentation](api-documentation.md) | Complete REST API reference with examples |
| [API Standards](api-standards.md) | API conventions, naming, error format |

### Server and testing

| Document | Description |
|----------|-------------|
| [Server Runtime](server-runtime.md) | PostgreSQL-only runtime, safe local startup, database lifecycle |
| [Server Migrations](server-migrations.md) | The explicit migration CLI: `--dry`, `--apply`, `--fresh`, `--adopt` |
| [E2E](e2e.md) | Maestro flows on a disposable local stack: how to run, write and tag them |

---

**Last Updated:** 2026-11-06
