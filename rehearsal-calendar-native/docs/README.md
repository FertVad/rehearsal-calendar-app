# 📚 Rehearsal Calendar - Documentation

Complete documentation for the Rehearsal Calendar Native App project.

---

## 🚀 Quick Start

**New to this project?**
- Start with [Quick Reference](quick-reference.md) - Critical rules (5 min read)
- Then read [Project Info](project-info.md) - Architecture overview (10 min read)

**For AI Assistants:**
- See [/.claude/](../.claude/) folder for detailed AI instructions and guidelines

---

## 📖 Documentation Index

### Core Documentation

#### [Project Info](project-info.md)
Complete project overview including:
- Technology stack (React Native, Express, PostgreSQL)
- Architecture and folder structure
- Database tables and schema
- Environment setup and installation
- Troubleshooting guide

#### [Quick Reference](quick-reference.md)
Ultra-short critical rules for AI assistants:
- Common errors and fixes
- Authentication patterns
- Database query patterns
- Timezone handling

---

### API Documentation

#### [API Documentation](api-documentation.md)
REST API specification:
- Complete endpoint reference
- Request/response examples
- Data models and types
- Error handling patterns
- Authentication flow

#### [API Standards](api-standards.md)
API conventions and best practices:
- Naming conventions
- Error response format
- Pagination patterns
- Parameter validation
- Code examples

---

### Guides

#### [Localization Guide](localization-guide.md)
Internationalization (i18n) guide:
- How to add new translations
- Supported languages (Russian, English)
- Translation file structure
- Dynamic content localization
- Best practices

---

## 🗂 Additional Documentation

### For AI Assistants (/.claude/)

Advanced documentation for AI assistants working on this project:

- **[AI_INSTRUCTIONS.md](../.claude/AI_INSTRUCTIONS.md)** - Critical rules and patterns
- **[CHECKLIST.md](../.claude/CHECKLIST.md)** - Pre-change verification checklist
- **[CODE_EXAMPLES.md](../.claude/CODE_EXAMPLES.md)** - Copy-paste ready code patterns
- **[DB_SCHEMA.md](../.claude/DB_SCHEMA.md)** - Database schema (source of truth)
- **[TESTING_ROADMAP.md](../.claude/TESTING_ROADMAP.md)** - Testing plan (478 tests)
- **[GETTING_STARTED.md](../.claude/GETTING_STARTED.md)** - First 5 minutes guide
- **[DOCUMENTATION_MAP.md](../.claude/DOCUMENTATION_MAP.md)** - Complete navigation guide

---

## 🔗 Quick Links

| Task | Documentation |
|------|---------------|
| Setup dev environment | [project-info.md](project-info.md#getting-started) |
| Add new API endpoint | [api-documentation.md](api-documentation.md) |
| Modify database schema | [../.claude/DB_SCHEMA.md](../.claude/DB_SCHEMA.md) |
| Add translations | [localization-guide.md](localization-guide.md) |
| Debug timezone issues | [project-info.md](project-info.md#timezone-handling) |
| Run tests | `npm test` |
| Before code changes | [../.claude/CHECKLIST.md](../.claude/CHECKLIST.md) |

---

## 📁 Project Structure

```
reh_app/
├── .claude/              # AI assistant documentation
│   ├── AI_INSTRUCTIONS.md
│   ├── CHECKLIST.md
│   ├── CODE_EXAMPLES.md
│   ├── DB_SCHEMA.md
│   └── ...
├── docs/                 # Project documentation (you are here)
│   ├── README.md
│   ├── quick-reference.md
│   ├── project-info.md
│   ├── api-documentation.md
│   ├── api-standards.md
│   └── localization-guide.md
└── rehearsal-calendar-native/
    ├── src/              # React Native app
    ├── server/           # Express backend
    └── ...
```

---

## 🎯 Documentation Philosophy

1. **Single Source of Truth**: Each topic has one authoritative document
2. **AI-Friendly**: Optimized for AI assistants (clear structure, examples)
3. **DRY Principle**: No duplicate information across files
4. **Always Up-to-Date**: Update docs when code changes
5. **Quick Reference First**: Start with quick-reference.md, dive deeper as needed

---

## 📝 Contributing to Docs

When updating documentation:

1. **Keep it concise** - Remove outdated information
2. **Add examples** - Code examples are better than descriptions
3. **Update links** - If you move files, update all references
4. **Test links** - Ensure all relative links work
5. **Date updates** - Add "Last Updated" date at bottom

---

**Last Updated:** 2026-01-11
**Maintained By:** AI + Development Team
