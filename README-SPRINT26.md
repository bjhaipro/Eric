# BJH AI Pro Cloud Sprint 26

## 批次股價更新與價格歷史

- 單筆更新股價時保存上一個價格
- 批次更新最多 100 檔
- 整批交易處理，任一筆錯誤則全部取消
- 顯示價格變動金額與變動率
- 查詢每檔最近 1～365 筆價格紀錄
- 每位使用者資料完全隔離

## API

- `POST /api/v1/market/quotes/batch`
- `GET /api/v1/market/quotes/:code/history?limit=30`
- 原有 `PUT /api/v1/market/quotes/:code` 同步寫入歷史
