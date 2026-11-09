# Neko + Playwright MCP

獨立部署版本：Neko 提供 Chromium 桌面，Playwright MCP 透過 CDP 控制同一個瀏覽器。此資料夾可單獨複製使用。

**部署版本：Chromium 155（完整版本 `155.0.8059.79`）、Playwright MCP `0.0.83`。**

## 映像版本與相容性

部署以完整 SHA-256 digest 固定映像內容，不隨 `latest` 更新。

| 元件 | 版本 | 指定位置 |
|---|---|---|
| Neko Chromium 映像 | 內含 Chromium `155.0.8059.79`；Neko 本身以映像 digest 識別 | `docker/neko/Dockerfile` 的 `FROM` |
| Playwright MCP | `0.0.83` | `compose.yaml` 的 `image` |

Neko Chromium 基底映像：

```text
ghcr.io/m1k1o/neko/chromium@sha256:270face8b8111e639744fb7bcdbbf0deed227900bb89d58b2f8adfc12af8c41e
```

Playwright MCP 映像：

```text
mcr.microsoft.com/playwright/mcp@sha256:690763cbb437ee7233f538a953bb5390bf03791eb5c965b471e59d17a6132fcb
```

升級任一元件時，應更新對應 digest、重新建置，並重新驗證 MCP 連線、分頁附加、導航、輸入、點擊與頁面快照的相容性。

## 需求

- Docker Engine 與 Docker Compose；Windows 使用 Docker Desktop 的 Linux containers。
- PowerShell（使用附帶的隨機密碼初始化腳本時）。
- 建議至少保留 2 GB 可用記憶體供瀏覽器與桌面使用。

## 啟動

先進入本資料夾執行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/init.ps1
docker compose config --quiet
docker compose up -d --build
docker compose ps
```

初始化腳本會在本資料夾產生 `.env`，以密碼學亂數分別產生 Neko 使用者、管理員及 MCP 三組獨立密碼（各 24 bytes，Base64 編碼）。若已有 `.env`，僅在缺少 `MCP_PASSWORD` 時追加該密碼，保留既有 Neko 密碼與其他設定；重跑不會輪替既有密碼。也可自行將 `.env.example` 複製成 `.env`，更換所有密碼；MCP 密碼至少 24 個字元。

開啟 http://127.0.0.1:8080，使用 `.env` 中的使用者密碼或管理員密碼登入 Neko。初次啟動請等待 Chromium 完成載入後再使用 MCP。

本版本使用獨立 Compose project `neko-mcp-release` 與獨立 profile volume。若原專案或其他服務正在使用 8080、8931、52000–52100 UDP，須先停止該服務再啟動本版本。例如，從原專案根目錄執行 `docker compose down`，再進入本資料夾啟動；原專案的 profile volume 會保留。

## MCP 連線

在支援 Streamable HTTP 的 MCP client 設定：

```text
http://localhost:8931/mcp
```

每個 MCP HTTP 請求都必須帶入 `.env` 的 `MCP_PASSWORD`：

```http
Authorization: Bearer <MCP_PASSWORD>
```

通用 JSON 範例見 `mcp-config.example.json`，將其中的佔位文字替換成實際密碼，實際設定欄位依 client 而定。該 JSON 不會自動讀取 `.env`。請勿將填入實際密碼的 client 設定提交到 Git。

未提供或密碼錯誤會收到 `401 Unauthorized`；成功後的工具呼叫與 Session ID 請求仍需帶入 Bearer 密碼。

驗證入口在 `8931`，只有通過驗證才會轉發到 loopback `8932` 的 Playwright MCP；轉發時會移除密碼並將 Host 改為內部 localhost，不需對上游設定 `--allowed-hosts '*'`。內部 `8932` 與 CDP `9222` 均不發布到主機。此入口僅支援 `/mcp` 的 Streamable HTTP，不提供舊版 `/sse`。

```text
MCP client → Bearer 驗證 :8931 → Playwright MCP 127.0.0.1:8932 → CDP :9222 → Chromium
Viewer     → Neko :8080       → WebRTC     → 同一個 Chromium
```

## 資料與維護

Chromium profile 儲存在 named volume，包含 Cookie、登入與網站儲存資料。固定 hostname 避免容器重建後 profile 鎖定資訊指向舊 hostname。Neko 與 MCP 映像均以已驗證的 digest 固定。

```powershell
# 檢查狀態與日誌
docker compose ps
docker compose logs --tail 80 neko playwright-mcp

