# BJH AI Pro Cloud Sprint 8

新增完整 JSON 備份與還原：

- 匯出交易、手動股價、策略設定與價格提醒
- 備份檔含格式名稱與版本號
- 還原前驗證資料格式與交易賣超
- 支援取代與合併兩種模式
- 全程使用資料庫交易；失敗會完整回滾
- iPhone / iPad 可直接下載與選擇 JSON 備份檔

API：

- GET /api/v1/backup/export
- POST /api/v1/backup/import
