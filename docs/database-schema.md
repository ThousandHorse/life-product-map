# データベース設計（Supabase / Postgres）

Phase 2（[implementation-plan.md](implementation-plan.md)）で localStorage から Supabase に移行した際のテーブル設計。
`lib/schema.ts` の6つの Zod スキーマに対応する6テーブルで構成する。

---

## ER 図（関連の概要）

```
goals ──┬── milestones ──┬── tasks
        │                │
        │                └（DetailPane でタスク詳細編集）
        │
daily_reports（目標とは直接紐付かず、日付ベースで独立）

attendance_records ─┐
attendance_settings ─┴（勤怠モード専用、目標管理とは別系統）
```

- `goals` → `milestones` → `tasks` は親子関係（`on delete cascade`）。目標を削除すると紐づくマイルストーン・タスクも連動して削除される
- `daily_reports` と `attendance_records` / `attendance_settings` は他テーブルと外部キー関係を持たない独立テーブル

---

## テーブル一覧

| テーブル | 用途 | 対応する画面 |
|---|---|---|
| [goals](#goals) | 年目標（最大5件） | NavPane（Pane 1） |
| [milestones](#milestones) | 月マイルストーン | TaskListPane（Pane 2、目標モード） |
| [tasks](#tasks) | 週タスク | TaskListPane / DetailPane（Pane 2・3） |
| [daily_reports](#daily_reports) | 日報（1日1件） | DetailPane の「日報を書く」 |
| [attendance_records](#attendance_records) | 勤怠打刻 | AttendancePane / AttendanceListPane（Pane 2・3、勤怠モード） |
| [attendance_settings](#attendance_settings) | 勤怠設定（シングルトン） | AttendancePane の目標稼働時間設定 |

---

## goals

年目標。NavPane に最大5件リスト表示される（5件制限はアプリ側の `yearGoalsSchema.max(5)` で担保、DB側には制約なし）。

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | text | PRIMARY KEY | クライアント生成のID文字列（例: `"goal-1"`） |
| title | text | NOT NULL | 目標名（例: 「TOEIC 800点」） |
| description | text | — | 補足説明（任意） |
| created_at | timestamptz | NOT NULL DEFAULT now() | 作成日時 |
| updated_at | timestamptz | NOT NULL DEFAULT now() | 更新日時 |

---

## milestones

月マイルストーン。目標を月単位に分割したもの。TaskListPane で `<Collapsible>` として展開表示される。

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | text | PRIMARY KEY | クライアント生成のID文字列 |
| goal_id | text | NOT NULL, REFERENCES goals(id) ON DELETE CASCADE | 紐づく目標 |
| year_month | text | NOT NULL | `YYYY-MM` 形式 |
| title | text | NOT NULL | マイルストーン名 |
| progress_status | text | NOT NULL, CHECK (progress_status IN ('ok','caution','danger')) | 進捗ステータス（✅順調 / ⚠️注意 / 🔴危険） |
| created_at | timestamptz | NOT NULL DEFAULT now() | 作成日時 |
| updated_at | timestamptz | NOT NULL DEFAULT now() | 更新日時 |

インデックス: `idx_milestones_goal_id`（goal_id）— 目標ごとの絞り込みを高速化

---

## tasks

週タスク。マイルストーンをさらに週単位に分割したもの。`is_today` フラグが立っているタスクは DetailPane の「今日のタスク一覧」に常時表示される。

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | text | PRIMARY KEY | クライアント生成のID文字列 |
| milestone_id | text | NOT NULL, REFERENCES milestones(id) ON DELETE CASCADE | 紐づくマイルストーン |
| week_label | text | NOT NULL, CHECK (week_label IN ('W1','W2','W3','W4')) | 週ラベル |
| title | text | NOT NULL | タスク名 |
| due_date | date | NOT NULL | 期限（`YYYY-MM-DD`） |
| status | text | NOT NULL, CHECK (status IN ('todo','inProgress','done')) | 進捗状態 |
| priority | text | NOT NULL, CHECK (priority IN ('high','medium','low')) | 優先度 |
| memo | text | — | メモ（任意） |
| is_today | boolean | NOT NULL DEFAULT false | 「今日のタスク」表示フラグ |
| created_at | timestamptz | NOT NULL DEFAULT now() | 作成日時 |
| updated_at | timestamptz | NOT NULL DEFAULT now() | 更新日時 |

インデックス: `idx_tasks_milestone_id`（milestone_id）— マイルストーンごとの絞り込みを高速化

---

## daily_reports

日報。DetailPane の「日報を書く」ボタンから入力する、その日の振り返り・学んだことの記録。1日1件に制限する。

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | text | PRIMARY KEY | クライアント生成のID文字列 |
| date | date | NOT NULL | 対象日（`YYYY-MM-DD`） |
| reflection | text | NOT NULL | 今日の振り返り |
| learned | text | NOT NULL | 学んだこと |
| ai_comment | text | — | AIフィードバック（Phase 1はダミーテキスト、Phase 3でClaude API連携予定） |
| created_at | timestamptz | NOT NULL DEFAULT now() | 作成日時 |
| updated_at | timestamptz | NOT NULL DEFAULT now() | 更新日時 |

インデックス: `idx_daily_reports_date`（date, UNIQUE）— 1日1件の制約をDB側でも担保

---

## attendance_records

勤怠打刻。AttendancePane（出退勤打刻）と AttendanceListPane（月次一覧）で使用する。

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | text | PRIMARY KEY | クライアント生成のID文字列 |
| date | date | NOT NULL | 対象日（`YYYY-MM-DD`） |
| clock_in | timestamptz | — | 出勤時刻（ISO 8601） |
| clock_out | timestamptz | — | 退勤時刻（ISO 8601） |
| break_start | text | — | 休憩開始（`HH:MM` 文字列。time型ではなくtextで保存し、アプリ側の正規表現と変換ロスなく一致させる） |
| break_end | text | — | 休憩終了（`HH:MM` 文字列） |
| work_log | text | — | 作業内容メモ（退勤時に入力） |
| created_at | timestamptz | NOT NULL DEFAULT now() | 作成日時 |
| updated_at | timestamptz | NOT NULL DEFAULT now() | 更新日時 |

インデックス: `idx_attendance_records_date`（date, UNIQUE）— 1日1レコードの制約をDB側でも担保

---

## attendance_settings

勤怠設定。月間目標稼働時間など。ユーザーが1人の前提のため、固定ID `'singleton'` で1行のみ存在するシングルトンテーブル。

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | text | PRIMARY KEY DEFAULT 'singleton' | 固定ID（常に`'singleton'`） |
| target_hours_per_month | integer | NOT NULL, CHECK (target_hours_per_month BETWEEN 0 AND 744) | 月間目標稼働時間 |
| xlsx_template | text | — | Phase 2で予約済み（テンプレートアップロード機能用） |
| column_mapping | jsonb | — | Phase 2で予約済み（列マッピング設定用） |
| updated_at | timestamptz | NOT NULL DEFAULT now() | 更新日時 |

---

## Row Level Security（RLS）

認証機能は未実装（単一ユーザー前提）のため、全テーブルで RLS を**有効化**したうえで「全員許可」のポリシーを敷いている。

```sql
create policy "allow all (no auth yet)" on public.<table> for all using (true) with check (true);
```

RLSを無効化せず有効化+全許可にしている理由は、将来認証を追加する際にポリシー文を `using (auth.uid() = user_id)` 等に書き換えるだけで済むようにするため（テーブルへの `user_id` カラム追加とポリシー変更の2点で認証対応が完結する設計）。

> **⚠️ 既知のリスク（TODO: Phase 2.5・認証導入時に解消）**
> `NEXT_PUBLIC_SUPABASE_ANON_KEY` はブラウザに公開される値であり、上記の「全員許可」ポリシーと組み合わさると、本番URLとこのキーが分かれば**第三者が全テーブルのデータを読み書き・削除できる**（PR #21 への Codex レビュー指摘で識別）。
> 個人の動作確認・プロトタイプ用途として、本番URLを他人に共有しない運用で限定的に許容している。公開を広げる場合や本番運用を前提にする場合は、認証導入（Supabase Auth）とRLSポリシーの `user_id` スコープ化を先に行うこと。

---

## 既知の制約事項（データ整合性）

> **⚠️ 保存順序が未保証（goals → milestones → tasks）**
> `goals` / `milestones` / `tasks` は外部キー制約（`ON DELETE CASCADE`）を持つ親子関係だが、クライアント側（`lib/use-debounced-save.ts`）はエンティティごとに**独立した800msデバウンスタイマー**で `save()` を呼ぶ。そのため、新規目標とその配下の新規マイルストーンを同一800ms以内に連続追加した場合、保存リクエストの到達順序が入れ替わり `sync_milestones` RPC が `sync_goals` RPC より先にサーバーへ到達すると、存在しない `goal_id` を参照しようとして**外部キー制約違反でエラーになり得る**。
>
> このエラーは `storage-supabase.ts` の `save()` 内 try-catch で握りつぶされ `console.error` に記録されるのみで、**ユーザーには一切通知されない**。保存が失敗したことに気づかないまま作業が続行され、リロード後に該当データが消えている形で発覚する可能性がある。
>
> 現状は個人利用のプロトタイプ用途であり、UI上も目標・マイルストーンは別々のダイアログで都度追加する操作性のため、800ms以内に親子を連続追加する操作は稀と判断し、対応を見送っている。**マルチユーザー化や本番運用を見据える場合は、保存処理を「goals → milestones → tasks の順に直列 await する専用の保存フロー」に置き換えることを先に行うこと。** 現行の `useDebouncedSave` はエンティティ単位で独立させる設計上、この順序保証を持たない。

---

## 命名規則・型に関する注意

- **id は text 型**: DB側で自動生成せず、クライアント側で生成済みのID文字列（`crypto.randomUUID()` やシードデータの `"goal-1"` 等）をそのまま保存する。アプリ側のID生成ロジック（`Workspace.tsx` の各 `handleAdd*`）を変更不要にするための設計判断
- **camelCase ⇄ snake_case**: アプリ側（`schema.ts`）は camelCase、DBカラムは snake_case。変換は `lib/storage-supabase.ts` の境界でのみ行い、他のコードはこの差異を意識しない
- **削除の反映方式**: アプリのstate（配列）が変わるたびに、現在のstateに含まれるIDを upsert し、含まれなくなったIDの行を `DELETE ... WHERE id NOT IN (...)` で削除する。upsertだけでは削除が反映されないため、削除も合わせて行う必要がある。全件削除→再投入ではなく差分削除にしているのは、削除とupsertの間で失敗が起きた場合にデータが消失するリスク（アトミック性の欠如）を避けるため。Postgres関数（RPC）化し、削除とupsertを1つのトランザクションにまとめて実行する（詳細は Step 13 の実装で `lib/storage-supabase.ts` に反映）
