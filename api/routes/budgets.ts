import { Router, type Request, type Response } from 'express'
import { db } from '../db.js'

const router = Router()

router.get('/:month', (req: Request, res: Response): void => {
  const { month } = req.params

  const budgetStmt = db.prepare('SELECT * FROM budgets WHERE month = ?')
  const budget = budgetStmt.get(month) as {
    id: number
    month: string
    total_budget: number
    category_budgets: string
    created_at: string
    updated_at: string
  } | undefined

  if (!budget) {
    res.json({ success: true, data: null })
    return
  }

  const categoryBudgets = JSON.parse(budget.category_budgets) as Record<string, number>

  const expenseStmt = db.prepare(`
    SELECT category, SUM(amount) as total
    FROM transactions
    WHERE type = 'expense' AND date LIKE ?
      AND NOT EXISTS (SELECT 1 FROM transaction_splits ts WHERE ts.parent_transaction_id = transactions.id)
    GROUP BY category
  `)
  const expenses = expenseStmt.all(`${month}%`) as Array<{ category: string; total: number }>

  const expenseMap: Record<string, number> = {}
  for (const exp of expenses) {
    expenseMap[exp.category] = exp.total
  }

  let totalUsed = 0
  const categoryDetails: Record<string, {
    budget: number
    used: number
    remaining: number
    percentage: number
    status: 'normal' | 'warning' | 'danger'
  }> = {}

  for (const [category, budgetAmount] of Object.entries(categoryBudgets)) {
    const used = expenseMap[category] || 0
    const remaining = budgetAmount - used
    const percentage = budgetAmount > 0 ? (used / budgetAmount) * 100 : 0
    totalUsed += used

    let status: 'normal' | 'warning' | 'danger' = 'normal'
    if (percentage > 100) {
      status = 'danger'
    } else if (percentage > 80) {
      status = 'warning'
    }

    categoryDetails[category] = {
      budget: budgetAmount,
      used,
      remaining,
      percentage,
      status
    }
  }

  const totalBudget = budget.total_budget
  const totalRemaining = totalBudget - totalUsed
  const totalPercentage = totalBudget > 0 ? (totalUsed / totalBudget) * 100 : 0

  let totalStatus: 'normal' | 'warning' | 'danger' = 'normal'
  if (totalPercentage > 100) {
    totalStatus = 'danger'
  } else if (totalPercentage > 80) {
    totalStatus = 'warning'
  }

  res.json({
    success: true,
    data: {
      id: budget.id,
      month: budget.month,
      total_budget: totalBudget,
      total_used: totalUsed,
      total_remaining: totalRemaining,
      total_percentage: totalPercentage,
      total_status: totalStatus,
      category_budgets: categoryDetails,
      created_at: budget.created_at,
      updated_at: budget.updated_at
    }
  })
})

router.get('/', (_req: Request, res: Response): void => {
  const stmt = db.prepare('SELECT * FROM budgets ORDER BY month DESC')
  const budgets = stmt.all() as Array<{
    id: number
    month: string
    total_budget: number
    category_budgets: string
    created_at: string
    updated_at: string
  }>

  const result = budgets.map(budget => {
    const categoryBudgets = JSON.parse(budget.category_budgets) as Record<string, number>

    const expenseStmt = db.prepare(`
      SELECT category, SUM(amount) as total
      FROM transactions
      WHERE type = 'expense' AND date LIKE ?
        AND NOT EXISTS (SELECT 1 FROM transaction_splits ts WHERE ts.parent_transaction_id = transactions.id)
      GROUP BY category
    `)
    const expenses = expenseStmt.all(`${budget.month}%`) as Array<{ category: string; total: number }>

    const expenseMap: Record<string, number> = {}
    for (const exp of expenses) {
      expenseMap[exp.category] = exp.total
    }

    let totalUsed = 0
    for (const category of Object.keys(categoryBudgets)) {
      totalUsed += expenseMap[category] || 0
    }

    const totalPercentage = budget.total_budget > 0 ? (totalUsed / budget.total_budget) * 100 : 0

    let totalStatus: 'normal' | 'warning' | 'danger' = 'normal'
    if (totalPercentage > 100) {
      totalStatus = 'danger'
    } else if (totalPercentage > 80) {
      totalStatus = 'warning'
    }

    return {
      id: budget.id,
      month: budget.month,
      total_budget: budget.total_budget,
      total_used: totalUsed,
      total_remaining: budget.total_budget - totalUsed,
      total_percentage: totalPercentage,
      total_status: totalStatus,
      category_budgets: categoryBudgets,
      created_at: budget.created_at,
      updated_at: budget.updated_at
    }
  })

  res.json({ success: true, data: result })
})

router.post('/', (req: Request, res: Response): void => {
  const { month, total_budget, category_budgets } = req.body as {
    month: string
    total_budget: number
    category_budgets: Record<string, number>
  }

  const categoryBudgetsStr = JSON.stringify(category_budgets)

  const stmt = db.prepare(`
    INSERT INTO budgets (month, total_budget, category_budgets, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(month) DO UPDATE SET
      total_budget = excluded.total_budget,
      category_budgets = excluded.category_budgets,
      updated_at = CURRENT_TIMESTAMP
  `)

  stmt.run(month, total_budget, categoryBudgetsStr)

  const selectStmt = db.prepare('SELECT * FROM budgets WHERE month = ?')
  const budget = selectStmt.get(month) as {
    id: number
    month: string
    total_budget: number
    category_budgets: string
    created_at: string
    updated_at: string
  }

  res.json({
    success: true,
    data: {
      id: budget.id,
      month: budget.month,
      total_budget: budget.total_budget,
      category_budgets: JSON.parse(budget.category_budgets),
      created_at: budget.created_at,
      updated_at: budget.updated_at
    }
  })
})

export default router
