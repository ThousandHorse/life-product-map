# コンテキストウィンドウ逼迫時の引き継ぎ

コンテキストウィンドウが逼迫してきたと感じたら、次のチャットへ引き継ぐために以下を行う。

## 引き継ぎのタイミング

作業の区切り（PR 作成後・マージ後・指摘対応後）で逼迫していたら、そのタイミングで引き継ぐ。
作業の途中でも逼迫が深刻な場合は、現状をコミット・プッシュしてから引き継ぐ。

## 引き継ぎ前にやること

1. **未コミットの変更をコミット・プッシュする**
2. **現在の作業状況をユーザーに伝える**（何をしていたか・次に何をするか）
3. **ユーザーに新しいチャットを開くよう促す**

## 引き継ぎ書テンプレート

引き継ぎメッセージは以下のテンプレートを使う。過去のレビュー指摘・対応履歴や設計の背景説明は書かない（コミットログ・PR・実装プランに既に残っているため、引き継ぎ書では重複させない）。「今どこにいて、次に何をするか」だけに絞る。

**⚠️ 出力時の注意**: コードブロックが分割されて表示されると引き継ぎ書として使いにくくなる。テンプレート全体を**1つのコードブロックで一括表示**すること。

**⚠️ タイトルに必ずPR番号を含める**: `# 引き継ぎ書 (Resume from PR #XX review)` のように書く。新しいチャットのAIが `gh api .../pulls/XX/comments` で直接レビューコメントを取得できるようにするため。

**⚠️ 「次のアクション」はPRの状態で分岐させる**: 直前のPRが「マージ済み」なら次のStepの新規ブランチを切ってよいが、「レビュー待ち」「指摘対応中」の場合は新規ブランチを切ってはいけない。PRの feature ブランチには未マージのコミットが乗っており、`develop` から新規ブランチを切るとその履歴が欠落し、レビュー対応のpushが non-fast-forward で失敗する。レビュー対応中は既存のPRブランチを取得してチェックアウトする。

```
# 引き継ぎ書 (Resume from PR #XX review)

## 現状

- **ブランチ**: feature/step-XX-xxx
- **直前のPR**: #NN（URL） — マージ済み / レビュー待ち / 指摘対応中
- **次にやること**: Step XX（〇〇）に着手する

## 読むべきファイル

.claude/skills/<skill-name>/SKILL.md
<実装プランのパス（あれば）>

## 次のアクション

### 直前のPRがマージ済みの場合（次のStepに進む）

git checkout develop
git pull origin develop
git checkout -b feature/step-XX-xxx

〇〇を実装する。詳細は実装プランの Step XX セクション参照。

### 直前のPRがレビュー待ち・指摘対応中の場合（既存PRの続きをやる）

git fetch origin
git checkout feature/step-XX-xxx
git pull origin feature/step-XX-xxx

gh api repos/$(gh repo view --json nameWithOwner -q .nameWithOwner)/pulls/NN/comments --jq '.[] | {id: .id, author: .user.login, path: .path, body: .body}'

PR #NN のレビュー指摘に対応する。手順は workflow.md の Step 5 参照。
```

## 新しいチャットで再開する方法

新チャットでは **まず以下のスキルファイルを読んでから作業を開始する**。

```
.claude/skills/dob-development/SKILL.md
.claude/skills/dob-development/reference/steps.md
.claude/skills/dob-development/reference/workflow.md
```

読み込み後、ユーザーから上記の引き継ぎ書テンプレートを埋めたものを伝えてもらうだけで再開できる。
