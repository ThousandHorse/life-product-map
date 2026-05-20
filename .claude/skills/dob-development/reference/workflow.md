# 実装ワークフロー

## 大原則

- **1 Step ずつ着実に進める**: 複数の Step を一度に実装しない。1つの Step が完了・確認できてから次に移る
- **PR のマージはユーザーが手動で行う**: `gh pr merge` は使わない。PR を作成したら、ユーザーがマージするまで次の Step に進まず待つ
- **マージ確認後に次の Step へ**: ユーザーから「マージした」「次進めて」などの明示的な指示があってから次の Step の実装を開始する
- **main / develop への直接 push 禁止**: コード変更は必ず feature ブランチで行い PR 経由でマージする
- **feature ブランチは必ず develop から切る**: `git checkout -b feature/step-XX-xxx develop`。main から切らない
- **PR のベースは develop**: feature → develop へ PR を出す。develop → main は定期リリース時にまとめてマージ

---

## Step 1: 仕様確認（実装前）

`reference/steps.md` から対象 Step の仕様を確認する。  
**複数ファイルにまたがる確認や、既存コードとの整合チェックはサブエージェント（`Explore`）に委譲する。**

```
Agent(subagent_type="Explore", prompt="
  以下を読んで、Step XX の実装に必要な情報をまとめてください。

  確認対象:
  - .claude/skills/dob-development/reference/steps.md（Step XX の仕様・完了条件）
  - lib/schema.ts（関連する型・スキーマ）
  - [既存の関連ファイルがあれば列挙]

  返してほしい内容:
  1. 作成・変更するファイル一覧
  2. 完了条件（箇条書き）
  3. 依存する前 Step・注意事項
")
```

確認項目:
1. この Step で作成・変更するファイル名
2. 完了条件チェックリスト（全項目）
3. この Step が依存する前の Step
4. 実装のポイントや注意事項（記載があれば）

## Step 2: 実装

完了条件を全て満たすこと。コメントポリシー（[comment-policy.md](comment-policy.md)）に従ってコメントを書く。

## Step 3: PR 作成前コードレビュー

### 3-1. サブエージェントによるレビュー

実装完了後、PR を作成する前にサブエージェントにコードレビューを依頼する。

```
Agent(prompt="
  以下のファイルをレビューしてください。

  レビュー対象:
  - [実装したファイルのパスを列挙]

  確認観点:
  1. TypeScript strict モード: 型エラーがないか
  2. shadcn base-nova: asChild ではなく render prop を使っているか
  3. 色トークン: bg-blue-500 等の色番号直書きがないか
  4. 間隔管理: space-y-* を使っていないか（flex gap-* を使う）
  5. コメント: WHY を書いているか、WHAT だけのコメントがないか
  6. steps.md の完了条件を全て満たしているか

  問題点があれば具体的なファイル名・行番号と修正案を返してください。
  問題なければ「レビュー問題なし」と返してください。
")
```

サブエージェントの指摘は全て対応してから次のステップへ進む。

### 3-2. 自己確認

1. **ビルド**: `npm run build` でエラーがないか
2. **型チェック**: `npm run lint` でエラーがないか
3. **完了条件**: steps.md の完了条件を全て満たしているか

## Step 4: PR 作成

```bash
# feature ブランチをリモートにプッシュ
git push origin feature/step-XX-description

# PR を作成する（必ず --base develop を指定すること）
gh pr create --base develop --title "Step-XX: タイトル"
```

> ⚠️ `--base develop` を**必ず**付けること。省略するとデフォルトブランチ（main）がベースになってしまう。

> ⚠️ **禁止事項（厳守）**
> - `git push origin main` / `git push origin develop` → 直接 push は禁止
> - `gh pr merge` → CLI でのマージ操作は禁止。マージはユーザーが手動で行う

PR 概要の書き方: [pr-template.md](pr-template.md)

## Step 5: レビュー指摘対応

PR に bot（gemini-code-assist / chatgpt-codex など）や reviewer からレビュー指摘が来た場合、以下の手順で対応する。

### 5-1. 指摘内容の確認

```bash
gh api repos/$(gh repo view --json nameWithOwner -q .nameWithOwner)/pulls/{PR番号}/comments \
  --jq '.[] | {id: .id, author: .user.login, path: .path, body: .body}'
```

### 5-2. 修正・コミット・プッシュ

指摘に対してコードまたはドキュメントを修正し、feature ブランチにコミット＆プッシュする。

### 5-3. 対応済みスレッドにリプライ

```bash
gh api repos/$(gh repo view --json nameWithOwner -q .nameWithOwner)/pulls/{PR番号}/comments/{comment_id}/replies \
  -X POST --input - << 'EOF'
{
  "body": "対応しました。\n\n〇〇を修正しました（[commit_hash](https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/commit/commit_hash)）。\n\n---\n*Comment by Claude*"
}
EOF
```

リプライのフォーマット：
```
対応しました。

- 修正内容: 〇〇を〇〇に変更
- 対応 commit: [abc1234](https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/commit/abc1234)

---
*Comment by Claude*
```

> ⚠️ **必須**: リプライ末尾に必ず `---\n*Comment by Claude*` を付けること。AI によるコメントであることをレビュアーが識別できるようにする。
> ⚠️ **必須**: commit ハッシュは必ずリンク形式にすること。

### 5-4. Resolve はユーザーが手動で行う

**Claude はリプライを投稿するところまで**。対応不要と判断した指摘もその理由をリプライに書いてユーザーに Resolve を依頼する。

---

## Step 6: ユーザーのマージ待ち

PR 作成後は**ユーザーがマージするまで次の Step に進まない**。

ユーザーから「マージした」「次進めて」などの指示を受けてから:

```bash
# develop を最新化してから次の feature ブランチを切る
git checkout develop
git pull origin develop
git checkout -b feature/step-XX-next-description
```

---

## サブエージェントの使い方

複数ファイルにまたがる調査や並列で実行できる作業はサブエージェントに委譲する。

### 使うべき場面

| 場面 | 使うエージェント |
|---|---|
| ファイル・シンボルの探索（コードを書かない調査） | `Explore` |
| 実装方針の設計・トレードオフ検討 | `Plan` |
| 上記以外の汎用タスク | `claude`（デフォルト） |

### Explore エージェントの使い方

実装前にコードを書かずに調査だけしたい場合に使う。

```
Agent(subagent_type="Explore", prompt="
  以下のファイルを読んで現状を把握してください:
  - lib/schema.ts（データモデルの確認）
  - reference/steps.md の Step XX（完了条件の確認）
  結果をそのまま返してください。
")
```

- 独立した調査は**並列**で複数エージェントを同時起動してよい（最大3つ）
- 依存関係がある場合は順番に起動する

### サブエージェントに渡す情報

サブエージェントはこの会話の文脈を持たないため、プロンプトに以下を必ず含める:
- 調査対象のファイルパス
- 何を確認したいか（具体的に）
- 返してほしい形式

### スキルファイルの更新

仕様変更があったときは実装前にサブエージェントで現状調査し、変更箇所を特定してから更新する。
更新対象は `SKILL.md` の「スキルの更新ルール」を参照。
