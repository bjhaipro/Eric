# BJH AI Pro Cloud Sprint 33

## 個人常用功能與使用紀錄

- 每個功能卡片可按星號加入或移出常用功能
- 導覽列新增「★ 常用」分類
- 常用設定儲存在 PostgreSQL，iPhone、iPad、電腦登入同帳號時同步
- 記錄功能最近開啟時間與開啟次數，供後續智慧排序使用
- 每位使用者資料完全隔離

## API

- `GET /api/v1/feature-preferences`
- `PUT /api/v1/feature-preferences/:key/favorite`
- `POST /api/v1/feature-preferences/:key/open`
