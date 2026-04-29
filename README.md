# My Courses — Angular + Supabase

Особистий додаток для створення курсів: текст + видео (YouTube / Vimeo embed).
Кожен користувач бачить лише свої курси та уроки (через Supabase Row-Level Security).

## Стек
- Angular 21 (standalone, signals)
- Supabase (Auth + Postgres + RLS)

## Налаштування за 5 хвилин

### 1. Створити проєкт у Supabase
1. Зайти на https://supabase.com → New project.
2. Скопіювати **Project URL** і **anon public key** з `Settings → API`.

### 2. Прописати ключі
Відкрити `src/environments/environment.ts` і `environment.prod.ts`, замінити:
```ts
supabaseUrl: 'https://xxxxx.supabase.co',
supabaseAnonKey: 'eyJhbGciOi...'
```

### 3. Створити БД
У Supabase: `SQL Editor → New query`, вставити вміст файлу `supabase/schema.sql`, натиснути **Run**.
Це створить таблиці `courses`, `lessons` і політики RLS — кожен юзер бачитиме лише свої записи.

### 4. Запустити
```bash
npm install
npm start
```
Відкрити http://localhost:4200.

## Як користуватися
1. Зареєструватися (за замовчуванням Supabase надсилає лист підтвердження — у `Authentication → Providers → Email` можна вимкнути `Confirm email` для тестів).
2. Створити курс → відкрити його → додати уроки.
3. У полі URL уроку вставити посилання на YouTube (`https://youtube.com/watch?v=...` або `https://youtu.be/...`) або Vimeo — додаток автоматично перетворить на embed.

## Структура
```
src/app/
  core/        # supabase, auth, courses сервіси, guard, моделі
  auth/        # login, register
  courses/     # course-list, course-detail (з уроками)
supabase/
  schema.sql   # таблиці + RLS
```
