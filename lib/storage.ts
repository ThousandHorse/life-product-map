/**
 * storage.ts
 *
 * 永続化バックエンドのファサード。呼び出し側（Workspace.tsx）はこのファイルの
 * load/save/STORAGE_KEYS のみを使い、実体が localStorage か Supabase かを意識しない。
 *
 * バックエンドの切り替え:
 *   - デフォルト: Supabase（storage-supabase.ts）
 *   - ロールバック: .env.local に NEXT_PUBLIC_STORAGE_BACKEND=localStorage を設定する
 */

import * as local from "./storage-local";
import * as remote from "./storage-supabase";

const backend =
  process.env.NEXT_PUBLIC_STORAGE_BACKEND === "localStorage" ? local : remote;

export const load = backend.load;
export const save = backend.save;
export const STORAGE_KEYS = backend.STORAGE_KEYS;
