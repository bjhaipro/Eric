# BJH AI Pro Cloud Sprint 22

本版加入帳號操作稽核紀錄。所有已登入使用者的新增、修改、刪除 API 操作會保存時間、功能路徑、結果狀態、IP 與裝置資訊。

API：
- GET /api/v1/audit?days=30&limit=100
- POST /api/v1/audit/cleanup

安全清理預設僅移除 180 天以前的稽核紀錄，不影響交易、持股及其他投資資料。
