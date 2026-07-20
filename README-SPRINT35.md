# BJH AI Pro Cloud Sprint 35

## 首頁顯示管理中心

- 每個功能可個別隱藏或恢復
- 新增「已隱藏」分類
- 一鍵恢復全部隱藏功能
- 顯示偏好同步至 PostgreSQL
- 常用、最近使用、最常使用設定繼續保留
- 修補功能偏好初始化與控制按鈕程式

## API

- `PUT /api/v1/feature-preferences/:key/hidden`
- `POST /api/v1/feature-preferences/restore-hidden`
