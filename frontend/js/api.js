let accessToken = "";

export function setAccessToken(token) { accessToken = token || ""; }

async function request(path, options = {}, retry = true) {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(path, { ...options, headers, credentials: "include" });
  if (response.status === 401 && retry && path !== "/api/v1/auth/refresh") {
    const refreshed = await refreshSession();
    if (refreshed) return request(path, options, false);
  }
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `伺服器錯誤 (${response.status})`);
  return data;
}

export async function refreshSession() {
  try {
    const response = await fetch("/api/v1/auth/refresh", { method: "POST", credentials: "include" });
    if (!response.ok) { setAccessToken(""); return null; }
    const data = await response.json();
    setAccessToken(data.accessToken);
    return data;
  } catch { setAccessToken(""); return null; }
}

export const api = {
  register: (payload) => request("/api/v1/auth/register", { method: "POST", body: JSON.stringify(payload) }, false),
  login: async (payload) => { const data = await request("/api/v1/auth/login", { method: "POST", body: JSON.stringify(payload) }, false); setAccessToken(data.accessToken); return data; },
  logout: async () => { try { await request("/api/v1/auth/logout", { method: "POST" }, false); } finally { setAccessToken(""); } },
  me: () => request("/api/v1/auth/me"),
  updateProfile: (payload) => request("/api/v1/auth/profile", { method: "PUT", body: JSON.stringify(payload) }),
  changePassword: (payload) => request("/api/v1/auth/password", { method: "PUT", body: JSON.stringify(payload) }),
  sessions: () => request("/api/v1/auth/sessions"),
  revokeSession: (id) => request(`/api/v1/auth/sessions/${id}`, { method: "DELETE" }),
  revokeOtherSessions: () => request("/api/v1/auth/sessions/revoke-others", { method: "POST" }),
  integrity: () => request("/api/v1/integrity"),
  runMaintenance: () => request("/api/v1/integrity/maintenance", { method: "POST" }),
  portfolio: () => request("/api/v1/portfolio"),
  dashboard: () => request("/api/v1/market/dashboard"),
  saveQuote: (code, price) => request(`/api/v1/market/quotes/${encodeURIComponent(code)}`, { method: "PUT", body: JSON.stringify({ price }) }),
  saveQuotesBatch: (quotes) => request("/api/v1/market/quotes/batch", { method: "POST", body: JSON.stringify({ quotes }) }),
  quoteHistory: (code, limit = 30) => request(`/api/v1/market/quotes/${encodeURIComponent(code)}/history?limit=${encodeURIComponent(limit)}`),
  transactions: () => request("/api/v1/transactions?limit=500"),
  createTransaction: (payload) => request("/api/v1/transactions", { method: "POST", body: JSON.stringify(payload) }),
  updateTransaction: (id, payload) => request(`/api/v1/transactions/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteTransaction: (id) => request(`/api/v1/transactions/${id}`, { method: "DELETE" }),
  strategy: () => request("/api/v1/strategy"),
  saveStrategy: (payload) => request("/api/v1/strategy", { method: "PUT", body: JSON.stringify(payload) }),
  analysis: () => request("/api/v1/strategy/analysis"),
  alerts: () => request("/api/v1/alerts"),
  evaluateAlerts: () => request("/api/v1/alerts/evaluate", { method: "POST" }),
  createAlert: (payload) => request("/api/v1/alerts", { method: "POST", body: JSON.stringify(payload) }),
  updateAlert: (id, payload) => request(`/api/v1/alerts/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteAlert: (id) => request(`/api/v1/alerts/${id}`, { method: "DELETE" }),
  exportBackup: async () => {
    const headers = new Headers();
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    let response = await fetch("/api/v1/backup/export", { headers, credentials: "include" });
    if (response.status === 401 && await refreshSession()) {
      headers.set("Authorization", `Bearer ${accessToken}`);
      response = await fetch("/api/v1/backup/export", { headers, credentials: "include" });
    }
    if (!response.ok) throw new Error("備份下載失敗");
    return response.blob();
  },
  importBackup: (backup, mode) => request("/api/v1/backup/import", { method: "POST", body: JSON.stringify({ backup, mode }) }),
  exportTransactionsCsv: async () => {
    const headers = new Headers();
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    let response = await fetch("/api/v1/csv/transactions/export", { headers, credentials: "include" });
    if (response.status === 401 && await refreshSession()) {
      headers.set("Authorization", `Bearer ${accessToken}`);
      response = await fetch("/api/v1/csv/transactions/export", { headers, credentials: "include" });
    }
    if (!response.ok) throw new Error("CSV 下載失敗");
    return response.blob();
  },
  importTransactionsCsv: (csv, mode) => request("/api/v1/csv/transactions/import", { method: "POST", body: JSON.stringify({ csv, mode }) }),
  snapshots: (days = 30) => request(`/api/v1/snapshots?days=${encodeURIComponent(days)}`),
  saveTodaySnapshot: () => request("/api/v1/snapshots/today", { method: "POST" }),
  clearSnapshots: () => request("/api/v1/snapshots", { method: "DELETE" }),
  watchlist: () => request("/api/v1/watchlist"),
  createWatchlistItem: (payload) => request("/api/v1/watchlist", { method: "POST", body: JSON.stringify(payload) }),
  updateWatchlistItem: (id, payload) => request(`/api/v1/watchlist/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteWatchlistItem: (id) => request(`/api/v1/watchlist/${id}`, { method: "DELETE" }),
  performanceReport: () => request("/api/v1/reports/performance"),
  journal: (limit = 100) => request(`/api/v1/journal?limit=${encodeURIComponent(limit)}`),
  createJournalEntry: (payload) => request("/api/v1/journal", { method: "POST", body: JSON.stringify(payload) }),
  updateJournalEntry: (id, payload) => request(`/api/v1/journal/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteJournalEntry: (id) => request(`/api/v1/journal/${id}`, { method: "DELETE" }),
  allocationAnalysis: () => request("/api/v1/allocation/analysis"),
  saveAllocationTarget: (code, payload) => request(`/api/v1/allocation/${encodeURIComponent(code)}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteAllocationTarget: (code) => request(`/api/v1/allocation/${encodeURIComponent(code)}`, { method: "DELETE" }),
  dividends: (year = "") => request(`/api/v1/dividends${year ? `?year=${encodeURIComponent(year)}` : ""}`),
  createDividend: (payload) => request("/api/v1/dividends", { method: "POST", body: JSON.stringify(payload) }),
  updateDividend: (id, payload) => request(`/api/v1/dividends/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteDividend: (id) => request(`/api/v1/dividends/${id}`, { method: "DELETE" }),
  cashEntries: (year = "") => request(`/api/v1/cash${year ? `?year=${encodeURIComponent(year)}` : ""}`),
  createCashEntry: (payload) => request("/api/v1/cash", { method: "POST", body: JSON.stringify(payload) }),
  updateCashEntry: (id, payload) => request(`/api/v1/cash/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteCashEntry: (id) => request(`/api/v1/cash/${id}`, { method: "DELETE" }),
  portfolioHealth: () => request("/api/v1/health-score"),
  dailyBrief: () => request("/api/v1/daily-brief"),
  notifications: () => request("/api/v1/notifications"),
  syncNotifications: () => request("/api/v1/notifications/sync", { method: "POST" }),
  markNotificationRead: (id, read = true) => request(`/api/v1/notifications/${id}/read`, { method: "PUT", body: JSON.stringify({ read }) }),
  markAllNotificationsRead: () => request("/api/v1/notifications/read-all", { method: "POST" }),
  dismissNotification: (id) => request(`/api/v1/notifications/${id}`, { method: "DELETE" }),
  auditLogs: (days = 30, limit = 100) => request(`/api/v1/audit?days=${encodeURIComponent(days)}&limit=${encodeURIComponent(limit)}`),
  cleanupAuditLogs: (retentionDays = 180) => request("/api/v1/audit/cleanup", { method: "POST", body: JSON.stringify({ retentionDays }) }),
  search: (q, type = "all", limit = 50) => request(`/api/v1/search?q=${encodeURIComponent(q)}&type=${encodeURIComponent(type)}&limit=${encodeURIComponent(limit)}`),
  opportunities: () => request("/api/v1/opportunities"),
  tradePlans: () => request("/api/v1/trade-plans"),
  createTradePlan: (payload) => request("/api/v1/trade-plans", { method: "POST", body: JSON.stringify(payload) }),
  updateTradePlan: (id, payload) => request(`/api/v1/trade-plans/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteTradePlan: (id) => request(`/api/v1/trade-plans/${id}`, { method: "DELETE" }),
  reviewTasks: () => request("/api/v1/review-tasks"),
  createReviewTask: (payload) => request("/api/v1/review-tasks", { method: "POST", body: JSON.stringify(payload) }),
  updateReviewTask: (id, payload) => request(`/api/v1/review-tasks/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteReviewTask: (id) => request(`/api/v1/review-tasks/${id}`, { method: "DELETE" }),
  dailyRoutine: (date = "") => request(`/api/v1/daily-routine/today${date ? `?date=${encodeURIComponent(date)}` : ""}`),
  dailyRoutineHistory: (days = 30) => request(`/api/v1/daily-routine/history?days=${encodeURIComponent(days)}`),
  updateRoutineCheck: (payload) => request("/api/v1/daily-routine/check", { method: "PUT", body: JSON.stringify(payload) }),
  resetDailyRoutine: (date) => request("/api/v1/daily-routine/reset", { method: "POST", body: JSON.stringify({ date }) }),
  goals: () => request("/api/v1/goals"),
  createGoal: (payload) => request("/api/v1/goals", { method: "POST", body: JSON.stringify(payload) }),
  updateGoal: (id, payload) => request(`/api/v1/goals/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteGoal: (id) => request(`/api/v1/goals/${id}`, { method: "DELETE" }),
  weeklyReview: () => request("/api/v1/weekly-review"),
  featurePreferences: () => request("/api/v1/feature-preferences"),
  saveFeatureOrder: (keys) => request("/api/v1/feature-preferences/order", { method: "PUT", body: JSON.stringify({ keys }) }),
  resetFeatureOrder: () => request("/api/v1/feature-preferences/reset-order", { method: "POST" }),
  setFeatureFavorite: (key, favorite) => request(`/api/v1/feature-preferences/${encodeURIComponent(key)}/favorite`, { method: "PUT", body: JSON.stringify({ favorite }) }),
  recordFeatureOpen: (key) => request(`/api/v1/feature-preferences/${encodeURIComponent(key)}/open`, { method: "POST" }),
  resetFeatureUsage: () => request("/api/v1/feature-preferences/reset-usage", { method: "POST" }),
  setFeatureHidden: (key, hidden) => request(`/api/v1/feature-preferences/${encodeURIComponent(key)}/hidden`, { method: "PUT", body: JSON.stringify({ hidden }) }),
  restoreHiddenFeatures: () => request("/api/v1/feature-preferences/restore-hidden", { method: "POST" }),
  displayPreference: () => request("/api/v1/display-preferences"),
  saveDisplayPreference: (payload) => request("/api/v1/display-preferences", { method: "PUT", body: JSON.stringify(payload) }),
  onboarding: () => request("/api/v1/onboarding"),
  setOnboardingDismissed: (dismissed) => request("/api/v1/onboarding", { method: "PUT", body: JSON.stringify({ dismissed }) }),
  freshness: () => request("/api/v1/freshness"),
  saveFreshnessPreference: (payload) => request("/api/v1/freshness/preferences", { method: "PUT", body: JSON.stringify(payload) })
};
