/** SSE 匯入紀錄端點的即時進度 */
export type ImportProgress = { current: number; total: number };

/** 匯入完成後的彙總結果 */
export type ImportResult = { imported: number; skipped: number; errors: string[] };

/**
 * 以 SSE 串流呼叫 `/api/committed` 匯入紀錄，過程透過 onProgress 回報即時進度。
 * 傳輸層或伺服器層錯誤直接 throw。
 */
export async function importRecords(
  data: Record<string, unknown>,
  onProgress: (progress: ImportProgress) => void,
): Promise<ImportResult> {
  const res = await fetch("/api/committed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => null);
    const msg = err && typeof err === "object" && "error" in err ? String(err.error) : null;
    throw new Error(msg ?? "匯入失敗");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: ImportResult | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop()!;

    for (const line of lines) {
      const match = line.match(/^data: (.+)$/m);
      if (!match) continue;

      const event: Record<string, unknown> = JSON.parse(match[1]);

      if (event.event === "progress") {
        onProgress({ current: event.current as number, total: event.total as number });
      } else if (event.event === "done") {
        result = event as unknown as ImportResult;
      }
    }
  }

  if (!result) throw new Error("匯入中斷：未收到完成事件");
  return result;
}
