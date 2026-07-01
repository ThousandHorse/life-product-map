import type { NextConfig } from "next";
import os from "os";

// 開発マシンのローカルIPv4アドレスを自動検出する。
// allowedDevOrigins にハードコードすると開発者ごとにIPが異なりGitの差分が発生し続けるため、
// 実行時に os.networkInterfaces() から動的に取得する
function getLocalIPs(): string[] {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];
  for (const netInterface of Object.values(interfaces)) {
    for (const net of netInterface ?? []) {
      if (net.family === "IPv4" && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
}

const nextConfig: NextConfig = {
  // 同一Wi-Fi内の別端末（スマホ等）からのマルチデバイス動作確認を許可する。
  // 未設定だとHMR用のクロスオリジンリクエストがブロックされ、JSが正しく初期化されずボタン操作が効かなくなる
  allowedDevOrigins: getLocalIPs(),
};

export default nextConfig;
