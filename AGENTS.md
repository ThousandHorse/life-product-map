<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Code Review Rules

### 言葉と観点

- レビューの題名・本文・要約は、中学生でも分かる自然な日本語で書く。技術用語はそのまま使ってよい。
- 不具合、セキュリティ、テストの改ざん、承認済みの範囲との不一致を、差分と呼び出し元を確かめて指摘する。好みだけの変更や未確認の推測は指摘しない。
- 修正済みの指摘は繰り返さず、各pushでは変更箇所と影響範囲を確認する。

### 指摘の形

```text
🎯 <観点> | <重大度> | <直しやすさ>
<事実を1行で書き、句点で終える。>

<理由。複数なら体言止めの箇条書きで3件まで。>

<直してほしいこと>してください！

修正案
<suggestionではなくdiffで示す。案が無ければ「修正案」の行も省く。>
```

重大度は🔴 high（マージ前に直す）、🟡 medium（このPRで直す）、🔵 low（マージを止めない）。直しやすさは⚡ すぐ、🔧 手間あり、🏗 設計に戻る。感嘆符は一押しの1行だけで使う。

## 公式CodexレビューとPRの完了

- 全作成者のPRを対象に、レビュー可能になった初回と各pushで公式Codexレビューを行う。
- PR作成を頼まれた担当AIは、レビュー待ち・指摘修正・検証・再pushまで続ける。担当チャットが無いPRのために、別の修正AIを自動起動しない。
- 最新headのCode Review完了、未解決指摘0件、既存検査、最新SHAの独立レビューの成功をそろえる。👍、COMMENTED、空のReview、古い結果、Security Reviewだけでは完了にしない。未実行・動作中・利用制限・API失敗・不明形式はマージ不可。
- レビュー待ちは各20分、Codex指摘への修正pushはPR単位で3回まで。超過時はマージせず、PR URL・head・理由・残作業・再開条件を報告する。
- 修正pushには共通の`codex_review.py fix-push`、待機には`codex_review.py wait`、返信には`pr_review.py reply`を使う。返信にCodex・Claudeのメンションを付けない。別のクラウド作業を起動するため。
- マージ直前にも全条件を取得し直し、確認済みSHAを指定する。既存のブランチ・マージ規約と必須検査を維持し、マージ対象を広げない。
- 詳細: https://github.com/ThousandHorse/thousandHorse/blob/develop/skills/pr-template/references/official-codex.md
- PR本文の確認結果に、公式の完了コメントURLと対象の完全SHAを残す。push後は新しいheadの証拠に更新する。
