import { api, refreshSession } from "./api.js";

const $ = (id) => document.getElementById(id);
const state = { displayPreference: { fontSize: "standard", density: "comfortable", highContrast: false, reduceMotion: false }, featurePreferences: new Map(), mode: "login", user: null, transactions: [], analysis: [], alerts: [], snapshots: [], watchlist: [], journal: [], allocation: [], dividends: [], cashEntries: [], notifications: [], sessions: [], integrity: null, auditLogs: [], opportunities: [], tradePlans: [], reviewTasks: [], dailyRoutine: null, routineHistory: null, goals: [], weeklyReview: null, onboarding: null, freshness: null };
const money = new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 2 });
const number = new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 4 });

function toast(message) {
  const el = $("toast"); el.textContent = message; el.classList.add("show");
  clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 2600);
}
function setBusy(button, busy, text) { button.disabled = busy; button.dataset.oldText ||= button.textContent; button.textContent = busy ? text : button.dataset.oldText; }
function today() { return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" }); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }

function switchAuthMode(mode) {
  state.mode = mode;
  $("loginTab").classList.toggle("active", mode === "login");
  $("registerTab").classList.toggle("active", mode === "register");
  $("nameField").classList.toggle("hidden", mode !== "register");
  $("name").required = mode === "register";
  $("password").autocomplete = mode === "login" ? "current-password" : "new-password";
  $("authSubmit").textContent = mode === "login" ? "登入" : "建立帳號";
}

function showApp(user) {
  state.user = user;
  $("authView").classList.add("hidden"); $("appView").classList.remove("hidden");
  $("welcomeText").textContent = `${user.name || user.email}，您好`;
}
function showAuth() { state.user = null; $("appView").classList.add("hidden"); $("authView").classList.remove("hidden"); }



function formatFreshnessAge(item) {
  if (item.ageHours === null || item.ageHours === undefined) return "尚無資料";
  if (item.ageHours < 1) return "1 小時內";
  if (item.ageHours < 24) return `${item.ageHours} 小時前`;
  return `${Math.round(item.ageHours / 24 * 10) / 10} 天前`;
}

function renderFreshness(data) {
  state.freshness = data;
  $("quoteStaleHours").value = data.preference.quoteStaleHours;
  $("snapshotStaleHours").value = data.preference.snapshotStaleHours;
  $("freshnessSummary").innerHTML = `
    <span>正常 ${data.summary.fresh}</span>
    <span>過期 ${data.summary.stale}</span>
    <span>缺少 ${data.summary.missing}</span>`;
  $("freshnessItems").innerHTML = data.items.map((item) => `
    <article class="freshness-item ${item.status}">
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <p>${item.updatedAt ? `最後更新：${escapeHtml(formatDateTime(item.updatedAt))}` : "尚未建立資料"}</p>
      </div>
      <div class="freshness-status">
        <span>${item.status === "fresh" ? "正常" : item.status === "stale" ? "已過期" : "缺少"}</span>
        <small>${formatFreshnessAge(item)}</small>
      </div>
      <button type="button" data-freshness-target="${escapeHtml(item.action)}">前往</button>
    </article>`).join("");
}

async function loadFreshness() {
  renderFreshness(await api.freshness());
}

function renderOnboarding(data) {
  state.onboarding = data;
  const panel = $("onboardingPanel");
  if (!panel) return;
  panel.classList.toggle("hidden", Boolean(data.dismissed));
  $("onboardingSummary").innerHTML = `
    <span>已完成 ${data.completed}/${data.total}</span>
    <span>進度 ${data.progress}%</span>
    <span>${data.finished ? "基本設定完成" : "依序完成即可開始使用"}</span>`;
  $("onboardingProgressBar").style.width = `${Math.max(0, Math.min(100, data.progress))}%`;
  $("onboardingSteps").innerHTML = (data.items || []).map((item, index) => `
    <article class="onboarding-step ${item.completed ? "done" : ""}">
      <span class="onboarding-step-number">${item.completed ? "✓" : index + 1}</span>
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.detail)}</p>
      </div>
      <button type="button" data-onboarding-target="${escapeHtml(item.target)}">${item.completed ? "查看" : "前往"}</button>
    </article>`).join("");
}

async function loadOnboarding() {
  const data = await api.onboarding();
  renderOnboarding(data);
}



function renderRoutineHistory(data){
  state.routineHistory=data; const x=data.summary||{};
  $("routineHistorySummary").innerHTML=`<span>完整完成 ${x.completedDays||0} 天</span><span>目前連續 ${x.currentStreak||0} 天</span><span>最佳連續 ${x.bestStreak||0} 天</span><span>平均進度 ${x.averageProgress||0}%</span>`;
  $("routineHistoryBars").innerHTML=(data.items||[]).slice().reverse().map(i=>`<div class="routine-history-row"><time>${escapeHtml(i.date.slice(5))}</time><div class="routine-history-track"><i style="width:${Math.max(0,Math.min(100,i.progress))}%"></i></div><strong>${i.completed}/8</strong></div>`).join("");
}

function renderDailyRoutine(data){
  state.dailyRoutine=data; const x=data.summary||{};
  $("dailyRoutineSummary").innerHTML=`<span>日期 ${escapeHtml(data.date)}</span><span>完成 ${x.completed||0}/${x.total||0}</span><span>剩餘 ${x.remaining||0}</span><span>進度 ${x.progress||0}%</span>`;
  const labels={PREMARKET:"盤前檢查",POSTMARKET:"盤後整理"};
  $("dailyRoutineGroups").innerHTML=(data.groups||[]).map(g=>`<article class="routine-card"><h3>${labels[g.period]||g.period}</h3>${g.items.map(i=>`<label class="routine-item ${i.completed?'done':''}"><input type="checkbox" data-routine-period="${g.period}" data-routine-key="${i.key}" ${i.completed?'checked':''}><span>${escapeHtml(i.title)}</span></label>`).join("")}</article>`).join("");
}

function resetReviewTaskForm(){ $("reviewTaskId").value=""; $("reviewTaskForm").reset(); $("reviewTaskDueDate").value=new Date().toISOString().slice(0,10); $("reviewTaskPriority").value="3"; $("saveReviewTask").textContent="儲存任務"; $("cancelReviewTaskEdit").classList.add("hidden"); }
function renderReviewTasks(data){ state.reviewTasks=data.items||[]; const x=data.summary||{}; $("reviewTaskSummary").innerHTML=`<span>待處理 ${x.open||0}</span><span>逾期 ${x.overdue||0}</span><span>今日到期 ${x.dueToday||0}</span><span>高優先 ${x.highPriority||0}</span>`; const today=new Date().toISOString().slice(0,10); $("reviewTaskCards").innerHTML=state.reviewTasks.length?state.reviewTasks.map(t=>`<article class="trade-plan-card ${t.status==='OPEN'&&t.dueDate<today?'trade-plan-triggered':''}"><div class="card-top"><div><strong>${escapeHtml(t.code?`${t.code} ${t.title}`:t.title)}</strong><p>${escapeHtml(t.note||'無備註')}</p></div><span class="status-badge">${t.status==='OPEN'?(t.dueDate<today?'已逾期':'待處理'):t.status==='DONE'?'已完成':'已取消'}</span></div><div class="metric-grid"><span>到期日<strong>${escapeHtml(t.dueDate)}</strong></span><span>優先級<strong>${t.priority}/5</strong></span><span>類型<strong>${escapeHtml(t.category)}</strong></span><span>重複<strong>${escapeHtml(t.repeatRule)}</strong></span></div><div class="card-actions"><button data-review-task-edit="${t.id}">修改</button><button class="delete" data-review-task-delete="${t.id}">刪除</button></div></article>`).join(""):'<p class="empty">尚無投資檢查任務。</p>'; }
function editReviewTask(id){const t=state.reviewTasks.find(x=>String(x.id)===String(id));if(!t)return;$("reviewTaskId").value=t.id;$("reviewTaskTitle").value=t.title;$("reviewTaskCode").value=t.code||"";$("reviewTaskCategory").value=t.category;$("reviewTaskDueDate").value=t.dueDate;$("reviewTaskPriority").value=t.priority;$("reviewTaskRepeat").value=t.repeatRule;$("reviewTaskStatus").value=t.status;$("reviewTaskNote").value=t.note||"";$("saveReviewTask").textContent="儲存修改";$("cancelReviewTaskEdit").classList.remove("hidden");$("reviewTaskForm").scrollIntoView({behavior:"smooth",block:"center"});}

const goalTypeLabels={NET_WORTH:"淨資產",MARKET_VALUE:"持股市值",CASH:"可用現金",DIVIDEND:"累計股利",REALIZED_PROFIT:"已實現損益"};
function resetGoalForm(){ $("goalId").value=""; $("goalForm").reset(); const d=new Date();d.setMonth(d.getMonth()+6);$("goalDate").value=d.toISOString().slice(0,10);$("saveGoal").textContent="儲存目標";$("cancelGoalEdit").classList.add("hidden"); }
function renderGoals(data){state.goals=data.items||[];const x=data.summary||{};$("goalSummary").innerHTML=`<span>全部 ${x.total||0}</span><span>進行中 ${x.active||0}</span><span>已達標 ${x.reached||0}</span><span>逾期 ${x.overdue||0}</span>`;$("goalCards").innerHTML=state.goals.length?state.goals.map(g=>`<article class="trade-plan-card ${g.isReached?'trade-plan-triggered':''}"><div class="card-top"><div><strong>${escapeHtml(g.title)}</strong><p>${escapeHtml(goalTypeLabels[g.goalType]||g.goalType)}｜目標 ${money(g.targetAmount)}</p></div><span class="status-badge">${g.status==='ACTIVE'?(g.isReached?'已達標':g.daysRemaining<0?'已逾期':'進行中'):g.status==='COMPLETED'?'已完成':'已取消'}</span></div><div class="metric-grid"><span>目前金額<strong>${money(g.currentAmount)}</strong></span><span>完成進度<strong>${g.progress.toFixed(1)}%</strong></span><span>尚差金額<strong>${money(g.remainingAmount)}</strong></span><span>目標日期<strong>${escapeHtml(g.targetDate)}</strong></span></div><div class="progress-track"><i style="width:${Math.min(100,g.progress)}%"></i></div><p>${escapeHtml(g.note||'無備註')}</p><div class="card-actions"><button data-goal-edit="${g.id}">修改</button><button class="delete" data-goal-delete="${g.id}">刪除</button></div></article>`).join(""):'<p class="empty">尚無投資目標。</p>'; }
function editGoal(id){const g=state.goals.find(x=>String(x.id)===String(id));if(!g)return;$("goalId").value=g.id;$("goalTitle").value=g.title;$("goalType").value=g.goalType;$("goalAmount").value=g.targetAmount;$("goalDate").value=g.targetDate;$("goalStatus").value=g.status;$("goalNote").value=g.note;$("saveGoal").textContent="儲存修改";$("cancelGoalEdit").classList.remove("hidden");$("goalForm").scrollIntoView({behavior:"smooth"});}


function renderWeeklyReview(data){
  state.weeklyReview=data; const x=data.scorecard||{};
  $("weeklyReviewScorecard").innerHTML=`<div><span>健康分數</span><strong>${x.healthScore||0}</strong><small>${escapeHtml(x.healthGrade||"—")}</small></div><div><span>紀律進度</span><strong>${x.disciplineProgress||0}%</strong><small>完整 ${x.completedRoutineDays||0} 天</small></div><div><span>總損益</span><strong>${money.format(x.totalProfit||0)}</strong><small>勝率 ${x.winRate||0}%</small></div><div><span>待辦任務</span><strong>${x.openTasks||0}</strong><small>逾期 ${x.overdueTasks||0}</small></div>`;
  const renderList=(id,items,kind)=>{$(id).innerHTML=items?.length?`<div class="weekly-review-list">${items.map(item=>typeof item==="string"?`<div class="weekly-review-item">${escapeHtml(item)}</div>`:`<div class="weekly-review-item weekly-review-priority-${escapeHtml(item.priority||kind)}"><strong>${escapeHtml(item.code?`${item.code} ${item.title}`:item.title)}</strong><p>${escapeHtml(item.detail||"")}</p></div>`).join("")}</div>`:'<p class="empty">目前沒有項目。</p>';};
  renderList("weeklyWins",data.wins,"normal"); renderList("weeklyRisks",data.risks,"urgent"); renderList("weeklyActions",data.nextActions,"normal");
  $("weeklyGoals").innerHTML=(data.goals||[]).length?data.goals.map(g=>`<article class="trade-plan-card"><div class="card-top"><strong>${escapeHtml(g.title)}</strong><span class="status-badge">${g.isReached?"已達標":`${Number(g.progress||0).toFixed(1)}%`}</span></div><div class="progress-track"><i style="width:${Math.min(100,Number(g.progress||0))}%"></i></div><p>尚差 ${money.format(g.remainingAmount||0)}｜${escapeHtml(g.targetDate)}</p></article>`).join(""):'<p class="empty">尚無進行中目標。</p>';
  $("weeklyReviewNote").textContent=data.note||"";
}
async function loadDashboard() {
  const [portfolio, history, strategyData, analysisData, alertData, snapshotData, watchlistData, reportData, journalData, allocationData, dividendData, cashData, healthData, dailyBriefData, notificationData, integrityData, auditData, opportunityData, tradePlanData, reviewTaskData, dailyRoutineData, routineHistoryData, goalData, weeklyReviewData] = await Promise.all([api.dashboard(), api.transactions(), api.strategy(), api.analysis(), api.evaluateAlerts(), api.snapshots($("snapshotDays")?.value || 30), api.watchlist(), api.performanceReport(), api.journal(), api.allocationAnalysis(), api.dividends(), api.cashEntries(), api.portfolioHealth(), api.dailyBrief(), api.notifications(), api.integrity(), api.auditLogs($("auditDays")?.value || 30), api.opportunities(), api.tradePlans(), api.reviewTasks(), api.dailyRoutine(), api.dailyRoutineHistory($("routineHistoryDays")?.value || 30), api.goals(), api.weeklyReview()]);
  state.transactions = history.transactions || [];
  state.analysis = analysisData.analyses || [];
  renderPortfolio(portfolio); renderTransactions(state.transactions);
  renderStrategy(strategyData.strategy || analysisData.settings || {});
  renderAnalysis(analysisData);
  renderAlerts(alertData);
  renderSnapshots(snapshotData);
  renderWatchlist(watchlistData);
  renderPerformanceReport(reportData);
  renderJournal(journalData);
  renderAllocation(allocationData);
  renderDividends(dividendData);
  renderCash(cashData);
  renderHealth(healthData);
  renderDailyBrief(dailyBriefData);
  renderNotifications(notificationData);
  renderIntegrity(integrityData);
  renderAuditLogs(auditData);
  renderOpportunities(opportunityData);
  renderTradePlans(tradePlanData);
  renderReviewTasks(reviewTaskData);
  renderDailyRoutine(dailyRoutineData);
  renderRoutineHistory(routineHistoryData);
  renderGoals(goalData);
  renderWeeklyReview(weeklyReviewData);
  await loadSessions();
}



function tradePlanActionLabel(v){return v==="BUY"?"買進":"賣出"}
function tradePlanStatusLabel(v){return ({PLANNED:"計畫中",EXECUTED:"已執行",CANCELLED:"已取消"})[v]||v}
function renderTradePlans(data){
  state.tradePlans=data.items||[]; const x=data.summary||{};
  $("tradePlanSummary").innerHTML=`<span class="ai-chip">共 ${x.total||0} 筆</span><span class="ai-chip">計畫中 ${x.planned||0}</span><span class="ai-chip">已到價 ${x.triggered||0}</span><span class="ai-chip">報酬風險比 ≥2：${x.highQuality||0}</span><span class="ai-chip">預計資金 ${money.format(x.totalCapital||0)}</span>`;
  $("tradePlanCards").innerHTML=state.tradePlans.length?state.tradePlans.map(p=>`<article class="trade-plan-card ${p.trigger.startsWith("到達")?"trade-plan-triggered":""}">
    <div><strong>${escapeHtml(p.code)} ${escapeHtml(p.name)}</strong><p>${escapeHtml(p.note||"無計畫說明")}</p></div>
    <div><span class="label">方向／狀態</span><div class="value">${tradePlanActionLabel(p.action)}・${tradePlanStatusLabel(p.status)}</div><small>${escapeHtml(p.plannedDate)}</small></div>
    <div><span class="label">計畫／目前價</span><div class="value">${number.format(p.plannedPrice)} / ${p.currentPrice==null?"缺價格":number.format(p.currentPrice)}</div><small>${escapeHtml(p.trigger)}</small></div>
    <div><span class="label">股數／資金</span><div class="value">${number.format(p.shares)} 股</div><small>${money.format(p.capital)}</small></div>
    <div><span class="label">停損／目標</span><div class="value">${p.stopLossPrice==null?"—":number.format(p.stopLossPrice)} / ${p.targetPrice==null?"—":number.format(p.targetPrice)}</div><small>報酬風險比 ${p.rewardRiskRatio==null?"—":Number(p.rewardRiskRatio).toFixed(2)}</small></div>
    <div class="actions"><button class="edit" data-trade-plan-edit="${p.id}">修改</button><button class="delete" data-trade-plan-delete="${p.id}">刪除</button></div>
  </article>`).join(""):'<p class="empty">尚無交易計畫。</p>';
}
function resetTradePlanForm(){ $("tradePlanForm").reset(); $("tradePlanId").value=""; $("tradePlanDate").value=today(); $("tradePlanStatus").value="PLANNED"; $("saveTradePlan").textContent="儲存交易計畫"; $("cancelTradePlanEdit").classList.add("hidden"); }
function editTradePlan(id){ const p=state.tradePlans.find(x=>String(x.id)===String(id)); if(!p)return; $("tradePlanId").value=p.id; $("tradePlanDate").value=p.plannedDate; $("tradePlanCode").value=p.code; $("tradePlanName").value=p.name||""; $("tradePlanAction").value=p.action; $("tradePlanPrice").value=p.plannedPrice; $("tradePlanShares").value=p.shares; $("tradePlanStop").value=p.stopLossPrice??""; $("tradePlanTarget").value=p.targetPrice??""; $("tradePlanStatus").value=p.status; $("tradePlanNote").value=p.note||""; $("saveTradePlan").textContent="儲存修改"; $("cancelTradePlanEdit").classList.remove("hidden"); $("tradePlanForm").scrollIntoView({behavior:"smooth",block:"center"}); }

function renderOpportunities(data) {
  state.opportunities = data.items || [];
  const summary = data.summary || {};
  $("opportunitySummary").innerHTML = `<span class="ai-chip">觀察 ${summary.total || 0} 檔</span><span class="ai-chip">優先研究 ${summary.priorityResearch || 0}</span><span class="ai-chip">接近機會 ${summary.approaching || 0}</span><span class="ai-chip">資料不足 ${summary.missingData || 0}</span>`;
  $("opportunityCards").innerHTML = state.opportunities.length ? state.opportunities.map((item, index) => {
    const distance = item.distanceToBuyRate == null ? "—" : `${(item.distanceToBuyRate * 100).toFixed(2)}%`;
    const signalClass = item.signal === "優先研究" ? "signal-good" : item.signal === "避免追價" ? "signal-risk" : item.signal === "接近機會" ? "signal-watch" : "";
    return `<article class="opportunity-card">
      <div class="opportunity-rank">#${index + 1}</div>
      <div><strong>${escapeHtml(item.code)} ${escapeHtml(item.name)}</strong><p>${escapeHtml(item.note || "無觀察備註")}</p></div>
      <div><span class="label">機會分數</span><div class="opportunity-score">${item.score}</div></div>
      <div><span class="label">判斷</span><span class="signal ${signalClass}">${escapeHtml(item.signal)}</span></div>
      <div><span class="label">目前／買進價</span><div class="value">${item.currentPrice == null ? "缺價格" : number.format(item.currentPrice)} / ${item.targetBuyPrice == null ? "未設定" : number.format(item.targetBuyPrice)}</div><small>距離 ${distance}</small></div>
      <div class="analysis-detail"><span class="label">排序理由</span><ul class="reason-list">${(item.reasons || []).map(reason => `<li>${escapeHtml(reason)}</li>`).join("")}</ul></div>
    </article>`;
  }).join("") : '<p class="empty">觀察清單尚無股票。先加入觀察股票與目標買進價。</p>';
  $("opportunityDisclaimer").textContent = data.disclaimer || "";
}

function renderAuditLogs(data) {
  state.auditLogs = data.items || [];
  const summary = data.summary || {};
  $("auditSummary").innerHTML = `<span class="ai-chip">期間 ${data.days || 30} 天</span><span class="ai-chip">操作 ${summary.total || 0}</span><span class="ai-chip">失敗 ${summary.failed || 0}</span><span class="ai-chip">刪除 ${summary.deleted || 0}</span><span class="ai-chip">活躍日 ${summary.activeDays || 0}</span>`;
  const actionClass = { POST: "audit-create", PUT: "audit-update", PATCH: "audit-update", DELETE: "audit-delete" };
  $("auditCards").innerHTML = state.auditLogs.length ? state.auditLogs.map((x) => `
    <article class="audit-item ${actionClass[x.method] || ""}">
      <div><div class="audit-meta"><span class="brief-badge">${escapeHtml(x.action)}</span><time>${new Date(x.createdAt).toLocaleString("zh-TW")}</time><span class="${Number(x.statusCode) >= 400 ? "negative" : "positive"}">HTTP ${x.statusCode}</span></div><strong>${escapeHtml(x.resource)}</strong><p>${escapeHtml(x.ipAddress || "未知 IP")}・${escapeHtml(x.userAgent || "未知裝置")}</p></div>
    </article>`).join("") : '<p class="empty">此期間尚無新增、修改或刪除紀錄。</p>';
}

function renderIntegrity(data) {
  state.integrity = data;
  const statusLabels = { healthy: "正常", attention: "需注意", error: "發現錯誤" };
  const cls = data.status === "healthy" ? "integrity-ok" : data.status === "error" ? "integrity-error" : "integrity-attention";
  $("integritySummary").innerHTML = `<span class="ai-chip ${cls}">狀態 ${statusLabels[data.status] || "—"}</span><span class="ai-chip">持股重建 ${data.portfolioValid ? "通過" : "失敗"}</span><span class="ai-chip">缺價格 ${data.missingQuotes || 0}</span><span class="ai-chip">可清理憑證 ${data.staleSessions || 0}</span>`;
  const c = data.counts || {};
  $("integrityCounts").innerHTML = `<article class="metric"><span>交易紀錄</span><strong>${c.transactions || 0}</strong></article><article class="metric"><span>股價資料</span><strong>${c.quotes || 0}</strong></article><article class="metric"><span>價格提醒</span><strong>${c.alerts || 0}</strong></article><article class="metric"><span>資產快照</span><strong>${c.snapshots || 0}</strong></article>`;
  $("integrityIssues").innerHTML = (data.issues || []).length ? data.issues.map(x => `<li>${escapeHtml(x)}</li>`).join("") : "<li>交易歷史與資料結構檢查正常。</li>";
  $("integrityRecommendations").innerHTML = (data.recommendations || []).map(x => `<li>${escapeHtml(x)}</li>`).join("");
}

function renderNotifications(data) {
  state.notifications = data.items || [];
  const summary = data.summary || {};
  $("notificationSummary").innerHTML = `<span class="ai-chip">全部 ${summary.total || 0}</span><span class="ai-chip">未讀 ${summary.unread || 0}</span><span class="ai-chip">緊急未讀 ${summary.urgent || 0}</span>`;
  const badge = $("notificationBadge");
  badge.textContent = summary.unread || 0;
  badge.classList.toggle("hidden", !(summary.unread > 0));
  const labels = { urgent: "立即處理", important: "重要", normal: "一般" };
  $("notificationCards").innerHTML = state.notifications.length ? state.notifications.map((x) => `
    <article class="notification-item ${x.readAt ? "is-read" : "is-unread"} notification-${escapeHtml(x.severity)}">
      <div class="notification-main"><div class="notification-meta"><span class="brief-badge">${labels[x.severity] || "一般"}</span><span>${escapeHtml(x.category)}${x.code ? "・"+escapeHtml(x.code) : ""}</span><time>${new Date(x.occurredAt).toLocaleString("zh-TW")}</time></div><strong>${escapeHtml(x.title)}</strong><p>${escapeHtml(x.detail)}</p></div>
      <div class="actions"><button class="edit" data-notification-read="${x.id}" data-read="${x.readAt ? "false" : "true"}">${x.readAt ? "設為未讀" : "標為已讀"}</button><button class="delete" data-notification-dismiss="${x.id}">移除</button></div>
    </article>`).join("") : '<p class="empty">尚無通知。按「同步今日通知」建立通知。</p>';
}

function renderDailyBrief(data) {
  const s = data.summary || {};
  $("dailyBriefHeadline").textContent = data.headline || "今日行動清單";
  $("dailyBriefSummary").innerHTML = `<span class="ai-chip">健康分數 ${s.healthScore ?? "—"}</span><span class="ai-chip">立即處理 ${s.urgent || 0}</span><span class="ai-chip">重要 ${s.important || 0}</span><span class="ai-chip">提醒觸發 ${s.triggeredAlerts || 0}</span>`;
  const label = { urgent: "立即處理", important: "重要", normal: "一般" };
  $("dailyBriefCards").innerHTML = (data.actions || []).length ? data.actions.map((x) => `<article class="brief-item brief-${escapeHtml(x.type)}"><div class="brief-badge">${label[x.type] || "一般"}</div><div><strong>${escapeHtml(x.title)}</strong><p>${escapeHtml(x.detail)}</p><small>${escapeHtml(x.category)}${x.code ? "・"+escapeHtml(x.code) : ""}</small></div></article>`).join("") : '<p class="empty">今天沒有明顯待辦事項，持續更新交易與股價即可。</p>';
}
function renderHealth(data) {
  const s = data.summary || {};
  const score = Number(data.score || 0);
  $("healthScore").textContent = score;
  $("healthGrade").textContent = data.grade || "—";
  $("healthScore").className = score >= 90 ? "health-score positive" : score >= 60 ? "health-score" : "health-score negative";
  $("healthMetrics").innerHTML = `
    <article class="metric"><span>估算淨資產</span><strong>${money.format(s.netAsset || 0)}</strong></article>
    <article class="metric"><span>持股市值</span><strong>${money.format(s.marketValue || 0)}</strong></article>
    <article class="metric"><span>估算現金</span><strong class="${Number(s.estimatedCash)<0?'negative':''}">${money.format(s.estimatedCash || 0)}</strong></article>
    <article class="metric"><span>最大持股比重</span><strong>${s.largestPositionCode ? escapeHtml(s.largestPositionCode)+' '+(Number(s.largestPositionRate)*100).toFixed(1)+'%' : '—'}</strong></article>`;
  $("healthIssues").innerHTML = (data.issues || []).length ? data.issues.map(x=>`<li>${escapeHtml(x)}</li>`).join("") : "<li>目前沒有明顯異常。</li>";
  $("healthRecommendations").innerHTML = (data.recommendations || []).map(x=>`<li>${escapeHtml(x)}</li>`).join("");
}
function renderPortfolio(data) {
  const summary = data.summary || {};
  $("positionCount").textContent = summary.positionCount || 0;
  $("totalCost").textContent = money.format(summary.totalCost || 0);
  $("marketValue").textContent = money.format(summary.marketValue || 0);
  const unrealized = Number(summary.unrealizedProfit || 0);
  $("unrealizedProfit").textContent = money.format(unrealized);
  $("unrealizedProfit").className = unrealized > 0 ? "positive" : unrealized < 0 ? "negative" : "";
  $("unrealizedRoi").textContent = `${(Number(summary.unrealizedRoi || 0) * 100).toFixed(2)}%`;
  const profit = Number(summary.realizedProfit || 0);
  const profitEl = $("realizedProfit"); profitEl.textContent = money.format(profit); profitEl.className = profit > 0 ? "positive" : profit < 0 ? "negative" : "";
  const positions = data.positions || [];
  $("positions").innerHTML = positions.length ? positions.map((p) => `
    <article class="card">
      <div class="card-title"><strong>${escapeHtml(p.code)} ${escapeHtml(p.name)}</strong><small>目前持股</small></div>
      <div><span class="label">股數</span><div class="value">${number.format(p.shares)}</div></div>
      <div><span class="label">平均成本</span><div class="value">${money.format(p.averageCost)}</div></div>
      <div><span class="label">總成本</span><div class="value">${money.format(p.totalCost)}</div></div>
      <div><span class="label">目前價格</span><div class="value">${p.currentPrice == null ? "尚未輸入" : money.format(p.currentPrice)}</div></div>
      <div><span class="label">目前市值</span><div class="value">${p.marketValue == null ? "—" : money.format(p.marketValue)}</div></div>
      <div><span class="label">未實現損益</span><div class="value ${Number(p.unrealizedProfit) > 0 ? "positive" : Number(p.unrealizedProfit) < 0 ? "negative" : ""}">${p.unrealizedProfit == null ? "—" : `${money.format(p.unrealizedProfit)} (${(Number(p.roi) * 100).toFixed(2)}%)`}</div></div>
    </article>`).join("") : '<p class="empty">尚無持股，請先新增買進交易。</p>';
}




function renderAllocation(data) {
  state.allocation = data.items || [];
  const summary = data.summary || {};
  const totalPct = Number(summary.targetTotal || 0) * 100;
  $("allocationSummary").innerHTML = `<span class="ai-chip">目標合計 ${totalPct.toFixed(1)}%</span><span class="ai-chip">已設定 ${summary.configured || 0} 檔</span><span class="ai-chip">可增加 ${summary.underweight || 0}</span><span class="ai-chip">可降低 ${summary.overweight || 0}</span><span class="ai-chip">缺價格 ${summary.missingPrice || 0}</span>`;
  $("allocationCards").innerHTML = state.allocation.length ? state.allocation.map((x) => {
    const gap = Number(x.gapRate || 0);
    const amount = Number(x.rebalanceAmount || 0);
    const cls = x.action === "可考慮增加" || x.action === "目前未持有" ? "positive" : x.action === "可考慮降低" ? "negative" : "";
    return `<article class="card allocation-card">
      <div class="card-title"><strong>${escapeHtml(x.code)} ${escapeHtml(x.name)}</strong><small>${escapeHtml(x.category)}</small></div>
      <div><span class="label">目前／目標比重</span><div class="value">${(Number(x.currentRate)*100).toFixed(1)}% / ${(Number(x.targetRate)*100).toFixed(1)}%</div></div>
      <div><span class="label">比重差距</span><div class="value ${gap>0?'positive':gap<0?'negative':''}">${gap>=0?'+':''}${(gap*100).toFixed(1)}%</div></div>
      <div><span class="label">估算再平衡</span><div class="value ${amount>0?'positive':amount<0?'negative':''}">${amount>=0?'+':''}${money.format(amount)}</div></div>
      <div><span class="label">判斷</span><div class="value ${cls}">${escapeHtml(x.action)}</div></div>
      <div class="actions"><button class="edit" data-allocation-edit="${escapeHtml(x.code)}">修改</button><button class="delete" data-allocation-delete="${escapeHtml(x.code)}">刪除目標</button></div>
    </article>`;
  }).join("") : '<p class="empty">尚無持股或配置目標。</p>';
}
function resetAllocationForm() {
  $("allocationForm").reset(); $("allocationCode").readOnly = false; $("allocationCategory").value = "未分類"; $("saveAllocation").textContent = "儲存配置目標"; $("cancelAllocationEdit").classList.add("hidden");
}
function editAllocation(code) {
  const x = state.allocation.find((item) => item.code === code); if (!x) return;
  $("allocationCode").value = x.code; $("allocationCode").readOnly = true; $("allocationCategory").value = x.category || "未分類"; $("allocationTargetRate").value = (Number(x.targetRate || 0)*100).toFixed(1); $("saveAllocation").textContent = "儲存修改"; $("cancelAllocationEdit").classList.remove("hidden"); $("allocationForm").scrollIntoView({ behavior:"smooth", block:"center" });
}

function decisionLabel(value) { return ({ BUY:"買進", SELL:"賣出", HOLD:"續抱", OBSERVE:"觀察", REVIEW:"檢討" })[value] || value; }
function renderDividends(data) {
  state.dividends = data.items || [];
  const summary = data.summary || {};
  $("dividendSummary").innerHTML = `<span class="ai-chip">共 ${summary.count || 0} 筆</span><span class="ai-chip">股利總額 ${money.format(summary.grossAmount || 0)}</span><span class="ai-chip">稅費 ${money.format(summary.taxAndFee || 0)}</span><span class="ai-chip">淨收入 <strong class="positive">${money.format(summary.netAmount || 0)}</strong></span>`;
  $("dividendCards").innerHTML = state.dividends.length ? state.dividends.map((x) => `<article class="card">
    <div class="card-title"><strong>${escapeHtml(x.code)} ${escapeHtml(x.name)}</strong><small>除息日 ${escapeHtml(x.exDate)}</small></div>
    <div><span class="label">股數 × 每股股利</span><div class="value">${number.format(x.shares)} × ${number.format(x.dividendPerShare)}</div></div>
    <div><span class="label">股利總額</span><div class="value">${money.format(x.grossAmount)}</div></div>
    <div><span class="label">淨收入</span><div class="value positive">${money.format(x.netAmount)}</div></div>
    <div><span class="label">發放日</span><div class="value">${x.payDate || "尚未填寫"}</div></div>
    <div class="watch-note">${escapeHtml(x.note || "無備註")}</div>
    <div class="actions"><button class="edit" data-dividend-edit="${x.id}">修改</button><button class="delete" data-dividend-delete="${x.id}">刪除</button></div>
  </article>`).join("") : '<p class="empty">尚無股利紀錄。</p>';
}
function resetDividendForm() {
  $("dividendForm").reset(); $("dividendId").value = ""; $("dividendExDate").value = today(); $("dividendTax").value = "0"; $("dividendFee").value = "0"; $("saveDividend").textContent = "儲存股利紀錄"; $("cancelDividendEdit").classList.add("hidden");
}
function editDividend(id) {
  const x = state.dividends.find((item) => String(item.id) === String(id)); if (!x) return;
  $("dividendId").value=x.id; $("dividendCode").value=x.code; $("dividendName").value=x.name||""; $("dividendExDate").value=x.exDate; $("dividendPayDate").value=x.payDate||""; $("dividendShares").value=x.shares; $("dividendPerShare").value=x.dividendPerShare; $("dividendTax").value=x.tax; $("dividendFee").value=x.fee; $("dividendNote").value=x.note||""; $("saveDividend").textContent="儲存修改"; $("cancelDividendEdit").classList.remove("hidden"); $("dividendForm").scrollIntoView({behavior:"smooth",block:"center"});
}


function cashTypeLabel(value) { return ({ DEPOSIT:"資金存入", WITHDRAW:"資金提領", INTEREST:"利息收入", FEE:"帳戶費用", OTHER_IN:"其他收入", OTHER_OUT:"其他支出" })[value] || value; }
function renderCash(data) {
  state.cashEntries = data.items || [];
  const s = data.summary || {};
  const estimated = Number(s.estimatedCashBalance || 0);
  $("cashSummary").innerHTML = `<span class="ai-chip">現金紀錄 ${s.count || 0} 筆</span><span class="ai-chip">存入/收入 ${money.format(s.inflow || 0)}</span><span class="ai-chip">提領/支出 ${money.format(s.outflow || 0)}</span><span class="ai-chip">估算現金 <strong class="${estimated>0?'positive':estimated<0?'negative':''}">${money.format(estimated)}</strong></span>`;
  $("cashCards").innerHTML = state.cashEntries.length ? state.cashEntries.map((x) => {
    const signed = Number(x.signedAmount || 0);
    return `<article class="card"><div class="card-title"><strong>${cashTypeLabel(x.type)}</strong><small>${escapeHtml(x.entryDate)}</small></div><div><span class="label">金額</span><div class="value ${signed>0?'positive':'negative'}">${signed>0?'+':'-'}${money.format(Math.abs(signed))}</div></div><div class="watch-note">${escapeHtml(x.note || "無備註")}</div><div class="actions"><button class="edit" data-cash-edit="${x.id}">修改</button><button class="delete" data-cash-delete="${x.id}">刪除</button></div></article>`;
  }).join("") : '<p class="empty">尚無現金紀錄。</p>';
}
function resetCashForm() { $("cashForm").reset(); $("cashId").value=""; $("cashDate").value=today(); $("saveCash").textContent="儲存現金紀錄"; $("cancelCashEdit").classList.add("hidden"); }
function editCash(id) { const x=state.cashEntries.find(item=>String(item.id)===String(id)); if(!x)return; $("cashId").value=x.id; $("cashDate").value=x.entryDate; $("cashType").value=x.type; $("cashAmount").value=x.amount; $("cashNote").value=x.note||""; $("saveCash").textContent="儲存修改"; $("cancelCashEdit").classList.remove("hidden"); $("cashForm").scrollIntoView({behavior:"smooth",block:"center"}); }

function renderJournal(data) {
  const entries = data.entries || []; state.journal = entries;
  const summary = data.summary || {};
  $("journalSummary").innerHTML = `<span class="ai-chip">共 ${summary.total || 0} 篇</span><span class="ai-chip">高信心 ${summary.highConfidence || 0} 篇</span><span class="ai-chip">已完成檢討 ${summary.reviewed || 0} 篇</span>`;
  $("journalCards").innerHTML = entries.length ? entries.map((entry) => `<article class="card journal-card">
    <div class="card-title"><strong>${escapeHtml(entry.title)}</strong><small>${escapeHtml(entry.entryDate)} ${entry.code ? "・"+escapeHtml(entry.code) : ""}</small></div>
    <div><span class="label">決策</span><div class="value">${decisionLabel(entry.decision)}</div></div>
    <div><span class="label">信心</span><div class="confidence-stars">${"★".repeat(entry.confidence)}${"☆".repeat(5-entry.confidence)}</div></div>
    <div class="journal-text"><strong>計畫：</strong>${escapeHtml(entry.plan || "尚未填寫")}<br><strong>結果：</strong>${escapeHtml(entry.result || "尚未補寫")}<br><strong>心得：</strong>${escapeHtml(entry.lesson || "尚未檢討")}</div>
    <div class="actions"><button class="edit" data-journal-edit="${entry.id}">修改</button><button class="delete" data-journal-delete="${entry.id}">刪除</button></div>
  </article>`).join("") : '<p class="empty">尚無投資日誌。</p>';
}
function resetJournalForm() {
  $("journalForm").reset(); $("journalId").value = ""; $("journalDate").value = today(); $("journalConfidence").value = "3"; $("saveJournal").textContent = "儲存日誌"; $("cancelJournalEdit").classList.add("hidden");
}
function editJournalEntry(id) {
  const entry = state.journal.find((item) => String(item.id) === String(id)); if (!entry) return;
  $("journalId").value = entry.id; $("journalDate").value = entry.entryDate; $("journalCode").value = entry.code || ""; $("journalTitle").value = entry.title; $("journalDecision").value = entry.decision; $("journalConfidence").value = entry.confidence; $("journalPlan").value = entry.plan || ""; $("journalResult").value = entry.result || ""; $("journalLesson").value = entry.lesson || ""; $("saveJournal").textContent = "儲存修改"; $("cancelJournalEdit").classList.remove("hidden"); $("journalForm").scrollIntoView({ behavior:"smooth", block:"center" });
}
function renderPerformanceReport(data) {
  const s = data.summary || {};
  $("reportSummary").innerHTML = `<span class="ai-chip">勝率 ${(Number(s.winRate || 0) * 100).toFixed(1)}%</span><span class="ai-chip">獲利賣出 ${s.winningSells || 0}</span><span class="ai-chip">虧損賣出 ${s.losingSells || 0}</span><span class="ai-chip">交易 ${s.transactionCount || 0} 筆</span>`;
  $("reportMetrics").innerHTML = `
    <article class="metric"><span>總損益</span><strong class="${Number(s.totalProfit)>0?'positive':Number(s.totalProfit)<0?'negative':''}">${money.format(s.totalProfit || 0)}</strong></article>
    <article class="metric"><span>已實現損益</span><strong class="${Number(s.realizedProfit)>0?'positive':Number(s.realizedProfit)<0?'negative':''}">${money.format(s.realizedProfit || 0)}</strong></article>
    <article class="metric"><span>未實現損益</span><strong class="${Number(s.unrealizedProfit)>0?'positive':Number(s.unrealizedProfit)<0?'negative':''}">${money.format(s.unrealizedProfit || 0)}</strong></article>
    <article class="metric"><span>累計手續費</span><strong>${money.format(s.totalFees || 0)}</strong></article>
    <article class="metric"><span>累計交易稅</span><strong>${money.format(s.totalTaxes || 0)}</strong></article>`;
  const months = data.monthly || [];
  $("monthlyReport").innerHTML = months.length ? `<div class="snapshot-row"><span>月份</span><span>已實現損益</span><span>賣出次數</span></div>${months.map(m=>`<div class="snapshot-row"><span>${escapeHtml(m.month)}</span><span class="${Number(m.realizedProfit)>0?'positive':Number(m.realizedProfit)<0?'negative':''}">${money.format(m.realizedProfit)}</span><span>${m.sellCount}</span></div>`).join("")}` : '<p class="empty">尚無賣出紀錄。</p>';
  const stocks = data.stocks || [];
  $("stockReport").innerHTML = stocks.length ? stocks.map(x=>`<article class="card report-card"><div class="card-title"><strong>${escapeHtml(x.code)} ${escapeHtml(x.name)}</strong><small>賣出 ${x.sellCount} 次</small></div><div><span class="label">已實現</span><div class="value ${Number(x.realizedProfit)>0?'positive':Number(x.realizedProfit)<0?'negative':''}">${money.format(x.realizedProfit)}</div></div><div><span class="label">未實現</span><div class="value ${Number(x.unrealizedProfit)>0?'positive':Number(x.unrealizedProfit)<0?'negative':''}">${x.unrealizedProfit==null?'缺價格':money.format(x.unrealizedProfit)}</div></div><div><span class="label">勝率</span><div class="value">${x.winRate==null?'—':(Number(x.winRate)*100).toFixed(1)+'%'}</div></div></article>`).join("") : '<p class="empty">尚無績效資料。</p>';
}

function renderSnapshots(data) {
  const items = data.snapshots || [];
  state.snapshots = items;
  const summary = data.summary || {};
  const change = Number(summary.change || 0);
  const changeRate = Number(summary.changeRate || 0);
  $("snapshotSummary").innerHTML = `<span class="ai-chip">共 ${summary.count || 0} 天</span><span class="ai-chip">期間變化 <strong class="${change > 0 ? "positive" : change < 0 ? "negative" : ""}">${money.format(change)}</strong></span><span class="ai-chip">變化率 ${(changeRate * 100).toFixed(2)}%</span>`;

  const svg = $("assetChart");
  if (!items.length) {
    svg.innerHTML = `<text x="450" y="150" text-anchor="middle" class="chart-label">尚無資產快照</text>`;
    $("snapshotTable").innerHTML = '<p class="empty">按「儲存今日快照」建立第一筆紀錄。</p>';
    return;
  }

  const width = 900, height = 300, left = 72, right = 24, top = 24, bottom = 48;
  const values = items.map((x) => Number(x.marketValue || 0));
  let min = Math.min(...values), max = Math.max(...values);
  if (min === max) { min -= Math.max(1, Math.abs(min) * 0.05); max += Math.max(1, Math.abs(max) * 0.05); }
  const x = (i) => left + (items.length === 1 ? (width-left-right)/2 : i * (width-left-right)/(items.length-1));
  const y = (v) => top + (max-v) * (height-top-bottom)/(max-min);
  const points = items.map((item, i) => `${x(i).toFixed(1)},${y(Number(item.marketValue || 0)).toFixed(1)}`).join(" ");
  const areaPoints = `${left},${height-bottom} ${points} ${x(items.length-1)},${height-bottom}`;
  const grid = [0, .25, .5, .75, 1].map((r) => { const gy = top + r * (height-top-bottom); const value = max - r * (max-min); return `<line x1="${left}" y1="${gy}" x2="${width-right}" y2="${gy}" class="chart-grid"/><text x="${left-8}" y="${gy+4}" text-anchor="end" class="chart-label">${Math.round(value).toLocaleString("zh-TW")}</text>`; }).join("");
  const dots = items.map((item,i) => `<circle cx="${x(i)}" cy="${y(Number(item.marketValue || 0))}" r="4" class="chart-dot"><title>${item.snapshotDate} ${money.format(item.marketValue)}</title></circle>`).join("");
  const firstDate = String(items[0].snapshotDate).slice(5);
  const lastDate = String(items.at(-1).snapshotDate).slice(5);
  svg.innerHTML = `${grid}<polygon points="${areaPoints}" class="chart-area"/><polyline points="${points}" class="chart-line"/>${dots}<text x="${left}" y="${height-16}" class="chart-label">${escapeHtml(firstDate)}</text><text x="${width-right}" y="${height-16}" text-anchor="end" class="chart-label">${escapeHtml(lastDate)}</text>`;

  const recent = [...items].reverse().slice(0, 10);
  $("snapshotTable").innerHTML = `<div class="snapshot-row"><span>日期</span><span>市值</span><span>未實現損益</span><span>報酬率</span></div>` + recent.map((item) => {
    const profit = Number(item.unrealizedProfit || 0);
    return `<div class="snapshot-row"><span>${escapeHtml(item.snapshotDate)}</span><span>${money.format(item.marketValue)}</span><span class="${profit > 0 ? "positive" : profit < 0 ? "negative" : ""}">${money.format(profit)}</span><span>${(Number(item.roi || 0)*100).toFixed(2)}%</span></div>`;
  }).join("");
}


function renderWatchlist(data) {
  state.watchlist = data.items || [];
  const summary = data.summary || {};
  $("watchSummary").innerHTML = `<span class="ai-chip">全部 ${summary.total || 0}</span><span class="ai-chip">買進觀察 ${summary.buyReady || 0}</span><span class="ai-chip">賣出觀察 ${summary.sellReady || 0}</span><span class="ai-chip">缺價格 ${summary.missingPrice || 0}</span>`;
  $("watchCards").innerHTML = state.watchlist.length ? state.watchlist.map((w) => {
    const statusClass = w.status === "到達買進觀察價" ? "positive" : w.status === "到達賣出觀察價" ? "negative" : "";
    return `<article class="card watch-card">
      <div class="card-title"><strong>${escapeHtml(w.code)} ${escapeHtml(w.name)}</strong><small>優先程度 ${w.priority}</small></div>
      <div><span class="label">目前價格</span><div class="value">${w.currentPrice == null ? "尚未輸入" : money.format(w.currentPrice)}</div></div>
      <div><span class="label">買進／賣出觀察價</span><div class="value">${w.targetBuyPrice == null ? "—" : money.format(w.targetBuyPrice)} / ${w.targetSellPrice == null ? "—" : money.format(w.targetSellPrice)}</div></div>
      <div><span class="label">狀態</span><div class="value ${statusClass}">${escapeHtml(w.status)}</div></div>
      <div class="watch-note">${escapeHtml(w.note || "無備註")}</div>
      <div class="actions"><button class="edit" data-watch-edit="${w.id}">修改</button><button class="delete" data-watch-delete="${w.id}">刪除</button></div>
    </article>`;
  }).join("") : '<p class="empty">尚無觀察股票。</p>';
}

function resetWatchlistForm() {
  $("watchlistForm").reset(); $("watchlistId").value = ""; $("watchPriority").value = "3";
  $("saveWatchlist").textContent = "加入觀察"; $("cancelWatchEdit").classList.add("hidden");
}

function editWatchlistItem(id) {
  const w = state.watchlist.find((x) => String(x.id) === String(id)); if (!w) return;
  $("watchlistId").value = w.id; $("watchCode").value = w.code; $("watchName").value = w.name || "";
  $("watchBuyPrice").value = w.targetBuyPrice ?? ""; $("watchSellPrice").value = w.targetSellPrice ?? "";
  $("watchPriority").value = String(w.priority); $("watchNote").value = w.note || "";
  $("saveWatchlist").textContent = "儲存修改"; $("cancelWatchEdit").classList.remove("hidden");
  $("watchlistForm").scrollIntoView({ behavior: "smooth", block: "center" });
}
function renderStrategy(s) {
  $("targetProfitRate").value = (Number(s.targetProfitRate || 0.03) * 100).toFixed(1);
  $("stopLossRate").value = (Number(s.stopLossRate || 0.08) * 100).toFixed(1);
  $("maxPositionRate").value = (Number(s.maxPositionRate || 0.35) * 100).toFixed(0);
  $("staleQuoteHours").value = Number(s.staleQuoteHours || 24);
}

function signalClass(action) {
  if (action === "分批停利" || action === "續抱觀察") return "signal-good";
  if (action === "風險處理" || action === "降低集中度") return "signal-risk";
  return "signal-watch";
}

function renderAnalysis(data) {
  const summary = data.summary || {};
  $("aiSummary").innerHTML = `<span class="ai-chip">分析 ${summary.total || 0} 檔</span><span class="ai-chip">停利 ${summary.takeProfit || 0}</span><span class="ai-chip">風險 ${summary.risk || 0}</span><span class="ai-chip">缺價格 ${summary.missingPrice || 0}</span>`;
  const items = data.analyses || [];
  $("analysisCards").innerHTML = items.length ? items.map((a) => `
    <article class="card analysis-card">
      <div class="card-title"><strong>${escapeHtml(a.code)} ${escapeHtml(a.name)}</strong><small>信心：${escapeHtml(a.confidence)}｜分數 ${a.score}</small></div>
      <div><span class="label">判斷</span><div><span class="signal ${signalClass(a.action)}">${escapeHtml(a.action)}</span></div></div>
      <div><span class="label">目標／停損</span><div class="value">${money.format(a.targetPrice)} / ${money.format(a.stopPrice)}</div></div>
      <div class="analysis-detail"><ul class="reason-list">${(a.reasons || []).map((r)=>`<li>${escapeHtml(r)}</li>`).join("")}${(a.warnings || []).map((r)=>`<li class="warning-list">${escapeHtml(r)}</li>`).join("")}</ul></div>
    </article>`).join("") : '<p class="empty">尚無持股可分析，請先新增買進交易。</p>';
}

function renderAlerts(data) {
  state.alerts = data.alerts || [];
  const summary = data.summary || {};
  $("alertSummary").innerHTML = `<span class="ai-chip">全部 ${summary.total || 0}</span><span class="ai-chip">啟用 ${summary.enabled || 0}</span><span class="ai-chip">已觸發 ${summary.triggered || 0}</span><span class="ai-chip">缺價格 ${summary.waitingPrice || 0}</span>`;
  $("alertCards").innerHTML = state.alerts.length ? state.alerts.map((a) => {
    const hit = Boolean(a.triggeredAt);
    const condition = a.direction === "ABOVE" ? "高於或等於" : "低於或等於";
    return `<article class="card ${hit ? "alert-triggered" : ""}">
      <div class="card-title"><strong>${escapeHtml(a.code)} ${escapeHtml(a.name)}</strong><small>${a.enabled ? "啟用中" : "已停用"}</small></div>
      <div><span class="label">條件</span><div class="value">${condition} ${money.format(a.targetPrice)}</div></div>
      <div><span class="label">目前價格</span><div class="value">${a.lastSeenPrice == null ? "尚未輸入" : money.format(a.lastSeenPrice)}</div></div>
      <div><span class="label">狀態</span><div class="alert-status ${hit ? "positive" : ""}">${hit ? "已達條件" : "等待中"}</div></div>
      <div class="alert-actions"><button data-alert-edit="${a.id}">修改</button><button data-alert-toggle="${a.id}">${a.enabled ? "停用" : "啟用"}</button><button class="delete" data-alert-delete="${a.id}">刪除</button></div>
    </article>`;
  }).join("") : '<p class="empty">尚無價格提醒。</p>';
}

function resetAlertForm() {
  $("alertForm").reset(); $("alertId").value = ""; $("saveAlert").textContent = "建立提醒"; $("cancelAlertEdit").classList.add("hidden");
}

function editAlert(id) {
  const a = state.alerts.find((x) => String(x.id) === String(id)); if (!a) return;
  $("alertId").value = a.id; $("alertCode").value = a.code; $("alertName").value = a.name || "";
  $("alertDirection").value = a.direction; $("alertTargetPrice").value = a.targetPrice;
  $("saveAlert").textContent = "儲存修改"; $("cancelAlertEdit").classList.remove("hidden");
  $("alertForm").scrollIntoView({ behavior: "smooth", block: "center" });
}

function renderTransactions(items) {
  $("transactions").innerHTML = items.length ? items.map((t) => `
    <article class="card">
      <div class="card-title"><strong>${escapeHtml(t.code)} ${escapeHtml(t.name)}</strong><small>${escapeHtml(t.tradeDate)}</small></div>
      <div><span class="label">類型</span><div class="value ${t.type === "BUY" ? "buy" : "sell"}">${t.type === "BUY" ? "買進" : "賣出"}</div></div>
      <div><span class="label">股數</span><div class="value">${number.format(t.shares)}</div></div>
      <div><span class="label">成交價</span><div class="value">${money.format(t.price)}</div></div>
      <div class="actions"><button class="edit" data-edit="${t.id}">修改</button><button class="delete" data-delete="${t.id}">刪除</button></div>
    </article>`).join("") : '<p class="empty">尚無交易紀錄。</p>';
}

function resetTransactionForm() {
  $("transactionForm").reset(); $("transactionId").value = ""; $("tradeDate").value = today(); $("fee").value = 0; $("tax").value = 0;
  $("formTitle").textContent = "輸入買進或賣出"; $("saveTransaction").textContent = "儲存交易"; $("cancelEdit").classList.add("hidden");
}
function editTransaction(id) {
  const t = state.transactions.find((item) => String(item.id) === String(id)); if (!t) return;
  $("transactionId").value = t.id; $("type").value = t.type; $("code").value = t.code; $("stockName").value = t.name || "";
  $("shares").value = t.shares; $("price").value = t.price; $("fee").value = t.fee || 0; $("tax").value = t.tax || 0; $("tradeDate").value = String(t.tradeDate).slice(0,10); $("note").value = t.note || "";
  $("formTitle").textContent = "修改交易紀錄"; $("saveTransaction").textContent = "儲存修改"; $("cancelEdit").classList.remove("hidden");
  $("transactionForm").scrollIntoView({ behavior: "smooth", block: "start" });
}

$("loginTab").addEventListener("click", () => switchAuthMode("login"));
$("registerTab").addEventListener("click", () => switchAuthMode("register"));
$("authForm").addEventListener("submit", async (event) => {
  event.preventDefault(); const button = $("authSubmit"); setBusy(button, true, "處理中…");
  try {
    const payload = { email: $("email").value.trim(), password: $("password").value };
    if (state.mode === "register") { payload.name = $("name").value.trim(); await api.register(payload); toast("帳號建立成功，請登入"); switchAuthMode("login"); $("password").value = ""; }
    else { const data = await api.login(payload); showApp(data.user); resetTransactionForm(); await Promise.all([loadDashboard(), loadFeaturePreferences(), loadDisplayPreference(), loadOnboarding(), loadFreshness()]); }
  } catch (error) { toast(error.message); } finally { setBusy(button, false, ""); }
});
$("logoutButton").addEventListener("click", async () => { try { await api.logout(); } finally { showAuth(); toast("已登出"); } });
$("snapshotDays").addEventListener("change", async () => {
  try { renderSnapshots(await api.snapshots($("snapshotDays").value)); } catch (error) { toast(error.message); }
});
$("saveSnapshot").addEventListener("click", async () => {
  const button = $("saveSnapshot"); setBusy(button, true, "儲存中…");
  try { await api.saveTodaySnapshot(); renderSnapshots(await api.snapshots($("snapshotDays").value)); toast("今日資產快照已儲存"); }
  catch (error) { toast(error.message); } finally { setBusy(button, false, ""); }
});
$("refreshButton").addEventListener("click", async () => { try { await loadDashboard(); toast("資料已更新"); } catch (e) { toast(e.message); } });
$("cancelEdit").addEventListener("click", resetTransactionForm);

$("transactionForm").addEventListener("submit", async (event) => {
  event.preventDefault(); const button = $("saveTransaction"); setBusy(button, true, "儲存中…");
  const payload = { type: $("type").value, code: $("code").value.trim(), name: $("stockName").value.trim(), shares: Number($("shares").value), price: Number($("price").value), fee: Number($("fee").value || 0), tax: Number($("tax").value || 0), tradeDate: $("tradeDate").value, note: $("note").value.trim() };
  try {
    const id = $("transactionId").value;
    if (id) await api.updateTransaction(id, payload); else await api.createTransaction(payload);
    resetTransactionForm();
  resetWatchlistForm();
  resetAlertForm(); await loadDashboard(); toast(id ? "交易已修改" : "交易已新增");
  } catch (error) { toast(error.message); } finally { setBusy(button, false, ""); }
});



$("alertForm").addEventListener("submit", async (event) => {
  event.preventDefault(); const button = $("saveAlert"); setBusy(button, true, "儲存中…");
  const payload = { code: $("alertCode").value.trim(), name: $("alertName").value.trim(), direction: $("alertDirection").value, targetPrice: Number($("alertTargetPrice").value) };
  try {
    const id = $("alertId").value;
    if (id) { const old = state.alerts.find((a) => String(a.id) === String(id)); await api.updateAlert(id, { ...payload, enabled: old?.enabled !== false }); }
    else await api.createAlert(payload);
    resetAlertForm(); await loadDashboard(); toast(id ? "提醒已修改" : "提醒已建立");
  } catch (error) { toast(error.message); } finally { setBusy(button, false, ""); }
});
$("cancelAlertEdit").addEventListener("click", resetAlertForm);
$("evaluateAlerts").addEventListener("click", async () => { try { renderAlerts(await api.evaluateAlerts()); toast("提醒已檢查"); } catch (e) { toast(e.message); } });
$("alertCards").addEventListener("click", async (event) => {
  const editId = event.target.dataset.alertEdit; if (editId) return editAlert(editId);
  const toggleId = event.target.dataset.alertToggle;
  if (toggleId) { const a = state.alerts.find((x) => String(x.id) === String(toggleId)); if (!a) return; try { await api.updateAlert(toggleId, { code:a.code, name:a.name, direction:a.direction, targetPrice:a.targetPrice, enabled:!a.enabled }); await loadDashboard(); toast(a.enabled ? "提醒已停用" : "提醒已啟用"); } catch(e) { toast(e.message); } return; }
  const deleteId = event.target.dataset.alertDelete; if (!deleteId || !confirm("確定刪除這個價格提醒？")) return;
  try { await api.deleteAlert(deleteId); await loadDashboard(); toast("提醒已刪除"); } catch(e) { toast(e.message); }
});

$("strategyForm").addEventListener("submit", async (event) => {
  event.preventDefault(); const button = $("saveStrategy"); setBusy(button, true, "儲存中…");
  const payload = {
    targetProfitRate: Number($("targetProfitRate").value) / 100,
    stopLossRate: Number($("stopLossRate").value) / 100,
    maxPositionRate: Number($("maxPositionRate").value) / 100,
    staleQuoteHours: Number($("staleQuoteHours").value)
  };
  try { await api.saveStrategy(payload); await loadDashboard(); toast("策略設定已更新"); }
  catch (error) { toast(error.message); } finally { setBusy(button, false, ""); }
});

$("refreshAnalysis").addEventListener("click", async () => {
  try { const data = await api.analysis(); renderAnalysis(data); toast("分析已更新"); } catch (error) { toast(error.message); }
});

$("csvFile").addEventListener("change", () => {
  const file = $("csvFile").files[0];
  $("csvFileName").textContent = file ? `已選擇：${file.name}` : "尚未選擇 CSV 檔。";
});

$("exportCsv").addEventListener("click", async () => {
  const button = $("exportCsv"); setBusy(button, true, "準備中…");
  try {
    const blob = await api.exportTransactionsCsv();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `BJH_AI_Pro_Transactions_${today()}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("交易 CSV 已下載");
  } catch (error) { toast(error.message); } finally { setBusy(button, false, ""); }
});

$("importCsv").addEventListener("click", async () => {
  const file = $("csvFile").files[0];
  if (!file) return toast("請先選擇 CSV 檔");
  const mode = $("csvImportMode").value;
  if (mode === "replace" && !confirm("這會刪除目前所有交易，再匯入 CSV。確定繼續？")) return;
  const button = $("importCsv"); setBusy(button, true, "匯入中…");
  try {
    const csv = await file.text();
    const result = await api.importTransactionsCsv(csv, mode);
    $("csvFile").value = ""; $("csvFileName").textContent = "尚未選擇 CSV 檔。";
    await loadDashboard(); toast(result.message || "CSV 匯入完成");
  } catch (error) { toast(error.message); } finally { setBusy(button, false, ""); }
});

$("backupFile").addEventListener("change", () => {
  const file = $("backupFile").files[0];
  $("backupFileName").textContent = file ? `已選擇：${file.name}` : "尚未選擇備份檔。";
});

$("exportBackup").addEventListener("click", async () => {
  const button = $("exportBackup"); setBusy(button, true, "準備中…");
  try {
    const blob = await api.exportBackup();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `BJH_AI_Pro_Backup_${today()}.json`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    toast("完整備份已下載");
  } catch (error) { toast(error.message); } finally { setBusy(button, false, ""); }
});

$("importBackup").addEventListener("click", async () => {
  const file = $("backupFile").files[0];
  if (!file) return toast("請先選擇 JSON 備份檔");
  const mode = $("importMode").value;
  const warning = mode === "replace" ? "這會刪除目前交易、股價、策略與提醒，再以備份取代。確定繼續？" : "這會將備份交易合併到目前資料。確定繼續？";
  if (!confirm(warning)) return;
  const button = $("importBackup"); setBusy(button, true, "還原中…");
  try {
    const text = await file.text();
    const backup = JSON.parse(text);
    const result = await api.importBackup(backup, mode);
    await loadDashboard();
    $("backupFile").value = ""; $("backupFileName").textContent = "尚未選擇備份檔。";
    toast(`還原完成：${result.imported.transactions} 筆交易`);
  } catch (error) { toast(error instanceof SyntaxError ? "JSON 備份檔格式錯誤" : error.message); }
  finally { setBusy(button, false, ""); }
});

function renderQuoteHistory(data) {
  const items = data.history || [];
  $("quoteHistoryPanel").innerHTML = items.length ? items.map((item) => {
    const previous = item.previousPrice == null ? null : Number(item.previousPrice);
    const change = previous == null ? null : Number(item.price) - previous;
    const rate = previous == null || previous === 0 ? null : change / previous;
    const cls = change == null || change === 0 ? "quote-flat" : change > 0 ? "quote-up" : "quote-down";
    const sign = change > 0 ? "+" : "";
    return `<div class="quote-history-item"><strong>${escapeHtml(item.code)}　${number.format(item.price)}</strong><span class="${cls}">${change == null ? "首次紀錄" : `${sign}${number.format(change)} (${sign}${(rate*100).toFixed(2)}%)`}</span><time>${new Date(item.quotedAt).toLocaleString("zh-TW")}</time></div>`;
  }).join("") : '<p class="empty">尚無價格歷史。</p>';
}
async function loadQuoteHistory(code) {
  if (!code) return;
  renderQuoteHistory(await api.quoteHistory(code, 20));
}

$("quoteForm").addEventListener("submit", async (event) => {
  event.preventDefault(); const button = $("saveQuote"); setBusy(button, true, "儲存中…");
  const code = $("quoteCode").value.trim().toUpperCase();
  try { await api.saveQuote(code, Number($("quotePrice").value)); await loadDashboard(); await loadQuoteHistory(code); $("quoteForm").reset(); toast("目前價格已更新"); }
  catch (error) { toast(error.message); } finally { setBusy(button, false, ""); }
});

$("saveBatchQuotes").addEventListener("click", async () => {
  const button = $("saveBatchQuotes");
  try {
    const lines = $("batchQuoteText").value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    const quotes = lines.map((line, index) => {
      const parts = line.split(/[,，\s]+/).filter(Boolean);
      if (parts.length !== 2) throw new Error(`第 ${index+1} 行格式錯誤`);
      return { code: parts[0].toUpperCase(), price: Number(parts[1]) };
    });
    setBusy(button, true, "儲存中…");
    const result = await api.saveQuotesBatch(quotes);
    await loadDashboard();
    if (result.quotes?.[0]) await loadQuoteHistory(result.quotes[0].code);
    toast(`已更新 ${result.count} 筆股價`);
  } catch (error) { toast(error.message); } finally { setBusy(button, false, ""); }
});
$("clearBatchQuotes").addEventListener("click", () => { $("batchQuoteText").value = ""; });

$("transactions").addEventListener("click", async (event) => {
  const editId = event.target.dataset.edit; if (editId) return editTransaction(editId);
  const deleteId = event.target.dataset.delete; if (!deleteId) return;
  if (!confirm("確定刪除這筆交易？系統會重新計算持股。")) return;
  try { await api.deleteTransaction(deleteId); await loadDashboard(); toast("交易已刪除"); } catch (error) { toast(error.message); }
});


$("watchlistForm").addEventListener("submit", async (event) => {
  event.preventDefault(); const id = $("watchlistId").value; const button = $("saveWatchlist"); setBusy(button, true, "儲存中…");
  const payload = { code: $("watchCode").value.trim().toUpperCase(), name: $("watchName").value.trim(), targetBuyPrice: $("watchBuyPrice").value, targetSellPrice: $("watchSellPrice").value, priority: Number($("watchPriority").value), note: $("watchNote").value.trim() };
  try { if (id) await api.updateWatchlistItem(id, payload); else await api.createWatchlistItem(payload); resetWatchlistForm(); await loadDashboard(); toast(id ? "觀察項目已修改" : "已加入觀察清單"); }
  catch (error) { toast(error.message); } finally { setBusy(button, false, ""); }
});
$("cancelWatchEdit").addEventListener("click", resetWatchlistForm);
$("watchCards").addEventListener("click", async (event) => {
  const editId = event.target.dataset.watchEdit; if (editId) return editWatchlistItem(editId);
  const deleteId = event.target.dataset.watchDelete; if (!deleteId || !confirm("確定從觀察清單刪除？")) return;
  try { await api.deleteWatchlistItem(deleteId); await loadDashboard(); toast("已從觀察清單刪除"); } catch (error) { toast(error.message); }
});


$("allocationForm").addEventListener("submit", async (event) => {
  event.preventDefault(); const button = $("saveAllocation"); setBusy(button, true, "儲存中…");
  const code = $("allocationCode").value.trim().toUpperCase();
  const payload = { category: $("allocationCategory").value.trim(), targetRate: Number($("allocationTargetRate").value) / 100 };
  try { await api.saveAllocationTarget(code, payload); resetAllocationForm(); await loadDashboard(); toast("配置目標已儲存"); }
  catch (error) { toast(error.message); } finally { setBusy(button, false, ""); }
});
$("cancelAllocationEdit").addEventListener("click", resetAllocationForm);
$("allocationCards").addEventListener("click", async (event) => {
  const editCode = event.target.dataset.allocationEdit; if (editCode) return editAllocation(editCode);
  const deleteCode = event.target.dataset.allocationDelete; if (!deleteCode || !confirm("確定刪除這個配置目標？")) return;
  try { await api.deleteAllocationTarget(deleteCode); resetAllocationForm(); await loadDashboard(); toast("配置目標已刪除"); } catch (error) { toast(error.message); }
});

$("journalForm").addEventListener("submit", async (event) => {
  event.preventDefault(); const button = $("saveJournal"); setBusy(button, true, "儲存中…");
  const payload = { entryDate: $("journalDate").value, code: $("journalCode").value.trim().toUpperCase(), title: $("journalTitle").value.trim(), decision: $("journalDecision").value, confidence: Number($("journalConfidence").value), plan: $("journalPlan").value.trim(), result: $("journalResult").value.trim(), lesson: $("journalLesson").value.trim() };
  try { const id = $("journalId").value; if (id) await api.updateJournalEntry(id, payload); else await api.createJournalEntry(payload); resetJournalForm(); await loadDashboard(); toast(id ? "投資日誌已修改" : "投資日誌已新增"); }
  catch (error) { toast(error.message); } finally { setBusy(button, false, ""); }
});
$("cancelJournalEdit").addEventListener("click", resetJournalForm);
$("journalCards").addEventListener("click", async (event) => {
  const editId = event.target.dataset.journalEdit; if (editId) return editJournalEntry(editId);
  const deleteId = event.target.dataset.journalDelete; if (!deleteId || !confirm("確定刪除這篇投資日誌？")) return;
  try { await api.deleteJournalEntry(deleteId); await loadDashboard(); toast("投資日誌已刪除"); } catch (error) { toast(error.message); }
});

$("dividendForm").addEventListener("submit", async (event) => {
  event.preventDefault(); const button=$("saveDividend"); setBusy(button,true,"儲存中…");
  const payload={ code:$("dividendCode").value.trim().toUpperCase(), name:$("dividendName").value.trim(), exDate:$("dividendExDate").value, payDate:$("dividendPayDate").value, shares:Number($("dividendShares").value), dividendPerShare:Number($("dividendPerShare").value), tax:Number($("dividendTax").value||0), fee:Number($("dividendFee").value||0), note:$("dividendNote").value.trim() };
  try { const id=$("dividendId").value; if(id) await api.updateDividend(id,payload); else await api.createDividend(payload); resetDividendForm(); await loadDashboard(); toast(id?"股利紀錄已修改":"股利紀錄已新增"); } catch(e){toast(e.message)} finally{setBusy(button,false,"")}
});
$("cancelDividendEdit").addEventListener("click", resetDividendForm);
$("dividendCards").addEventListener("click", async (event) => {
  const editId=event.target.dataset.dividendEdit; if(editId) return editDividend(editId);
  const deleteId=event.target.dataset.dividendDelete; if(!deleteId || !confirm("確定刪除這筆股利紀錄？")) return;
  try { await api.deleteDividend(deleteId); await loadDashboard(); toast("股利紀錄已刪除"); } catch(e){toast(e.message)}
});


$("cashForm").addEventListener("submit", async (event) => {
  event.preventDefault(); const button=$("saveCash"); setBusy(button,true,"儲存中…");
  const payload={ entryDate:$("cashDate").value, type:$("cashType").value, amount:Number($("cashAmount").value), note:$("cashNote").value.trim() };
  try { const id=$("cashId").value; if(id) await api.updateCashEntry(id,payload); else await api.createCashEntry(payload); resetCashForm(); await loadDashboard(); toast(id?"現金紀錄已修改":"現金紀錄已新增"); } catch(e){toast(e.message)} finally{setBusy(button,false,"")}
});
$("cancelCashEdit").addEventListener("click", resetCashForm);
$("cashCards").addEventListener("click", async (event) => {
  const editId=event.target.dataset.cashEdit; if(editId) return editCash(editId);
  const deleteId=event.target.dataset.cashDelete; if(!deleteId || !confirm("確定刪除這筆現金紀錄？")) return;
  try { await api.deleteCashEntry(deleteId); await loadDashboard(); toast("現金紀錄已刪除"); } catch(e){toast(e.message)}
});


async function loadSessions() {
  try {
    const data = await api.sessions();
    state.sessions = data.items || [];
    $("profileName").value = state.user?.name || "";
    $("sessionCards").innerHTML = state.sessions.length ? state.sessions.map((x) => `
      <article class="session-item ${x.active ? "session-active" : "session-revoked"}">
        <div><strong>${escapeHtml(x.userAgent)}</strong><p>${escapeHtml(x.ipAddress)}・${new Date(x.createdAt).toLocaleString("zh-TW")}</p><small>${x.active ? "有效登入" : "已失效或已登出"}</small></div>
        ${x.active ? `<button class="delete" data-session-revoke="${x.id}">登出此裝置</button>` : ""}
      </article>`).join("") : '<p class="empty">尚無登入裝置紀錄</p>';
  } catch (error) { $("sessionCards").innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`; }
}


$("refreshOnboarding")?.addEventListener("click", async () => {
  const button = $("refreshOnboarding");
  try {
    setBusy(button, true, "檢查中");
    await loadOnboarding();
    toast("快速啟動進度已更新");
  } catch (error) {
    toast(error.message);
  } finally {
    setBusy(button, false, "重新檢查");
  }
});

$("dismissOnboarding")?.addEventListener("click", async () => {
  try {
    renderOnboarding(await api.setOnboardingDismissed(true));
    toast("快速啟動精靈已暫時隱藏");
  } catch (error) {
    toast(error.message);
  }
});

$("onboardingSteps")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-onboarding-target]");
  if (!button) return;
  activateFeatureFilter(button.dataset.onboardingTarget);
});


