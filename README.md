# @theyahia/planfix-mcp

MCP-сервер для Planfix API — задачи, контакты, проекты. **3 инструмента.**

[![npm](https://img.shields.io/npm/v/@theyahia/planfix-mcp)](https://www.npmjs.com/package/@theyahia/planfix-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Часть серии [Russian API MCP](https://github.com/theYahia/russian-mcp) (50 серверов) by [@theYahia](https://github.com/theYahia).

## Установка

### Claude Desktop

```json
{
  "mcpServers": {
    "planfix": {
      "command": "npx",
      "args": ["-y", "@theyahia/planfix-mcp"],
      "env": { "PLANFIX_TOKEN": "your-token" }
    }
  }
}
```

### Claude Code

```bash
claude mcp add planfix -e PLANFIX_TOKEN=your-token -- npx -y @theyahia/planfix-mcp
```

### VS Code / Cursor

```json
{ "servers": { "planfix": { "command": "npx", "args": ["-y", "@theyahia/planfix-mcp"], "env": { "PLANFIX_TOKEN": "your-token" } } } }
```

### Windsurf

```json
{ "mcpServers": { "planfix": { "command": "npx", "args": ["-y", "@theyahia/planfix-mcp"], "env": { "PLANFIX_TOKEN": "your-token" } } } }
```

> Требуется `PLANFIX_TOKEN`. Получите в настройках Planfix (API-токен).

## Инструменты (3)

| Инструмент | Описание |
|------------|----------|
| `get_tasks` | Список задач с пагинацией и фильтрами |
| `create_task` | Создание новой задачи |
| `get_contacts` | Список контактов с пагинацией и фильтрами |

## Примеры

```
Покажи мои задачи в Planfix
Создай задачу "Подготовить отчёт" в проекте 123
Список контактов
```

## Лицензия

MIT
