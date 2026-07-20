# BJH AI Pro Cloud Sprint 19

## 通知中心

- 將 CEO Daily Brief 的待辦同步成站內通知
- 未讀、已讀與緊急未讀統計
- 單筆設為已讀／未讀
- 全部標為已讀
- 移除通知
- 相同內容不重複建立，以 fingerprint 更新
- 通知依使用者帳號隔離

## API

- `GET /api/v1/notifications`
- `POST /api/v1/notifications/sync`
- `POST /api/v1/notifications/read-all`
- `PUT /api/v1/notifications/:id/read`
- `DELETE /api/v1/notifications/:id`