$("refreshFreshness")?.addEventListener("click", async () => {
  const button = $("refreshFreshness");
  try {
    setBusy(button, true, "檢查中");
    await loadFreshness();
    toast("資料新鮮度已更新");
  } catch (error) {
    toast(error.message);
  } finally {
    setBusy(button, false, "重新檢查");
  }
});

$("freshnessPreferenceForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter;
  try {
    setBusy(button, true, "儲存中");
    renderFreshness(await api.saveFreshnessPreference({
      quoteStaleHours: Number($("quoteStaleHours").value),
      snapshotStaleHours: Number($("snapshotStaleHours").value)
    }));
    toast("資料新鮮度設定已儲存");
  } catch (error) {
    toast(error.message);
  } finally {
    setBusy(button, false, "儲存設定");
  }
});

$("freshnessItems")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-freshness-target]");
  if (!button) return;
  activateFeatureFilter(button.dataset.freshnessTarget);
});

async function boot() {
  resetTransactionForm();
  resetWatchlistForm();
  resetJournalForm();
  resetAllocationForm();
  resetDividendForm();
  resetCashForm();
  resetReviewTaskForm();
  resetGoalForm();
  const session = await refreshSession();
  if (!session) return showAuth();
  try { showApp(session.user); await Promise.all([loadDashboard(), loadFeaturePreferences(), loadDisplayPreference(), loadOnboarding(), loadFreshness()]); } catch { showAuth(); }
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
}
boot();

