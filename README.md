# Neko + Playwright MCP

獨立部署版本：Neko 提供 Chromium 桌面，Playwright MCP 透過 CDP 控制同一個瀏覽器。此資料夾可單獨複製使用。

**已驗證版本：Chromium 155（完整版本 `155.0.8059.79`）、Playwright MCP `0.0.83`。**

## 映像版本與相容性

以下為 2026-11-06 實測的版本組合，部署以完整 SHA-256 digest 固定映像內容，不隨 `latest` 更新。

| 元件 | 實測版本 | 指定位置 |
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

此版本組合搭配本專案的 CDP 啟動參數與 DevTools 政策修正，已通過開發環境中的 MCP 基礎測試（5 個請求、15 項斷言）及瀏覽器報名流程（26 個請求、87 項斷言）。測試檔案未包含在此部署資料夾中。

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

初始化腳本會在本資料夾產生 `.env`，既有 `.env` 不會被覆寫。也可自行將 `.env.example` 複製成 `.env`，更換兩組密碼。

開啟 http://127.0.0.1:8080，使用 `.env` 中的使用者密碼或管理員密碼登入 Neko。初次啟動請等待 Chromium 完成載入後再使用 MCP。

本版本使用獨立 Compose project `neko-mcp-release` 與獨立 profile volume。若原專案或其他服務正在使用 8080、8931、52000–52100 UDP，須先停止該服務再啟動本版本。例如，從原專案根目錄執行 `docker compose down`，再進入本資料夾啟動；原專案的 profile volume 會保留。

## MCP 連線

在支援 Streamable HTTP 的 MCP client 設定：

```text
http://localhost:8931/mcp
```

通用 JSON 範例見 `mcp-config.example.json`，實際設定欄位依 client 而定。使用 `localhost` 作為 MCP 主機名稱，以符合此映像的 Host 檢查。

```text
MCP client → Playwright MCP :8931 → CDP :9222 → Chromium
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

## 存取範圍

HTTP、MCP 與 WebRTC UDP 預設只綁定本機。CDP 不發布到主機；MCP 與 Neko 共用容器網路空間。Chromium DevTools 政策已開啟，允許 CDP 附加分頁。

MCP 端點沒有獨立登入驗證，可操作瀏覽器的既有登入狀態；請保持本機存取。遠端部署需另行設定驗證、TLS、WebRTC 位址及防火牆。人與 MCP 同時操作同一分頁會互相影響。

## 上游專案

- Neko：https://github.com/m1k1o/neko
- Playwright：https://github.com/microsoft/playwright
- Playwright MCP：https://github.com/microsoft/playwright-mcp

## Credit

由 Codex 編寫，經人工審查。
