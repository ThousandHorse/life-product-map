/**
 * use-debounced-save.ts
 *
 * state 変更を永続化バックエンドに保存する処理を共通化するフック。
 *
 * 注意事項:
 *   - 初回ロード直後（isLoaded が false → true に切り替わった直後）の1回はスキップする。
 *     ロードしたばかりのデータをそのまま再保存する不要な書き込みを防ぐため
 *   - state 変更から DEBOUNCE_MS 経過するまで保存を遅延させる。Supabase 移行後は
 *     save() がHTTPリクエストになるため、連続入力のたびに即時送信すると
 *     レートリミットや「古いリクエストが新しいリクエストより後に完了して
 *     データが先祖返りする」競合状態を招くリスクがあるため
 */

import { useEffect, useRef } from "react";

const DEBOUNCE_MS = 800;

export function useDebouncedSave<T>(
  key: string,
  data: T,
  isLoaded: boolean,
  save: (key: string, data: T) => Promise<void>
): void {
  // 初回ロード完了直後の1回はスキップするためのフラグ
  const hasSkippedInitialSave = useRef(false);

  useEffect(() => {
    if (!isLoaded) return;

    if (!hasSkippedInitialSave.current) {
      hasSkippedInitialSave.current = true;
      return;
    }

    const timer = setTimeout(() => {
      void save(key, data);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // key と save は呼び出し側で固定の安定した参照（STORAGE_KEYS の定数 / storage.ts の関数）であり、
    // 依存配列に含めてもタイマーの再生成は発生しないため、deps からは意図的に除外している
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, data]);
}