$("refreshDailyBrief")?.addEventListener("click", async () => {
  try {
    const button = $("refreshDailyBrief"); setBusy(button, true, "整理中");
    renderDailyBrief(await api.dailyBrief()); toast("今日行動清單已更新");
    setBusy(button, false, "重新整理");
  } catch (error) { toast(error.message); setBusy($("refreshDailyBrief"), false, "重新整理"); }
});

$("syncNotifications")?.addEventListener("click", async () => {
  const button=$("syncNotifications");
  try { setBusy(button,true,"同步中"); renderNotifications(await api.syncNotifications()); toast("今日通知已同步"); }
  catch(error){ toast(error.message); } finally { setBusy(button,false,"同步今日通知"); }
});
$("readAllNotifications")?.addEventListener("click", async () => {
  try { await api.markAllNotificationsRead(); renderNotifications(await api.notifications()); toast("通知已全部標為已讀"); }
  catch(error){ toast(error.message); }
});
$("notificationCards")?.addEventListener("click", async (event) => {
  const readButton=event.target.closest("[data-notification-read]");
  const dismissButton=event.target.closest("[data-notification-dismiss]");
  try {
    if(readButton){ await api.markNotificationRead(readButton.dataset.notificationRead, readButton.dataset.read === "true"); renderNotifications(await api.notifications()); }
    if(dismissButton){ await api.dismissNotification(dismissButton.dataset.notificationDismiss); renderNotifications(await api.notifications()); toast("通知已移除"); }
  } catch(error){ toast(error.message); }
});


