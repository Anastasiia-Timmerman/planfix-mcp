# @theyahia/planfix-mcp

MCP-сервер для Planfix API — задачи, проекты, контакты, комментарии. **10 инструментов, 2 навыка.**

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
      "env": {
        "PLANFIX_API_KEY": "your-api-key",
        "PLANFIX_ACCOUNT": "your-subdomain"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add planfix \
  -e PLANFIX_API_KEY=your-api-key \
  -e PLANFIX_ACCOUNT=your-subdomain \
  -- npx -y @theyahia/planfix-mcp
```

### Streamable HTTP (удалённый сервер)

```bash
PLANFIX_API_KEY=your-key PLANFIX_ACCOUNT=your-sub npx @theyahia/planfix-mcp --http 8080
```

Эндпоинт: `http://localhost:8080/mcp`
Health check: `http://localhost:8080/health`

### Smithery

[![smithery badge](https://smithery.ai/badge/@theyahia/planfix-mcp)](https://smithery.ai/server/@theyahia/planfix-mcp)

```bash
npx -y @smithery/cli install @theyahia/planfix-mcp --client claude
```

### VS Code / Cursor

```json
{
  "servers": {
    "planfix": {
      "command": "npx",
      "args": ["-y", "@theyahia/planfix-mcp"],
      "env": {
        "PLANFIX_API_KEY": "your-api-key",
        "PLANFIX_ACCOUNT": "your-subdomain"
      }
    }
  }
}
```

### Windsurf

```json
{
  "mcpServers": {
    "planfix": {
      "command": "npx",
      "args": ["-y", "@theyahia/planfix-mcp"],
      "env": {
        "PLANFIX_API_KEY": "your-api-key",
        "PLANFIX_ACCOUNT": "your-subdomain"
      }
    }
  }
}
```

## Авторизация

| Переменная | Обязательная | Описание |
|-----------|-------------|----------|
| `PLANFIX_API_KEY` | Да | API-ключ. Получите: Настройки > Интеграции > API |
| `PLANFIX_ACCOUNT` | Рекомендуется | Субдомен (например `mycompany` из `mycompany.planfix.com`) |
| `PLANFIX_TOKEN` | Нет | Устаревший вариант, используйте `PLANFIX_API_KEY` |

Base URL: `https://{PLANFIX_ACCOUNT}.planfix.com/rest/` (если `PLANFIX_ACCOUNT` задан).

## Инструменты (10)

| Инструмент | Описание |
|------------|----------|
| `get_tasks` | Список задач с пагинацией и фильтрами |
| `get_task` | Одна задача по ID |
| `create_task` | Создание новой задачи |
| `update_task` | Обновление задачи (название, описание, статус, исполнитель) |
| `get_contacts` | Список контактов с пагинацией и фильтрами |
| `get_contact` | Один контакт по ID |
| `get_projects` | Список проектов с пагинацией |
| `get_project` | Один проект по ID |
| `get_comments` | Комментарии к задаче |
| `add_comment` | Добавить комментарий к задаче |

## Навыки (Skills / Prompts) (2)

| Навык | Описание |
|-------|----------|
| `skill-my-tasks` | "Мои задачи на сегодня" — показывает задачи с дедлайном сегодня или просроченные |
| `skill-create-task` | "Создай задачу в проекте" — пошаговый помощник для создания задачи с выбором проекта |

## Примеры

```
Покажи мои задачи в Planfix
Создай задачу "Подготовить отчёт" в проекте 123
Список контактов
Покажи проекты
Добавь комментарий к задаче 456: "Готово"
```

## Разработка

```bash
npm install
npm test        # Vitest (17 тестов)
npm run dev     # tsx watch
npm run build   # TypeScript compile
```

## Planfix — реферальная программа

**35% бессрочный recurring** от всех платежей приведённых клиентов.

- Без сертификации — просто зарегистрируйтесь в партнёрской программе
- Recurring: получаете 35% каждый месяц, пока клиент платит
- Бессрочно: нет ограничений по времени выплат

Подробнее: [planfix.com/partners](https://planfix.com/ru/partner-program/)

## Лицензия

MIT
