# BJH AI Pro Cloud Sprint 14

## 資產配置與再平衡中心

- 為每支股票設定投資分類與目標比重
- 自動計算目前持股比重
- 顯示目標與目前比重差距
- 估算應增加或降低的金額
- 顯示缺少股價、目前未持有及接近目標等狀態
- 提醒目標比重合計是否接近 100%
- 所有配置資料依使用者帳號隔離

## API

- `GET /api/v1/allocation/analysis`
- `PUT /api/v1/allocation/:code`
- `DELETE /api/v1/allocation/:code`

再平衡結果依手動輸入股價估算，不代表即時行情或交易指令。
