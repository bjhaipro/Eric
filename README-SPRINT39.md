# BJH AI Pro Cloud Sprint 39

## 首次使用快速啟動精靈

系統會自動檢查六個基本步驟：

1. 新增第一筆交易
2. 輸入目前股價
3. 設定投資策略
4. 建立觀察清單
5. 完成每日盤前／盤後檢查
6. 下載第一次完整備份

每個步驟會顯示完成狀態、總進度與「前往」按鈕。精靈可暫時隱藏，資料與完成狀態依登入帳號獨立保存。

## API

- `GET /api/v1/onboarding`
- `PUT /api/v1/onboarding`

PUT 範例：

```json
{
  "dismissed": true
}
```
