/** 檔名必須非空且不含路徑穿越字元。 */
export function isValidFilename(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !value.includes("/") &&
    !value.includes("\\") &&
    !value.includes("..") &&
    !value.startsWith(".")
  );
}
