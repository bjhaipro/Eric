# BJH AI Pro Cloud Sprint 40

## 資料新鮮度中心

本版會集中檢查：

- 目前股價最後更新時間
- 最近交易時間
- 最近資產快照時間
- 投資策略最後更新時間
- 觀察清單最後更新時間

使用者可自訂：

- 股價超過幾小時視為過期
- 資產快照超過幾小時視為過期

系統會將每一項標示為：

- 正常
- 已過期
- 缺少資料

## API

- `GET /api/v1/freshness`
- `PUT /api/v1/freshness/preferences`