$("profileForm")?.addEventListener("submit", async (event) => {
  event.preventDefault(); const button=$("saveProfile");
  try { setBusy(button,true,"儲存中"); const data=await api.updateProfile({name:$("profileName").value.trim()}); state.user=data.user; $("welcomeText").textContent=`${data.user.name}，投資首頁`; toast("姓名已更新"); }
  catch(error){ toast(error.message); } finally { setBusy(button,false,"儲存姓名"); }
});
$("passwordForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if($("newPassword").value !== $("confirmPassword").value) return toast("兩次輸入的新密碼不一致");
  const button=$("savePassword");
  try { setBusy(button,true,"更新中"); await api.changePassword({currentPassword:$("currentPassword").value,newPassword:$("newPassword").value}); toast("密碼已更新，請重新登入"); setTimeout(showAuth,600); }
  catch(error){ toast(error.message); } finally { setBusy(button,false,"更新密碼並重新登入"); }
});
$("refreshSessions")?.addEventListener("click",loadSessions);
$("revokeOtherSessions")?.addEventListener("click",async()=>{ try{ await api.revokeOtherSessions(); await loadSessions(); toast("其他裝置已全部登出"); }catch(error){toast(error.message)} });
$("sessionCards")?.addEventListener("click",async(event)=>{ const id=event.target.dataset.sessionRevoke; if(!id||!confirm("確定登出這個裝置？")) return; try{await api.revokeSession(id);await loadSessions();toast("裝置已登出")}catch(error){toast(error.message)} });

