/**
 * supabase.ts
 *
 * Supabase クライアントのシングルトン初期化。
 * 認証は実装しないため、createClient はオプションなしのシンプルな形で呼ぶ。
 *
 * 注意事項:
 *   - 環境変数の検証はモジュール読み込み時ではなく getSupabase() 呼び出し時に行う（Lazy Initialization）。
 *     トップレベルで throw すると、環境変数が未設定の CI/CD 環境で import するだけで
 *     npm run build が失敗してしまうため
 *
 * TODO(Phase 2.5・認証導入時に解消): NEXT_PUBLIC_SUPABASE_ANON_KEY はブラウザに公開される値であり、
 *   現在の RLS ポリシー（全テーブル "allow all" で誰でも読み書き可）と組み合わさると、
 *   本番URLとこのキーが分かれば第三者が全データを読み書き・削除できる状態にある
 *   （PR #21 への Codex レビュー指摘で識別）。個人の動作確認用途として、本番URLを
 *   他人に共有しない運用で限定的に許容している。認証を導入する際は Supabase Auth で
 *   ユーザーを識別し、RLS ポリシーを `using (auth.uid() = user_id)` 等にスコープし直すこと
 */

import { createClient } from "@supabase/supabase-js";

let supabaseClient: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  if (supabaseClient) return supabaseClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase の環境変数が設定されていません。.env.local に NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を設定してください。"
    );
  }

  supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  return supabaseClient;
}
