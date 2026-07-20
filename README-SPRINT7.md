# BJH AI Pro Cloud Sprint 7

本版新增價格提醒中心：

- 建立高於／低於目標價提醒
- 修改、停用、重新啟用與刪除提醒
- 每次載入儀表板或按「立即檢查」時，以使用者最新手動股價評估
- 顯示已觸發、等待中、缺少價格與啟用數量
- 每位使用者的提醒完全隔離

API：

- `GET /api/v1/alerts`
- `POST /api/v1/alerts`
- `POST /api/v1/alerts/evaluate`
- `PUT /api/v1/alerts/:id`
- `DELETE /api/v1/alerts/:id`

目前尚未接正式即時行情與系統推播，因此提醒只依手動輸入價格計算，畫面會明確標示。
