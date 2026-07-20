import test from "node:test";
import assert from "node:assert/strict";
import { buildPortfolio } from "../backend/src/services/portfolio-builder.js";
import { normalizeTransactionInput } from "../backend/src/utils/transaction-validator.js";

test("兩次買進後正確計算移動平均成本", () => {
  const result = buildPortfolio([
    { code: "2330", name: "台積電", type: "BUY", shares: 1000, price: 100, fee: 100, tax: 0 },
    { code: "2330", name: "台積電", type: "BUY", shares: 1000, price: 120, fee: 100, tax: 0 }
  ]);
  assert.equal(result.positions[0].shares, 2000);
  assert.equal(result.positions[0].totalCost, 220200);
  assert.equal(result.positions[0].averageCost, 110.1);
});

test("部分賣出後正確計算已實現損益與剩餘成本", () => {
  const result = buildPortfolio([
    { code: "2330", name: "台積電", type: "BUY", shares: 1000, price: 100, fee: 100, tax: 0 },
    { code: "2330", name: "台積電", type: "SELL", shares: 200, price: 120, fee: 20, tax: 72 }
  ]);
  assert.equal(result.positions[0].shares, 800);
  assert.equal(result.positions[0].averageCost, 100.1);
  assert.equal(result.summary.realizedProfit, 3888);
});

test("賣出超過持股時拒絕", () => {
  assert.throws(() => buildPortfolio([
    { code: "2330", type: "BUY", shares: 100, price: 100, fee: 0, tax: 0 },
    { code: "2330", type: "SELL", shares: 101, price: 110, fee: 0, tax: 0 }
  ]), /僅持有/);
});

test("交易輸入驗證接受正常買進資料", () => {
  const value = normalizeTransactionInput({
    code: "2330", name: "台積電", type: "BUY",
    shares: 1000, price: 1125, fee: 1425, tax: 0,
    tradeDate: "2026-07-18", note: "測試"
  });
  assert.equal(value.code, "2330");
  assert.equal(value.type, "BUY");
  assert.equal(value.shares, 1000);
});

test("交易輸入驗證拒絕零股數", () => {
  assert.throws(() => normalizeTransactionInput({
    code: "2330", type: "BUY", shares: 0, price: 100, tradeDate: "2026-07-18"
  }));
});