# 停止；保留瀏覽器資料
docker compose down

# 若重建 Neko 後 MCP 失去連線，重建 MCP 的共用網路連線
docker compose up -d --force-recreate playwright-mcp
```

只有確定要刪除瀏覽器全部資料時才使用 `docker compose down -v`。

要輪替 MCP 密碼，修改 `.env` 的 `MCP_PASSWORD`、重新建立 MCP 容器，並更新所有 client 的 Token；Neko 密碼不受影響。

## 存取範圍

### 以 NEKO_IP 統一控制本機或內網存取

只需修改 `.env` 的 `NEKO_IP`，它會同時控制 Neko 網頁、MCP 驗證入口、WebRTC 的主機綁定介面，以及 WebRTC 宣告的連線位址。

`NEKO_IP` 由 Compose 讀取並套用於主機的 port 映射。`auth-proxy.mjs` 不直接讀取這個變數，而是在容器內監聽 `0.0.0.0:8931`，由 Compose 決定該入口只發布到主機 loopback 或指定區網介面。Docker 主機的區網 IP 不屬於容器，因此不應拿來作為代理程式的容器內監聽位址。代理連往 MCP 後端 `127.0.0.1:8932` 的位址維持不變。

| `.env` 設定 | 可存取範圍 | 網頁 / MCP URL |
|---|---|---|
| `NEKO_IP=127.0.0.1` | Docker 主機本機 | `http://127.0.0.1:8080` / `http://127.0.0.1:8931/mcp` |
| `NEKO_IP=192.168.1.100`（範例） | 可連到主機該區網介面的電腦 | `http://192.168.1.100:8080` / `http://192.168.1.100:8931/mcp` |

區網模式請填 Docker 主機實際擁有且客戶端可達的 IPv4 位址，不要填客戶端 IP、容器 IP 或 `0.0.0.0`。網頁仍需 Neko 密碼，MCP 仍需 `MCP_PASSWORD`；切換存取範圍不會變更密碼。IP 更動後需同步更新 client URL。

修改後，在本資料夾重建兩個服務，使主機 port 綁定、WebRTC 位址及共用網路一起生效：

```powershell
docker compose up -d --force-recreate neko playwright-mcp
```

內網模式下，主機防火牆須允許預期區網來源的 TCP 8080（網頁）、TCP 8931（已驗證 MCP）及 UDP 52000–52100（WebRTC）。只變更 `.env` 不會自動調整防火牆或提供 TLS。

HTTP、MCP 與 WebRTC UDP 預設只綁定本機。CDP 不發布到主機；MCP 與 Neko 共用容器網路空間。Chromium DevTools 政策已開啟，允許 CDP 附加分頁。

MCP 使用獨立 Bearer 密碼，與 Neko 採相同的隨機產生及 `.env` 儲存流程；兩者不是共用同一組密碼。此為共享密鑰驗證，不提供個人帳號、OAuth 或權限分級。持有 MCP 密碼即可操作瀏覽器的既有登入狀態。

預設仍僅供本機存取；以 `NEKO_IP` 切換至區網時，客戶端使用主機區網 IP 與相同 Bearer Token 即可，並應透過 HTTPS 反向代理或 VPN 保護傳輸，因為 HTTP 會明文傳送 Token。人與 MCP 同時操作同一分頁會互相影響。

## 上游專案

- Neko：https://github.com/m1k1o/neko
- Playwright：https://github.com/microsoft/playwright
- Playwright MCP：https://github.com/microsoft/playwright-mcp

## Credit

由 Codex 編寫，經人工審查。
