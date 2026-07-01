import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 同一Wi-Fi内の別端末（スマホ等）からのマルチデバイス動作確認を許可する。
  // 未設定だとHMR用のクロスオリジンリクエストがブロックされ、JSが正しく初期化されずボタン操作が効かなくなる。
  // 開発者ごとにローカルIPが異なるため、自分の環境で確認する際は実際のIP（`ipconfig getifaddr en0` 等で確認）に書き換えること
  allowedDevOrigins: ["192.168.0.163"],
};

export default nextConfig;