$("refreshIntegrity")?.addEventListener("click", async () => { try { const b=$("refreshIntegrity"); setBusy(b,true,"檢查中"); renderIntegrity(await api.integrity()); toast("資料完整性檢查完成"); setBusy(b,false,"重新檢查"); } catch(error){ toast(error.message); setBusy($("refreshIntegrity"),false,"重新檢查"); } });
$("runMaintenance")?.addEventListener("click", async () => { if(!confirm("確定執行安全清理？不會刪除交易或持股資料。")) return; const b=$("runMaintenance"); try { setBusy(b,true,"清理中"); const data=await api.runMaintenance(); renderIntegrity(data.report); toast(`已清理 ${data.maintenance.removedSessions} 筆憑證、${data.maintenance.removedNotifications} 筆通知`); } catch(error){ toast(error.message); } finally { setBusy(b,false,"安全清理"); } });


$("refreshAudit")?.addEventListener("click", async () => {
  const button=$("refreshAudit");
  try { setBusy(button,true,"載入中"); renderAuditLogs(await api.auditLogs($("auditDays").value,100)); toast("稽核紀錄已更新"); }
  catch(error){ toast(error.message); } finally { setBusy(button,false,"重新整理"); }
});
$("auditDays")?.addEventListener("change", async () => {
  try { renderAuditLogs(await api.auditLogs($("auditDays").value,100)); } catch(error){ toast(error.message); }
});
$("cleanupAudit")?.addEventListener("click", async () => {
  if(!confirm("確定清理 180 天以前的操作紀錄？投資資料不會受到影響。")) return;
  const button=$("cleanupAudit");
  try { setBusy(button,true,"清理中"); const data=await api.cleanupAuditLogs(180); renderAuditLogs(await api.auditLogs($("auditDays").value,100)); toast(`已清理 ${data.cleanup.removed} 筆舊紀錄`); }
  catch(error){ toast(error.message); } finally { setBusy(button,false,"清理舊紀錄"); }
});


