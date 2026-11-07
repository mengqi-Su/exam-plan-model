/* 全站唯一的 SHA-256。考点钥匙和资料去重都要它：写两遍迟早算出两个结果，
   所以这里只负责「把一段文字变成 64 位十六进制」，谁需要语义谁自己包一层。
   只用 Web Crypto；环境不支持就抛错，绝不静默换成另一种哈希。 */
export async function sha256Hex(text: string): Promise<string> {
  const subtle = globalThis.crypto && globalThis.crypto.subtle;
  if (!subtle) {
    throw new Error("当前环境缺少 Web Crypto SHA-256，请在 HTTPS 或 localhost 下使用。");
  }
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
