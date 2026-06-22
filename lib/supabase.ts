/**
 * supabase.ts
 *
 * Supabase クライアントのシングルトン初期化。
 * 認証は実装しないため、createClient はオプションなしのシンプルな形で呼ぶ。
 *
 * 注意事項:
 *   - 環境変数が未設定の場合は早期にエラーを投げる。実行時まで気づかないと
 *     "Failed to fetch" のような分かりにくいエラーになるため、起動時に検知する
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase の環境変数が設定されていません。.env.local に NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を設定してください。"
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
