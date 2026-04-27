# TSUお仕事マッチングサイト

仕事を依頼したい人と受けたい人をつなぐ掲示板サイトです。

---

## セットアップ手順

### 1. Supabaseのデータベースを準備する

1. [supabase.com](https://supabase.com) にログイン
2. 使いたいプロジェクトを開く（または新規作成）
3. 左メニューの「SQL Editor」をクリック
4. 「New query」をクリックして、以下のSQLをすべてコピー&ペースト → 「Run」を押す

```sql
create extension if not exists "pgcrypto";

create table posts (
  id           uuid primary key default gen_random_uuid(),
  type         text not null check (type in ('hire', 'work')),
  author_name  text not null,
  title        text not null,
  description  text not null,
  contact      text not null,
  budget_range text,
  skills       text,
  experience   text,
  desired_work text,
  created_at   timestamptz default now() not null
);

create table comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references posts(id) on delete cascade,
  author_name text not null,
  content     text not null,
  created_at  timestamptz default now() not null
);

create index on posts (type, created_at desc);
create index on comments (post_id, created_at asc);

alter table posts    enable row level security;
alter table comments enable row level security;

create policy "read posts"      on posts    for select using (true);
create policy "insert posts"    on posts    for insert with check (true);
create policy "read comments"   on comments for select using (true);
create policy "insert comments" on comments for insert with check (true);
```

### 2. SupabaseのURLとキーをコピーする

1. 左メニュー下の「Project Settings（歯車アイコン）」→「API」を開く
2. 以下の2つをコピーする：
   - **Project URL**（`https://xxxxxxxx.supabase.co` の形式）
   - **anon public**（長い文字列のキー）

### 3. script.js に貼り付ける

`script.js` の先頭2行を書き換える：

```js
const SUPABASE_URL = 'ここにProject URLを貼り付け';
const SUPABASE_ANON_KEY = 'ここにanon publicキーを貼り付け';
```

### 4. 動作確認

`index.html` をブラウザで開いて、投稿・コメントが動けば完成！

---

## Vercelへのデプロイ方法

1. [vercel.com](https://vercel.com) にアクセスしてログイン
2. 「Add New → Project」をクリック
3. `job-board` フォルダをドラッグ&ドロップ
4. そのまま「Deploy」を押すだけでOK（設定変更不要）
5. デプロイ完了後にURLが発行される

---

## ファイル構成

```
job-board/
  index.html  ← ページ構造・フォーム
  style.css   ← デザイン
  script.js   ← Supabase連携・動き
  README.md   ← この手順書
```

---

## データをSupabase上で確認・削除する方法

1. Supabaseダッシュボード → 左メニュー「Table Editor」
2. `posts` または `comments` テーブルを選択
3. 行をクリックして選択 → Delete で削除できる

---

## カスタマイズのヒント

| 変更したいこと | 変更する場所 |
|---|---|
| サイト名 | `index.html` の `<title>` と `<h1>` |
| サブタイトル | `index.html` の `<header>` 内の `<p>` |
| タブの文言 | `index.html` のタブボタンのテキスト |
| メインカラー（オレンジ） | `style.css` の `--hire-color` |
| サブカラー（青） | `style.css` の `--work-color` |
