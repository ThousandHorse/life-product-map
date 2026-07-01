/**
 * storage.ts
 *
 * 永続化バックエンドのファサード。呼び出し側（Workspace.tsx）はこのファイルの
 * load/save/STORAGE_KEYS のみを使い、実体が localStorage か Supabase かを意識しない。
 *
 * 注意事項:
 *   - 現時点では storage-local の実装のみ存在する（Step 13 で storage-supabase を追加し、
 *     NEXT_PUBLIC_STORAGE_BACKEND 環境変数で切替できるようにする）
 */

export { load, save, STORAGE_KEYS } from "./storage-local";
