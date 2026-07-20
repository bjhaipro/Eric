import { normalizeTransactionInput } from "../utils/transaction-validator.js";
import {
  createTransaction,
  deleteTransaction,
  getPortfolio,
  listTransactions,
  updateTransaction
} from "../services/transaction.service.js";

export async function list(req, res, next) {
  try {
    const transactions = await listTransactions(req.user.id, req.query);
    res.json({ success: true, transactions });
  } catch (error) { next(error); }
}

export async function create(req, res, next) {
  try {
    const transaction = await createTransaction(req.user.id, normalizeTransactionInput(req.body));
    res.status(201).json({ success: true, transaction });
  } catch (error) { next(error); }
}

export async function update(req, res, next) {
  try {
    const transaction = await updateTransaction(req.user.id, req.params.id, normalizeTransactionInput(req.body));
    res.json({ success: true, transaction });
  } catch (error) { next(error); }
}

export async function remove(req, res, next) {
  try {
    await deleteTransaction(req.user.id, req.params.id);
    res.status(204).end();
  } catch (error) { next(error); }
}

export async function portfolio(req, res, next) {
  try {
    const result = await getPortfolio(req.user.id);
    res.json({ success: true, ...result });
  } catch (error) { next(error); }
}
