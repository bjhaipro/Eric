# BJH AI Pro Cloud Sprint 10

本版新增交易 CSV 中心：可下載全部交易，亦可用合併或取代模式匯入 CSV。匯入前會驗證欄位、數字、日期與完整持股歷史，若造成賣超，整批資料不會寫入。

API：
- GET `/api/v1/csv/transactions/export`
- POST `/api/v1/csv/transactions/import`

必要欄位：`type,code,name,shares,price,fee,tax,tradeDate,note`
