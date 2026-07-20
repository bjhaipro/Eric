# BJH AI Pro 手機測試部署

這個版本已加入 Render 部署設定。部署成功後會取得：

```text
https://bjh-ai-pro-mobile.onrender.com
```

實際網址可能因名稱重複而略有不同。

## 必要步驟

1. 將本資料夾全部檔案上傳到 GitHub 儲存庫根目錄。
2. 登入 Render。
3. 選擇 **New → Blueprint**。
4. 連接 GitHub 儲存庫 `bjhaipro/Eric`。
5. Render 會讀取根目錄的 `render.yaml`。
6. 確認建立一個 Web Service 和一個 PostgreSQL Database。
7. 等待部署完成後，開啟 Render 顯示的 HTTPS 網址。

## iPhone 加到主畫面

1. 用 Safari 開啟測試網址。
2. 點 Safari 下方「分享」。
3. 選擇「加入主畫面」。
4. 名稱保留 `BJH AI Pro`。
5. 回到主畫面點圖示開始操作。

## 第一次實際測試

1. 建立測試帳號。
2. 登入。
3. 新增一筆買進交易。
4. 查看持股與平均成本。
5. 輸入目前股價。
6. 查看市值與損益。
7. 登出後重新登入。
8. 用 iPad 登入同一帳號，確認資料同步。

## 注意

Render 免費 PostgreSQL 目前屬測試用途，依平台規則可能有期限或休眠限制。正式長期使用前應升級資料庫方案並建立定期備份。
