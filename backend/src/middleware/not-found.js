export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: {
      code: "ROUTE_NOT_FOUND",
      message: `找不到 API：${req.method} ${req.originalUrl}`
    }
  });
}