const searchTypeLabels = { transaction:"交易", watchlist:"觀察清單", journal:"投資日誌", dividend:"股利", cash:"現金" };
function renderSearchResults(data) {
  $("searchSummary").innerHTML = `<span>關鍵字：${escapeHtml(data.keyword)}</span><span>找到 ${data.total} 筆</span>`;
  $("searchResults").innerHTML = data.items.length ? data.items.map((item) => `
    <article class="search-result-item">
      <div class="search-result-head"><span class="status-badge">${searchTypeLabels[item.type] || escapeHtml(item.type)}</span><time>${escapeHtml(item.eventDate || "")}</time></div>
      <h3>${item.code ? `${escapeHtml(item.code)} ` : ""}${escapeHtml(item.name || item.title)}</h3>
      <strong>${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(item.detail || "無補充內容")}</p>
    </article>`).join("") : '<p class="empty">找不到符合資料。</p>';
}
$("searchForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const keyword=$("searchKeyword").value.trim();
  if(keyword.length < 2) return toast("請輸入至少 2 個字元");
  const button=$("runSearch");
  try { setBusy(button,true,"搜尋中"); renderSearchResults(await api.search(keyword,$("searchType").value,50)); }
  catch(error){ toast(error.message); }
  finally { setBusy(button,false,"搜尋"); }
});

