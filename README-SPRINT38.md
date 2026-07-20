# BJH AI Pro Cloud Sprint 38

## 登入首頁模式

本版新增可同步的預設首頁分類：

- 今日
- ★ 常用
- 最近使用
- 全部

使用者在「顯示設定」選擇後，系統會立即預覽；下次登入或重新開啟 App 時自動進入該分類。

## 資料庫

`user_display_preferences` 新增：

- `startup_view`

允許值：

- `all`
- `today`
- `favorites`
- `recent`

## API

沿用：

- `GET /api/v1/display-preferences`
- `PUT /api/v1/display-preferences`

新增欄位：

```json
{
  "startupView": "today"
}
```
