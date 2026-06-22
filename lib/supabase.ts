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