$("refreshOpportunities")?.addEventListener("click", async () => {
  const button=$("refreshOpportunities");
  try { setBusy(button,true,"排序中"); renderOpportunities(await api.opportunities()); toast("Alpha Finder 已重新排序"); }
  catch(error){ toast(error.message); } finally { setBusy(button,false,"重新排序"); }
});


$("tradePlanForm")?.addEventListener("submit",async(event)=>{event.preventDefault();const id=$("tradePlanId").value;const button=$("saveTradePlan");const payload={plannedDate:$("tradePlanDate").value,code:$("tradePlanCode").value.trim(),name:$("tradePlanName").value.trim(),action:$("tradePlanAction").value,plannedPrice:$("tradePlanPrice").value,shares:$("tradePlanShares").value,stopLossPrice:$("tradePlanStop").value||null,targetPrice:$("tradePlanTarget").value||null,status:$("tradePlanStatus").value,note:$("tradePlanNote").value.trim()};try{setBusy(button,true,"儲存中");if(id)await api.updateTradePlan(id,payload);else await api.createTradePlan(payload);renderTradePlans(await api.tradePlans());resetTradePlanForm();toast(id?"交易計畫已更新":"交易計畫已建立")}catch(error){toast(error.message)}finally{setBusy(button,false,id?"儲存修改":"儲存交易計畫")}});
$("cancelTradePlanEdit")?.addEventListener("click",resetTradePlanForm);
$("tradePlanCards")?.addEventListener("click",async(event)=>{const edit=event.target.closest("[data-trade-plan-edit]");const del=event.target.closest("[data-trade-plan-delete]");if(edit)return editTradePlan(edit.dataset.tradePlanEdit);if(del&&confirm("確定刪除這筆交易計畫？")){try{await api.deleteTradePlan(del.dataset.tradePlanDelete);renderTradePlans(await api.tradePlans());toast("交易計畫已刪除")}catch(error){toast(error.message)}}});


$("reviewTaskForm")?.addEventListener("submit",async(event)=>{event.preventDefault();const id=$("reviewTaskId").value;const button=$("saveReviewTask");const payload={title:$("reviewTaskTitle").value.trim(),code:$("reviewTaskCode").value.trim(),category:$("reviewTaskCategory").value,dueDate:$("reviewTaskDueDate").value,priority:Number($("reviewTaskPriority").value),repeatRule:$("reviewTaskRepeat").value,status:$("reviewTaskStatus").value,note:$("reviewTaskNote").value.trim()};try{setBusy(button,true,"儲存中");if(id)await api.updateReviewTask(id,payload);else await api.createReviewTask(payload);renderReviewTasks(await api.reviewTasks());resetReviewTaskForm();toast(id?"檢查任務已更新":"檢查任務已建立")}catch(error){toast(error.message)}finally{setBusy(button,false,id?"儲存修改":"儲存任務")}});
$("cancelReviewTaskEdit")?.addEventListener("click",resetReviewTaskForm);
$("reviewTaskCards")?.addEventListener("click",async(event)=>{const edit=event.target.closest("[data-review-task-edit]");const del=event.target.closest("[data-review-task-delete]");if(edit)return editReviewTask(edit.dataset.reviewTaskEdit);if(del&&confirm("確定刪除這筆檢查任務？")){try{await api.deleteReviewTask(del.dataset.reviewTaskDelete);renderReviewTasks(await api.reviewTasks());toast("檢查任務已刪除")}catch(error){toast(error.message)}}});


$("dailyRoutineGroups")?.addEventListener("change",async(event)=>{const box=event.target.closest("[data-routine-key]");if(!box)return;try{renderDailyRoutine(await api.updateRoutineCheck({date:state.dailyRoutine?.date||today(),period:box.dataset.routinePeriod,itemKey:box.dataset.routineKey,completed:box.checked}));toast(box.checked?"檢查項目已完成":"已改回未完成")}catch(error){box.checked=!box.checked;toast(error.message)}});
$("resetDailyRoutine")?.addEventListener("click",async()=>{if(!confirm("確定重設今天全部檢查項目？"))return;try{renderDailyRoutine(await api.resetDailyRoutine(state.dailyRoutine?.date||today()));toast("今日檢查已重設")}catch(error){toast(error.message)}});

$("routineHistoryDays")?.addEventListener("change",async()=>{try{renderRoutineHistory(await api.dailyRoutineHistory($("routineHistoryDays").value))}catch(error){toast(error.message)}});


$("goalForm")?.addEventListener("submit",async(event)=>{event.preventDefault();const id=$("goalId").value;const button=$("saveGoal");const payload={title:$("goalTitle").value.trim(),goalType:$("goalType").value,targetAmount:Number($("goalAmount").value),targetDate:$("goalDate").value,status:$("goalStatus").value,note:$("goalNote").value.trim()};try{setBusy(button,true,"儲存中");if(id)await api.updateGoal(id,payload);else await api.createGoal(payload);renderGoals(await api.goals());resetGoalForm();toast(id?"投資目標已更新":"投資目標已建立")}catch(error){toast(error.message)}finally{setBusy(button,false,id?"儲存修改":"儲存目標")}});
$("cancelGoalEdit")?.addEventListener("click",resetGoalForm);
$("goalCards")?.addEventListener("click",async(event)=>{const edit=event.target.closest("[data-goal-edit]");const del=event.target.closest("[data-goal-delete]");if(edit)return editGoal(edit.dataset.goalEdit);if(del&&confirm("確定刪除這個投資目標？")){try{await api.deleteGoal(del.dataset.goalDelete);renderGoals(await api.goals());toast("投資目標已刪除")}catch(error){toast(error.message)}}});

$("refreshWeeklyReview")?.addEventListener("click",async()=>{const button=$("refreshWeeklyReview");try{setBusy(button,true,"整理中");renderWeeklyReview(await api.weeklyReview());toast("每週檢討報告已更新");}catch(error){toast(error.message);}finally{setBusy(button,false,"重新整理");}});
\n\n
// Sprint 33-35: 個人化功能偏好
function makeFeatureKey(title, index) {
  const ascii = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return ascii || `feature-${index + 1}`;
}
async function loadFeaturePreferences() {
  const data = await api.featurePreferences();
  state.featurePreferences = new Map((data.items || []).map((item) => [item.featureKey, item]));
  applyFeatureFilter();
}
function installFeatureControls(panel) {
  if (panel.querySelector(".feature-panel-actions")) return;
  const actions = document.createElement("div");
  actions.className = "feature-panel-actions";
  const favorite = document.createElement("button");
  favorite.type = "button";
  favorite.className = "feature-favorite-button";
  favorite.dataset.favoriteKey = panel.dataset.featureKey;
  favorite.textContent = "☆";
  const hide = document.createElement("button");
  hide.type = "button";
  hide.className = "feature-hide-button";
  hide.dataset.hideKey = panel.dataset.featureKey;
  hide.textContent = "◉";
  hide.setAttribute("aria-label", "隱藏功能");
  const up = document.createElement("button");
  up.type = "button"; up.className = "feature-move-button"; up.dataset.moveKey = panel.dataset.featureKey; up.dataset.direction = "up"; up.textContent = "↑"; up.setAttribute("aria-label", "功能上移");
  const down = document.createElement("button");
  down.type = "button"; down.className = "feature-move-button"; down.dataset.moveKey = panel.dataset.featureKey; down.dataset.direction = "down"; down.textContent = "↓"; down.setAttribute("aria-label", "功能下移");
  actions.append(favorite, hide, up, down);
  panel.appendChild(actions);
}
document.querySelector("#appView")?.addEventListener("click", async (event) => {
  const favoriteButton = event.target.closest("[data-favorite-key]");
  const hideButton = event.target.closest("[data-hide-key]");
  const moveButton = event.target.closest("[data-move-key]");
  const panel = event.target.closest("#appView > .panel");
  try {
    if (moveButton) {
      event.stopPropagation();
      const key = moveButton.dataset.moveKey;
      const direction = moveButton.dataset.direction;
      const visiblePanels = [...document.querySelectorAll("#appView > .panel")].filter((item) => !item.classList.contains("feature-hidden"));
      const index = visiblePanels.findIndex((item) => item.dataset.featureKey === key);
      const target = direction === "up" ? index - 1 : index + 1;
      if (index < 0 || target < 0 || target >= visiblePanels.length) return;
      const moved = visiblePanels[index];
      const other = visiblePanels[target];
      if (direction === "up") other.before(moved); else other.after(moved);
      const orderedKeys = [...document.querySelectorAll("#appView > .panel")].map((item) => item.dataset.featureKey);
      await api.saveFeatureOrder(orderedKeys);
      orderedKeys.forEach((orderedKey, sortOrder) => {
        const current = state.featurePreferences.get(orderedKey) || { featureKey: orderedKey };
        state.featurePreferences.set(orderedKey, { ...current, sortOrder });
      });
      applyFeatureFilter();
      return toast(direction === "up" ? "功能已上移" : "功能已下移");
    }
    if (favoriteButton) {
      event.stopPropagation();
      const key = favoriteButton.dataset.favoriteKey;
      const current = Boolean(state.featurePreferences.get(key)?.isFavorite);
      const data = await api.setFeatureFavorite(key, !current);
      state.featurePreferences.set(key, data.item);
      applyFeatureFilter();
      return toast(current ? "已移出常用功能" : "已加入常用功能");
    }
    if (hideButton) {
      event.stopPropagation();
      const key = hideButton.dataset.hideKey;
      const current = Boolean(state.featurePreferences.get(key)?.isHidden);
      const data = await api.setFeatureHidden(key, !current);
      state.featurePreferences.set(key, data.item);
      applyFeatureFilter();
      return toast(current ? "功能已恢復顯示" : "功能已隱藏");
    }
    if (panel?.dataset.featureKey && !event.target.closest("button,input,select,textarea,a,label")) {
      const data = await api.recordFeatureOpen(panel.dataset.featureKey);
      state.featurePreferences.set(panel.dataset.featureKey, data.item);
    }
  } catch (error) { toast(error.message); }
});

