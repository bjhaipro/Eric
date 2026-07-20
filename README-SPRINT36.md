# BJH AI Pro Cloud Sprint 36

## 自訂功能排序中心

- 在「全部」分類中使用 ↑／↓ 調整功能順序
- 排序結果儲存在 PostgreSQL
- iPhone、iPad、電腦登入同一帳號時同步
- 常用、隱藏、最近使用與最常使用設定全部保留
- 可一鍵恢復系統預設順序

## API

- `PUT /api/v1/feature-preferences/order`
- `POST /api/v1/feature-preferences/reset-order`
