# Planfix — как работать (playbook)

Практическая шпаргалка по интеграции Planfix. Два входа поверх **одного ядра**
(`src/client.ts` + `src/tools/`):

- **`planfix` (CLI)** — для Claude Code, из любой папки. Обёртка `/usr/local/bin/planfix`.
- **MCP-сервер** — для Claude Desktop (`dist/index.js` через `bin/planfix-mcp-launcher.cjs`).

Оба берут ключ из **связки ключей macOS** (Keychain), а не из конфигов.

---

## 1. Что где лежит

| Что | Где |
|-----|-----|
| Код | `~/.local/share/planfix-mcp` (git, ветка `main`) |
| Обёртка CLI | `/usr/local/bin/planfix` |
| Несекретный конфиг | `~/.config/planfix/config.json` → `account`, `base_url` |
| API-ключ | Keychain: служба `planfix`, аккаунт `aromateam` |
| Аккаунт | `aromateam`, база `https://aromateam.planfix.ru/rest` (обрати внимание: **`.ru`**) |
| Лог MCP | `~/Library/Logs/Claude/planfix-mcp-launcher.log` |

Проверить, что всё на месте: `planfix accounts` → должно быть `"keyPresent": true`.

---

## 2. Команды

```
planfix help                 # список всех команд
planfix accounts             # аккаунт/URL и есть ли ключ

# Задачи
planfix tasks [--projectId N --statusId N --pageSize N --dateFrom YYYY-MM-DD --dateTo YYYY-MM-DD]
planfix task --taskId N [--includeDescription --includeParticipants]
planfix task-checklist --taskId N
planfix create-task --name "..." [--description "..." --projectId N --assigneeId N --priority high]
planfix update-task --taskId N [--status N --description "..." --name "..."]

# Комментарии
planfix comments --taskId N
planfix add-comment --taskId N --body "текст"

# Проекты
planfix projects
planfix project --projectId N
planfix create-project --name "..." [--description "..." --ownerId N]
planfix update-project --projectId N [--name "..." --status N]

# Контакты
planfix contacts
planfix contact --contactId N

# Справочники
planfix statuses
planfix task-fields          # кастомные поля задач (id, name, type)
planfix project-fields
planfix task-templates
planfix project-templates
```

Вывод — всегда JSON (удобно парсить). Флаги: `--ключ значение` или `--ключ=значение`;
булевы — просто `--includeDescription`.

---

## 3. Ключевые понятия

**Люди и группы.** Исполнители/постановщики задаются как `user:1`, `contact:1`, `group:5`
или просто числом (тогда трактуется как пользователь). Пример:
```
planfix create-task --name "Позвонить" --assigneeId user:12
planfix create-task --json '{"name":"X","assignees":{"users":[12,15],"groups":[3]}}'
```

**Даты.** Пиши в формате `YYYY-MM-DD` — код сам переведёт в формат Planfix.
```
planfix tasks --dateFrom 2026-07-01 --dateTo 2026-07-16
```

**Кастомные поля.** Сначала узнай их `fieldId` через `planfix task-fields`, потом:
```
planfix create-task --json '{"name":"X","customFieldData":[{"fieldId":13200,"value":8}]}'
```
(У тебя уже есть, например: `13200` План. время, `23776` Приоритет, `23778` Спринт неделя.)

**Пагинация.** `--offset` и `--pageSize` (по умолчанию 100). Свежие задачи сверху
(сортировка по дате создания, desc).

**Сложные параметры.** Всё, что не влезает в простые флаги (массивы, вложенные объекты),
передавай через `--json '{...}'` — он мёржится с остальными флагами.

---

## 4. Рецепты

**Последние задачи проекта:**
```
planfix tasks --projectId 42 --pageSize 10
```

**Создать задачу с дедлайном и исполнителем:**
```
planfix create-task --name "Отгрузка WB" --projectId 42 --assigneeId user:12 \
  --json '{"endDateTime":"2026-07-20","priority":"high"}'
```

**Добавить комментарий:**
```
planfix add-comment --taskId 10743 --body "Готово, отправила на проверку"
```

**Сменить статус задачи** (ID статусов — через `planfix statuses`):
```
planfix update-task --taskId 10743 --status 3
```

**Полная задача с описанием** (по умолчанию описание не тянется — так быстрее):
```
planfix task --taskId 10743 --includeDescription
```

---

## 5. Готчи (проверено)

- **Связи задач (`link-tasks`) и удаление задач Planfix REST не поддерживает** —
  вернётся явная ошибка. Это ограничение API, не баг.
- **`planfix task` по умолчанию НЕ грузит описание/комментарии/участников** — чтобы
  тяжёлые задачи не зависали. Добавляй `--includeDescription` и т.п. по необходимости.
- **База — `.ru`** (`aromateam.planfix.ru`), а не `.com`. Уже прописано в конфиге.
- **Вложения CLI не отдаёт** (09.10.2026). Прямой REST с тем же ключом из Keychain: список —
  `GET task/<id>/files` (или `files` в `POST task/<id>/comments/list`), скачать —
  `GET file/<fileId>/download`. Проверено на .docx из задачи 14511.
- **ID сотрудников** для `assigneeId` проще всего подсмотреть в URL Planfix или в поле
  `assignees` уже существующей задачи (`planfix task --taskId N`).

---

## 6. Обслуживание

- Поправил(а) код в `src/*.ts` → пересобрать: `cd ~/.local/share/planfix-mcp && npm run build`.
- Пропали зависимости (`ERR_MODULE_NOT_FOUND`) → `npm install` в той же папке.
- Сменить/обновить ключ в Keychain:
  `security add-generic-password -U -s planfix -a aromateam -w "НОВЫЙ_КЛЮЧ"`.
- Аутентификация: заголовок `Authorization: Bearer <ключ>`; таймаут запроса 30с,
  ретраи на 429/5xx.

---

## 7. Официальная документация

Полный справочник эндпоинтов: **https://help.planfix.com/restapidocs/**
(страница рендерится через JS — открывать в браузере). Там же — как получить/выпустить
API-ключ в разделе *Аккаунт → API*.
