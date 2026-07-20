export function errorHandler(error, req, res, next) {
  console.error(error);
  const status = Number(error.status) || 500;
  const message = status >= 500 ? "伺服器暫時發生錯誤" : error.message;
  res.status(status).json({ success: false, message });
}
