# BJH AI Pro Cloud Sprint 34

## 智慧功能排序

- 新增「最近使用」功能分類
- 新增「最常使用」功能分類
- 最近使用依最後開啟時間排序
- 最常使用依累計開啟次數排序
- 無使用紀錄的功能不會混入智慧排序
- 可重設最近使用時間與使用次數
- 重設時保留常用星號設定
- iPhone、iPad 與電腦登入同一帳號可同步

## API

- `GET /api/v1/feature-preferences`
- `POST /api/v1/feature-preferences/:key/open`
- `POST /api/v1/feature-preferences/reset-usage`
