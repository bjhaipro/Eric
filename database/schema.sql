CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL DEFAULT '',
  type VARCHAR(4) NOT NULL CHECK (type IN ('BUY', 'SELL')),
  shares BIGINT NOT NULL CHECK (shares > 0),
  price NUMERIC(18,4) NOT NULL CHECK (price > 0),
  fee NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (fee >= 0),
  tax NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (tax >= 0),
  trade_date DATE NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_date
ON transactions(user_id, trade_date DESC, id DESC);

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  market_value NUMERIC(20,4) NOT NULL DEFAULT 0,
  total_cost NUMERIC(20,4) NOT NULL DEFAULT 0,
  unrealized_profit NUMERIC(20,4) NOT NULL DEFAULT 0,
  realized_profit NUMERIC(20,4) NOT NULL DEFAULT 0,
  roi NUMERIC(12,6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, snapshot_date)
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'disabled'));

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  replaced_by UUID,
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user
ON refresh_tokens(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expiry
ON refresh_tokens(expires_at)
WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS market_quotes (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  price NUMERIC(18,4) NOT NULL CHECK (price > 0),
  quoted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, code)
);

CREATE INDEX IF NOT EXISTS idx_market_quotes_user_updated
ON market_quotes(user_id, updated_at DESC);


CREATE TABLE IF NOT EXISTS user_strategies (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  target_profit_rate NUMERIC(8,6) NOT NULL DEFAULT 0.03 CHECK (target_profit_rate BETWEEN 0.005 AND 1),
  stop_loss_rate NUMERIC(8,6) NOT NULL DEFAULT 0.08 CHECK (stop_loss_rate BETWEEN 0.01 AND 1),
  max_position_rate NUMERIC(8,6) NOT NULL DEFAULT 0.35 CHECK (max_position_rate BETWEEN 0.05 AND 1),
  stale_quote_hours INTEGER NOT NULL DEFAULT 24 CHECK (stale_quote_hours BETWEEN 1 AND 720),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS price_alerts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL DEFAULT '',
  direction VARCHAR(5) NOT NULL CHECK (direction IN ('ABOVE', 'BELOW')),
  target_price NUMERIC(18,4) NOT NULL CHECK (target_price > 0),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  triggered_at TIMESTAMPTZ,
  last_seen_price NUMERIC(18,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_alerts_user_enabled
ON price_alerts(user_id, enabled, code);

ALTER TABLE portfolio_snapshots
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_user_date
ON portfolio_snapshots(user_id, snapshot_date DESC);

CREATE TABLE IF NOT EXISTS watchlist_items (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL DEFAULT '',
  target_buy_price NUMERIC(18,4) CHECK (target_buy_price IS NULL OR target_buy_price > 0),
  target_sell_price NUMERIC(18,4) CHECK (target_sell_price IS NULL OR target_sell_price > 0),
  priority SMALLINT NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, code)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_user_priority
ON watchlist_items(user_id, priority DESC, updated_at DESC);

CREATE TABLE IF NOT EXISTS investment_journal_entries (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  code VARCHAR(20) NOT NULL DEFAULT '',
  title VARCHAR(160) NOT NULL,
  decision VARCHAR(20) NOT NULL DEFAULT 'OBSERVE'
    CHECK (decision IN ('BUY','SELL','HOLD','OBSERVE','REVIEW')),
  confidence SMALLINT NOT NULL DEFAULT 3 CHECK (confidence BETWEEN 1 AND 5),
  plan TEXT NOT NULL DEFAULT '',
  result TEXT NOT NULL DEFAULT '',
  lesson TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investment_journal_user_date
ON investment_journal_entries(user_id, entry_date DESC, id DESC);

CREATE TABLE IF NOT EXISTS allocation_targets (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  category VARCHAR(80) NOT NULL DEFAULT '未分類',
  target_rate NUMERIC(8,6) NOT NULL CHECK (target_rate BETWEEN 0 AND 1),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, code)
);

CREATE INDEX IF NOT EXISTS idx_allocation_targets_user_category
ON allocation_targets(user_id, category, code);

CREATE TABLE IF NOT EXISTS dividend_records (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL DEFAULT '',
  ex_date DATE NOT NULL,
  pay_date DATE,
  shares BIGINT NOT NULL CHECK (shares > 0),
  dividend_per_share NUMERIC(18,6) NOT NULL CHECK (dividend_per_share >= 0),
  tax NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (tax >= 0),
  fee NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (fee >= 0),
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dividend_records_user_date ON dividend_records(user_id, ex_date DESC, id DESC);

CREATE TABLE IF NOT EXISTS cash_ledger_entries (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('DEPOSIT','WITHDRAW','INTEREST','FEE','OTHER_IN','OTHER_OUT')),
  amount NUMERIC(20,4) NOT NULL CHECK (amount > 0),
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cash_ledger_user_date ON cash_ledger_entries(user_id, entry_date DESC, id DESC);


CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  severity VARCHAR(12) NOT NULL CHECK (severity IN ('urgent','important','normal')),
  category VARCHAR(80) NOT NULL DEFAULT '',
  code VARCHAR(20),
  title VARCHAR(200) NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  source VARCHAR(30) NOT NULL DEFAULT 'DAILY_BRIEF',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  UNIQUE(user_id, fingerprint)
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_state
ON notifications(user_id, dismissed_at, read_at, occurred_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(20) NOT NULL,
  method VARCHAR(10) NOT NULL,
  resource VARCHAR(240) NOT NULL,
  status_code INTEGER NOT NULL,
  ip_address INET,
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created
ON audit_logs(user_id, created_at DESC, id DESC);


CREATE TABLE IF NOT EXISTS trade_plans (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL DEFAULT '',
  action VARCHAR(10) NOT NULL CHECK (action IN ('BUY','SELL')),
  status VARCHAR(12) NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED','EXECUTED','CANCELLED')),
  planned_price NUMERIC(18,4) NOT NULL CHECK (planned_price > 0),
  shares BIGINT NOT NULL CHECK (shares > 0),
  stop_loss_price NUMERIC(18,4) CHECK (stop_loss_price IS NULL OR stop_loss_price > 0),
  target_price NUMERIC(18,4) CHECK (target_price IS NULL OR target_price > 0),
  planned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trade_plans_user_status_date ON trade_plans(user_id,status,planned_date DESC,id DESC);

CREATE TABLE IF NOT EXISTS market_quote_history (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  price NUMERIC(18,4) NOT NULL CHECK (price > 0),
  previous_price NUMERIC(18,4),
  quoted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_market_quote_history_user_code_time
ON market_quote_history(user_id, code, quoted_at DESC, id DESC);


CREATE TABLE IF NOT EXISTS review_tasks (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(160) NOT NULL,
  code VARCHAR(20) NOT NULL DEFAULT '',
  category VARCHAR(30) NOT NULL DEFAULT 'REVIEW'
    CHECK (category IN ('REVIEW','PRICE','RISK','RESEARCH','REPORT','OTHER')),
  due_date DATE NOT NULL,
  priority SMALLINT NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  status VARCHAR(12) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','DONE','CANCELLED')),
  repeat_rule VARCHAR(12) NOT NULL DEFAULT 'NONE'
    CHECK (repeat_rule IN ('NONE','DAILY','WEEKLY','MONTHLY','QUARTERLY')),
  note TEXT NOT NULL DEFAULT '',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_review_tasks_user_due
ON review_tasks(user_id, status, due_date, priority DESC);


CREATE TABLE IF NOT EXISTS daily_routine_checks (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  routine_date DATE NOT NULL DEFAULT CURRENT_DATE,
  period VARCHAR(12) NOT NULL CHECK (period IN ('PREMARKET','POSTMARKET')),
  item_key VARCHAR(60) NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id,routine_date,period,item_key)
);
CREATE INDEX IF NOT EXISTS idx_daily_routine_user_date ON daily_routine_checks(user_id,routine_date,period);


CREATE TABLE IF NOT EXISTS investment_goals (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(160) NOT NULL,
  goal_type VARCHAR(20) NOT NULL CHECK (goal_type IN ('NET_WORTH','MARKET_VALUE','CASH','DIVIDEND','REALIZED_PROFIT')),
  target_amount NUMERIC(20,4) NOT NULL CHECK (target_amount > 0),
  target_date DATE NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','COMPLETED','CANCELLED')),
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_investment_goals_user_status_date ON investment_goals(user_id,status,target_date,id DESC);


CREATE TABLE IF NOT EXISTS user_feature_preferences (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature_key VARCHAR(100) NOT NULL,
  is_favorite BOOLEAN NOT NULL DEFAULT TRUE,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  last_opened_at TIMESTAMPTZ,
  open_count INTEGER NOT NULL DEFAULT 0 CHECK (open_count >= 0),
  sort_order INTEGER CHECK (sort_order >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, feature_key)
);
CREATE INDEX IF NOT EXISTS idx_feature_preferences_user_favorite
ON user_feature_preferences(user_id, is_favorite, last_opened_at DESC);


-- Sprint 35 migration for existing databases
ALTER TABLE user_feature_preferences ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_feature_preferences_user_hidden ON user_feature_preferences(user_id, is_hidden, feature_key);

-- Sprint 36 migration for existing databases
ALTER TABLE user_feature_preferences ADD COLUMN IF NOT EXISTS sort_order INTEGER CHECK (sort_order >= 0);
CREATE INDEX IF NOT EXISTS idx_feature_preferences_user_sort ON user_feature_preferences(user_id, sort_order);


-- Sprint 37: 個人顯示與無障礙設定
CREATE TABLE IF NOT EXISTS user_display_preferences (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  font_size VARCHAR(12) NOT NULL DEFAULT 'standard' CHECK (font_size IN ('standard','large','xlarge')),
  density VARCHAR(12) NOT NULL DEFAULT 'comfortable' CHECK (density IN ('comfortable','compact')),
  high_contrast BOOLEAN NOT NULL DEFAULT FALSE,
  reduce_motion BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- Sprint 38: 登入首頁模式
ALTER TABLE user_display_preferences
ADD COLUMN IF NOT EXISTS startup_view VARCHAR(16) NOT NULL DEFAULT 'today'
CHECK (startup_view IN ('all','today','favorites','recent'));


-- Sprint 39: 首次使用快速啟動精靈
CREATE TABLE IF NOT EXISTS user_onboarding_preferences (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  is_dismissed BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- Sprint 40: 資料新鮮度中心
CREATE TABLE IF NOT EXISTS user_freshness_preferences (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  quote_stale_hours INTEGER NOT NULL DEFAULT 24 CHECK (quote_stale_hours BETWEEN 1 AND 720),
  snapshot_stale_hours INTEGER NOT NULL DEFAULT 36 CHECK (snapshot_stale_hours BETWEEN 1 AND 720),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