// Sprint 32: 首頁快速導覽與功能搜尋\nconst featureCategoryRules = [\n  ["today", ["CEO Daily Brief", "站內通知", "每日盤前", "每週投資檢討", "資產健康"]],\n  ["trade", ["新增交易", "更新目前股價", "交易 CSV", "目前持股", "交易紀錄", "現金與資金流", "股利收入"]],\n  ["research", ["價格提醒", "股票觀察", "AI", "Alpha Finder", "全系統資料搜尋", "投資決策日誌"]],\n  ["plan", ["交易計畫", "資產配置", "投資檢查任務", "投資目標"]],\n  ["report", ["投資績效", "每日資產", "執行紀律", "每週投資檢討"]],\n  ["system", ["資料備份", "帳號與裝置", "資料完整性", "操作稽核"]]\n];\nlet activeFeatureFilter = "all";\n\nfunction featureText(panel) {\n  return (panel.querySelector("h2")?.textContent || panel.textContent || "").trim();\n}\nfunction assignFeatureCategories() {\n  document.querySelectorAll("#appView > .panel").forEach((panel, index) => {\n    const text = featureText(panel);\n    const categories = featureCategoryRules.filter(([, words]) => words.some((word) => text.includes(word))).map(([category]) => category);\n    panel.dataset.featureCategories = categories.length ? categories.join(" ") : "system";\n    panel.dataset.featureIndex = String(index);\n    panel.dataset.featureTitle = text.toLowerCase();\n    panel.dataset.featureKey = panel.dataset.featureKey || makeFeatureKey(text, index);\n    installFeatureControls(panel);\n  });\n}\nfunction applyFeatureFilter() {
  const keyword = ($("featureSearch")?.value || "").trim().toLowerCase();
  const panels = [...document.querySelectorAll("#appView > .panel")];
  const originalOrder = [...panels].sort((a,b) => {
    const aOrder = Number(state.featurePreferences.get(a.dataset.featureKey)?.sortOrder);
    const bOrder = Number(state.featurePreferences.get(b.dataset.featureKey)?.sortOrder);
    const aHas = Number.isFinite(aOrder);
    const bHas = Number.isFinite(bOrder);
    if (aHas && bHas) return aOrder - bOrder;
    if (aHas) return -1;
    if (bHas) return 1;
    return Number(a.dataset.featureIndex) - Number(b.dataset.featureIndex);
  });

  if (activeFeatureFilter === "recent") {
    panels.sort((a,b) => {
      const aTime = Date.parse(state.featurePreferences.get(a.dataset.featureKey)?.lastOpenedAt || 0) || 0;
      const bTime = Date.parse(state.featurePreferences.get(b.dataset.featureKey)?.lastOpenedAt || 0) || 0;
      return bTime - aTime || Number(a.dataset.featureIndex) - Number(b.dataset.featureIndex);
    });
  } else if (activeFeatureFilter === "popular") {
    panels.sort((a,b) => {
      const aCount = Number(state.featurePreferences.get(a.dataset.featureKey)?.openCount || 0);
      const bCount = Number(state.featurePreferences.get(b.dataset.featureKey)?.openCount || 0);
      return bCount - aCount || Number(a.dataset.featureIndex) - Number(b.dataset.featureIndex);
    });
  } else {
    panels.splice(0, panels.length, ...originalOrder);
  }
  panels.forEach((panel) => $("appView").appendChild(panel));

  let visible = 0;
  panels.forEach((panel) => {
    const pref = state.featurePreferences.get(panel.dataset.featureKey);
    const hasUsage = Number(pref?.openCount || 0) > 0;
    const categoryMatch = activeFeatureFilter === "all"
      || (activeFeatureFilter === "favorites" && Boolean(pref?.isFavorite))
      || (activeFeatureFilter === "recent" && hasUsage)
      || (activeFeatureFilter === "popular" && hasUsage)
      || (activeFeatureFilter === "hidden" && Boolean(pref?.isHidden))
      || panel.dataset.featureCategories.split(" ").includes(activeFeatureFilter);
    const hiddenByPreference = Boolean(pref?.isHidden) && activeFeatureFilter !== "hidden";
    const keywordMatch = !keyword || panel.textContent.toLowerCase().includes(keyword);
    const show = categoryMatch && keywordMatch && !hiddenByPreference;
    panel.classList.toggle("feature-hidden", !show);
    panel.classList.toggle("feature-is-hidden", Boolean(pref?.isHidden));
    if (show) visible += 1;
  });
  $("featureResultCount").textContent = `顯示 ${visible} 個功能`;
  document.querySelectorAll(".feature-favorite-button").forEach((button)=>{ const favorite=Boolean(state.featurePreferences.get(button.dataset.favoriteKey)?.isFavorite); button.textContent=favorite?"★":"☆"; button.classList.toggle("active",favorite); button.setAttribute("aria-label",favorite?"移出常用功能":"加入常用功能"); });
  document.querySelectorAll(".feature-hide-button").forEach((button)=>{ const hidden=Boolean(state.featurePreferences.get(button.dataset.hideKey)?.isHidden); button.textContent=hidden?"◌":"◉"; button.classList.toggle("active",hidden); button.setAttribute("aria-label",hidden?"恢復顯示功能":"隱藏功能"); });
  document.querySelectorAll(".feature-move-button").forEach((button)=>{ button.hidden = activeFeatureFilter !== "all" || Boolean(state.featurePreferences.get(button.dataset.moveKey)?.isHidden); });
  let empty = $("featureEmptyState");
  if (!visible) {
    if (!empty) {
      empty = document.createElement("div");
      empty.id = "featureEmptyState";
      empty.className = "feature-empty";
      empty.textContent = activeFeatureFilter === "recent" || activeFeatureFilter === "popular" ? "尚無功能使用紀錄，開啟功能後就會自動建立排序。" : activeFeatureFilter === "hidden" ? "目前沒有隱藏的功能。" : "找不到符合的功能，請更換分類或搜尋文字。";
      $("featureSearch").closest(".feature-tools").after(empty);
    }
    empty.hidden = false;
  } else if (empty) empty.hidden = true;
}
function activateFeatureFilter(filter) {\n  activeFeatureFilter = filter;\n  document.querySelectorAll("[data-feature-filter]").forEach((button) => button.classList.toggle("active", button.dataset.featureFilter === filter));\n  applyFeatureFilter();\n  window.scrollTo({ top: $("appView").offsetTop, behavior: "smooth" });\n}\nassignFeatureCategories();\ndocument.querySelector(".feature-nav")?.addEventListener("click", (event) => {\n  const button = event.target.closest("[data-feature-filter]");\n  if (button) activateFeatureFilter(button.dataset.featureFilter);\n});\n$("featureSearch")?.addEventListener("input", applyFeatureFilter);\n$("clearFeatureSearch")?.addEventListener("click", () => { $("featureSearch").value = ""; applyFeatureFilter(); $("featureSearch").focus(); });
$("resetFeatureUsage")?.addEventListener("click", async () => {
  if (!confirm("確定重設最近使用與使用次數？常用星號不會被清除。")) return;
  const button = $("resetFeatureUsage");
  try {
    setBusy(button, true, "重設中");
    await api.resetFeatureUsage();
    await loadFeaturePreferences();
    activateFeatureFilter("all");
    toast("功能使用紀錄已重設");
  } catch (error) { toast(error.message); }
  finally { setBusy(button, false, "重設使用紀錄"); }
});\n$("restoreHiddenFeatures")?.addEventListener("click", async () => {\n  const button = $("restoreHiddenFeatures");\n  try {\n    setBusy(button, true, "恢復中");\n    const data = await api.restoreHiddenFeatures();\n    await loadFeaturePreferences();\n    activateFeatureFilter("all");\n    toast(`已恢復 ${data.restoredCount || 0} 個功能`);\n  } catch (error) { toast(error.message); }\n  finally { setBusy(button, false, "恢復隱藏功能"); }\n});\napplyFeatureFilter();\n

$("resetFeatureOrder")?.addEventListener("click", async () => {
  if (!confirm("確定恢復系統預設功能順序？")) return;
  const button = $("resetFeatureOrder");
  try {
    setBusy(button, true, "重設中");
    await api.resetFeatureOrder();
    await loadFeaturePreferences();
    activateFeatureFilter("all");
    toast("功能順序已恢復預設");
  } catch (error) { toast(error.message); }
  finally { setBusy(button, false, "重設功能排序"); }
});


// Sprint 37: 個人顯示與無障礙設定
function applyDisplayPreference(preference = {}) {
  const value = {
    fontSize: ["standard", "large", "xlarge"].includes(preference.fontSize) ? preference.fontSize : "standard",
    density: ["comfortable", "compact"].includes(preference.density) ? preference.density : "comfortable",
    startupView: ["all", "today", "favorites", "recent"].includes(preference.startupView) ? preference.startupView : "today",
    highContrast: Boolean(preference.highContrast),
    reduceMotion: Boolean(preference.reduceMotion)
  };
  state.displayPreference = value;
  document.documentElement.classList.toggle("font-large", value.fontSize === "large");
  document.documentElement.classList.toggle("font-xlarge", value.fontSize === "xlarge");
  document.body.classList.toggle("density-compact", value.density === "compact");
  document.body.classList.toggle("high-contrast", value.highContrast);
  document.body.classList.toggle("reduce-motion", value.reduceMotion);
  document.querySelectorAll("[data-font-size]").forEach((button) => button.classList.toggle("active", button.dataset.fontSize === value.fontSize));
  document.querySelectorAll("[data-density]").forEach((button) => button.classList.toggle("active", button.dataset.density === value.density));
  document.querySelectorAll("[data-startup-view]").forEach((button) => button.classList.toggle("active", button.dataset.startupView === value.startupView));
  if ($("highContrastSetting")) $("highContrastSetting").checked = value.highContrast;
  if ($("reduceMotionSetting")) $("reduceMotionSetting").checked = value.reduceMotion;
}
async function loadDisplayPreference() {
  const data = await api.displayPreference();
  applyDisplayPreference(data.preference);
  const startupView = data.preference?.startupView || "today";
  if (document.querySelector(`[data-feature-filter="${startupView}"]`)) activateFeatureFilter(startupView);
}
function readDisplayPreferenceForm() {
  return {
    fontSize: document.querySelector("[data-font-size].active")?.dataset.fontSize || "standard",
    density: document.querySelector("[data-density].active")?.dataset.density || "comfortable",
    startupView: document.querySelector("[data-startup-view].active")?.dataset.startupView || "today",
    highContrast: Boolean($("highContrastSetting")?.checked),
    reduceMotion: Boolean($("reduceMotionSetting")?.checked)
  };
}
$("toggleDisplaySettings")?.addEventListener("click", () => {
  const panel = $("displaySettings");
  const opening = panel.classList.contains("hidden");
  panel.classList.toggle("hidden", !opening);
  $("toggleDisplaySettings").setAttribute("aria-expanded", String(opening));
  if (opening) panel.scrollIntoView({ behavior: state.displayPreference.reduceMotion ? "auto" : "smooth", block: "nearest" });
});
$("displaySettings")?.addEventListener("click", (event) => {
  const fontButton = event.target.closest("[data-font-size]");
  const densityButton = event.target.closest("[data-density]");
  const startupButton = event.target.closest("[data-startup-view]");
  if (fontButton) {
    document.querySelectorAll("[data-font-size]").forEach((button) => button.classList.toggle("active", button === fontButton));
    applyDisplayPreference(readDisplayPreferenceForm());
  }
  if (densityButton) {
    document.querySelectorAll("[data-density]").forEach((button) => button.classList.toggle("active", button === densityButton));
    applyDisplayPreference(readDisplayPreferenceForm());
  }
  if (startupButton) {
    document.querySelectorAll("[data-startup-view]").forEach((button) => button.classList.toggle("active", button === startupButton));
    applyDisplayPreference(readDisplayPreferenceForm());
    activateFeatureFilter(startupButton.dataset.startupView);
  }
});
$("highContrastSetting")?.addEventListener("change", () => applyDisplayPreference(readDisplayPreferenceForm()));
$("reduceMotionSetting")?.addEventListener("change", () => applyDisplayPreference(readDisplayPreferenceForm()));
$("saveDisplaySettings")?.addEventListener("click", async () => {
  const button = $("saveDisplaySettings");
  try {
    setBusy(button, true, "儲存中");
    const data = await api.saveDisplayPreference(readDisplayPreferenceForm());
    applyDisplayPreference(data.preference);
    toast("顯示設定已同步");
  } catch (error) { toast(error.message); }
  finally { setBusy(button, false, "儲存並同步"); }
});
