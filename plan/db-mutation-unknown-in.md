# Mutation 驗證完整內化：unknown-in 邊界重構

> 只有「使用者提供的 payload」變 `unknown` 進 mutation；「可信內部產物」保持 typed；「情境前置條件」留在路由。

## 一、Mutation 方法盤點：哪些改、哪些不動

| 方法 | payload 參數 | 改法 | 理由 |
|---|---|---|---|
| `commitRecord(id, entry, file)` | `entry` | `entry: unknown` | entry 是使用者 JSON。`id`(filename) 是識別碼、`file`(FileInfo) 來自 `image.readImageInfo` → **都保持 typed** |
| `updateRecord(id, patch)` | `patch` | `patch: unknown` | 使用者 body。含 `expectedUpdatedAt` 收斂上移 |
| `renameTag(oldName, newName)` | 兩者 | `unknown, unknown` | 使用者 body 原始型別 |
| `deleteTag(name)` | `name` | `name: unknown` | 使用者 body |
| `setTagMeta(name, meta)` | `name`, `meta` | `unknown, unknown` | 使用者 body；`meta` 目前**完全沒驗證** |
| `updateRecordFileMeta(id, meta)` | — | **不動** | 呼叫端 [settings/metadata:36](src/routes/api/settings/metadata/+server.ts#L36) 的 patch 來自可信的 `generateMetadata`，是內部產物 |
| `removeRecord(id)` | — | **不動** | `id` 是識別碼，非 payload；呼叫端都給乾淨字串 |

重點：**不是全部變 unknown**。`updateRecordFileMeta` / `removeRecord` 維持原樣，正是三分類規則的直接產物——它們證明了「路由把 unknown 丟進去」的範圍是被框死的。

## 二、Validator 要新增的積木

現有 `tags/rating/name/tagName` 不動，補上目前靠 `as` 跳過的三塊：

- `Validator.timestamp(v): v is number` — 給 `expectedUpdatedAt`（有限數字）。取代 [committed/[filename]:33](src/routes/api/committed/[filename]/+server.ts#L33) 的 route 內檢查。
- `Validator.tagMeta(v): v is TagMeta` — 目前 `{ hidden: boolean }`。這是最大的缺口，`setMeta` 現在直接信任 `meta: TagMeta`。
- `Validator.record(v): v is Record<string, unknown>` — 或直接複用現成的 [`isRecord`](src/lib/utils/shared.ts#L108)，作為每個物件型 mutation 的第一道 narrowing。

（你 point 2 說的「提供更多工具讓執行者自行 narrowing」——這裡可選加一個小讀取 helper 減少 `entry.tags`(unknown) 的樣板，但保持積木式，不強制。）

## 三、commands.ts 的 DTO 定位轉變

`ImportEntry` / `UpdatePatch` **不刪除**，但語意從「輸入契約」變成「**驗證後的內部形狀**」：mutation 收 `unknown`、逐欄位跑 guard、在內部組出一個 typed 的 `ImportEntry`。DTO 依然有意義，只是不再出現在對外簽名上，`as` 也就無處可施。

**export 政策 —— 讓 `index.ts` 的 export 清單變成三分類規則的地圖：**

- `ImportEntry` / `UpdatePatch` → **停止導出，移為 mutation 內部型別**。grep 確認它們目前只在路由裡被具名來餵 `as`，重構後用法歸零。
- `FileInfo` / `FileMetaPatch` → **保留導出**。`FileMetaPatch` 在 [settings/metadata:36](src/routes/api/settings/metadata/+server.ts#L36) 被具名為 typed local；`FileInfo` 是 `commitRecord` 公開簽名的 typed 參數，兩者對稱保留。

由此 export 清單自我說明：**導出 = 可信檔案側產物（你可 typed 交給我）；未導出 = 使用者 payload（你只能丟 unknown，由我親自收斂）**。

## 四、呼叫端修改（移除 `as` + 移除已上移的檢查）

- **committed/+server.ts**：`validateEntry` 保留 filename/isImageFile/existsSync/isRecord（情境前置，留著），移除 `as ImportEntry` 與 `rating ?? 0`（預設值 commit 內部已處理），直接把 record 當 unknown 傳。
- **committed/[filename]/+server.ts**：移除 `typeof expectedUpdatedAt` 檢查（上移）與 `as UpdatePatch`，body 直接當 patch。
- **staged/[filename]/+server.ts**：保留檔案側前置檢查，移除 `as ImportEntry`。`resolvedName` 的預設推導（去副檔名）是路由職責，保留。
- **tags/+server.ts**（三個）：移除 route 內的 `typeof` 檢查。⚠️ **注意 normalization**：目前路由對 `oldName/newName/name` 做 `.trim()`，改 unknown 後路由不能 trim，**trim 要移進 mutation**（比照 `normalizeTags` 既有做法，`rename` 內的 `oldName===newName` 比較也要改成 trim 後比較）。

錯誤通道大多已含 `Validation`，唯一要確認的是 `updateRecord` 的 `expectedUpdatedAt` 失敗改回 `invalid([...])` 而非 route 400。

## 五、`/testing-scripts`（粗略，細節到時再研究）

改簽名的第二個大頭。粗略範圍：

- **開新 suite `mutation-validation.suite.mjs`**（不要塞進 mutation.suite.mjs）：後者已 229 行、是全專案最長；反例測的是「邊界」而非「行為」，主題縫乾淨；且專案已有 `hidden.suite.mjs` 從 query/mutation 拆出的先例。記得在 [run-all.mjs](testing-scripts/run-all.mjs) 註冊。
- **內容**：`.mjs` 無編譯期型別，直接對 mutation 餵「型別垃圾」——非物件 entry、`tags` 非陣列、`rating` 非數字、`expectedUpdatedAt` 非數字、`tagMeta.hidden` 非布林——斷言回 `validation`。此 suite 即「validation 已做完整」的可視證明。
- **既有 suite**：[mutation.suite.mjs](testing-scripts/mutation.suite.mjs) / [hidden.suite.mjs](testing-scripts/hidden.suite.mjs) 的「合法輸入」案例**執行時應照舊通過**（valid 路徑不變），原則上不需改，僅在簽名調整導致呼叫寫法變動時微調。
- **不需動**：query / database / bitmap / ordinal / facet-index / serialization / query-spec 等 suite 不受影響。
- 規模預估：一個新檔，每個受影響方法約 2–4 個負向案例。

## 六、建議順序與驗收

1. Validator 加三塊積木（純新增，不破壞）
2. 逐一改 mutation 方法簽名 + 內部 narrowing（`index.ts` 對外簽名同步）
3. 掃六個路由檔移除 `as` 與上移的檢查、tag 的 trim 內移
4. `npm run check` 確認全綠且**再也沒有 `as ImportEntry/UpdatePatch`**，且 `index.ts` 不再導出這兩型
5. 新增 `mutation-validation.suite.mjs`、註冊進 `run-all.mjs`，跑 `run-all.mjs`
