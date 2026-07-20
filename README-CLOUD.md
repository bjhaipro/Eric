# BJH AI Pro Cloud — Sprint 2

本版已加入可執行的帳號系統：註冊、bcrypt 密碼雜湊、登入、JWT Access Token、Refresh Token 輪替、HttpOnly Cookie、自動登入、登出及 `/me` 身分驗證。

## 啟動
1. 複製 `backend/.env.example` 為 `backend/.env`，更換兩組 JWT secret。
2. 執行 `docker compose up --build`。
3. 健康檢查：`GET http://localhost:3000/api/v1/health`。

## Auth API
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`（Bearer Access Token）

## Sprint 3：交易與持股引擎

登入後可使用：

- `GET /api/v1/transactions`：交易紀錄
- `POST /api/v1/transactions`：新增買進或賣出
- `PUT /api/v1/transactions/:id`：修改交易
- `DELETE /api/v1/transactions/:id`：刪除交易
- `GET /api/v1/portfolio`：由全部交易自動重建持股與平均成本

新增交易範例：

```json
{
  "code": "2330",
  "name": "台積電",
  "type": "BUY",
  "shares": 1000,
  "price": 1125,
  "fee": 1603,
  "tax": 0,
  "tradeDate": "2026-07-18",
  "note": "第一筆測試"
}
```

所有端點都必須帶入：`Authorization: Bearer <accessToken>`。
持股採移動平均成本法；買進成本納入手續費與稅，賣出損益扣除手續費與稅。修改或刪除歷史交易時，系統會重新播放完整交易歷史，避免產生負持股。

## Sprint 4：前端操作介面

啟動 Docker 後直接開啟 `http://localhost:3000`，即可使用手機版介面完成註冊、登入、新增／修改／刪除交易，並查看自動計算的持股與已實現損益。

前端採同網域部署，因此 Refresh Token 使用 HttpOnly Cookie，Access Token 僅保留在瀏覽器記憶體中，不寫入 LocalStorage。

## Sprint 5
- 手動輸入目前股價（資料按使用者隔離）
- 市值、未實現損益、投資報酬率儀表板
- GET /api/v1/market/dashboard
- PUT /api/v1/market/quotes/:code
- 尚未串接即時行情供應商；目前價格由使用者更新，避免假裝即時報價
