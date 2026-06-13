import { Router, type Request, type Response } from 'express'
import { db } from '../db.js'

const router = Router()

interface GoalWithProgress {
  id: number
  name: string
  target_amount: number
  current_amount: number
  deadline: string | null
  description: string | null
  color: string
  icon: string
  auto_track: number
  status: string
  created_at: string
  updated_at: string
  progress_percentage: number
  remaining_amount: number
  monthly_savings_needed: number
  estimated_completion_date: string | null
  milestones: Array<{ percentage: number; label: string; achieved: boolean }>
  transactions?: Array<Record<string, unknown>>
}

router.get('/', (req: Request, res: Response): void => {
  try {
    const { status } = req.query

    let whereClause = ''
    const params: (string | number)[] = []

    if (status) {
      whereClause = 'WHERE status = ?'
      params.push(status as string)
    }

    const goals = db.prepare(`
      SELECT * FROM financial_goals
      ${whereClause}
      ORDER BY created_at DESC
    `).all(...params) as Array<Record<string, unknown>>

    const result = goals.map((goal) => calculateGoalProgress(goal as Record<string, number | string | null>))

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    res.json({
      success: false,
      error: error instanceof Error ? error.message : 'Query failed',
    })
  }
})

router.get('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params

    const goal = db.prepare('SELECT * FROM financial_goals WHERE id = ?').get(Number(id))

    if (!goal) {
      res.json({
        success: false,
        error: 'Goal not found',
      })
      return
    }

    const transactions = db.prepare(`
      SELECT 
        gt.*,
        t.amount as transaction_amount,
        t.category as transaction_category,
        t.remark as transaction_remark,
        t.date as transaction_date,
        t.type as transaction_type
      FROM goal_transactions gt
      LEFT JOIN transactions t ON gt.transaction_id = t.id
      WHERE gt.goal_id = ?
      ORDER BY gt.created_at DESC
    `).all(Number(id))

    const result = calculateGoalProgress(goal as Record<string, number | string | null>)
    ;(result as GoalWithProgress).transactions = transactions as Array<Record<string, unknown>>

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    res.json({
      success: false,
      error: error instanceof Error ? error.message : 'Query failed',
    })
  }
})

router.post('/', (req: Request, res: Response): void => {
  try {
    const { name, target_amount, deadline, description, color, icon, auto_track } = req.body

    if (!name || !target_amount) {
      res.json({
        success: false,
        error: 'Name and target amount are required',
      })
      return
    }

    const result = db.prepare(`
      INSERT INTO financial_goals (name, target_amount, deadline, description, color, icon, auto_track)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      target_amount,
      deadline || null,
      description || null,
      color || '#3b82f6',
      icon || '🎯',
      auto_track ? 1 : 0
    )

    const goalId = result.lastInsertRowid as number
    const goal = db.prepare('SELECT * FROM financial_goals WHERE id = ?').get(goalId)
    const data = calculateGoalProgress(goal as Record<string, number | string | null>)

    res.json({
      success: true,
      data,
    })
  } catch (error) {
    res.json({
      success: false,
      error: error instanceof Error ? error.message : 'Create failed',
    })
  }
})

router.put('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const { name, target_amount, current_amount, deadline, description, color, icon, status, auto_track } = req.body

    const existing = db.prepare('SELECT * FROM financial_goals WHERE id = ?').get(Number(id))
    if (!existing) {
      res.json({
        success: false,
        error: 'Goal not found',
      })
      return
    }

    const updates: string[] = []
    const params: (string | number | null)[] = []

    if (name !== undefined) {
      updates.push('name = ?')
      params.push(name)
    }
    if (target_amount !== undefined) {
      updates.push('target_amount = ?')
      params.push(target_amount)
    }
    if (current_amount !== undefined) {
      updates.push('current_amount = ?')
      params.push(current_amount)
    }
    if (deadline !== undefined) {
      updates.push('deadline = ?')
      params.push(deadline || null)
    }
    if (description !== undefined) {
      updates.push('description = ?')
      params.push(description || null)
    }
    if (color !== undefined) {
      updates.push('color = ?')
      params.push(color)
    }
    if (icon !== undefined) {
      updates.push('icon = ?')
      params.push(icon)
    }
    if (auto_track !== undefined) {
      updates.push('auto_track = ?')
      params.push(auto_track ? 1 : 0)
    }
    if (status !== undefined) {
      const validStatuses = ['active', 'completed', 'paused']
      if (!validStatuses.includes(status as string)) {
        res.json({
          success: false,
          error: 'Invalid status',
        })
        return
      }
      updates.push('status = ?')
      params.push(status)
    }
    updates.push('updated_at = CURRENT_TIMESTAMP')

    if (updates.length > 0) {
      params.push(Number(id))
      db.prepare(`UPDATE financial_goals SET ${updates.join(', ')} WHERE id = ?`).run(...params)
    }

    const goal = db.prepare('SELECT * FROM financial_goals WHERE id = ?').get(Number(id))
    const data = calculateGoalProgress(goal as Record<string, number | string | null>)

    res.json({
      success: true,
      data,
    })
  } catch (error) {
    res.json({
      success: false,
      error: error instanceof Error ? error.message : 'Update failed',
    })
  }
})

router.delete('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params

    const existing = db.prepare('SELECT * FROM financial_goals WHERE id = ?').get(Number(id))
    if (!existing) {
      res.json({
        success: false,
        error: 'Goal not found',
      })
      return
    }

    db.prepare('DELETE FROM financial_goals WHERE id = ?').run(Number(id))

    res.json({
      success: true,
      data: { id: Number(id) },
    })
  } catch (error) {
    res.json({
      success: false,
      error: error instanceof Error ? error.message : 'Delete failed',
    })
  }
})

router.post('/:id/deposit', (req: Request, res: Response): void => {
  const tx = db.transaction(() => {
    try {
      const { id } = req.params
      const { amount, remark, transaction_id } = req.body as { amount: number; remark?: string; transaction_id?: number }

      if (!amount || amount <= 0) {
        res.json({
          success: false,
          error: 'Valid amount is required',
        })
        return
      }

      const existing = db.prepare('SELECT * FROM financial_goals WHERE id = ?').get(Number(id))
      if (!existing) {
        res.json({
          success: false,
          error: 'Goal not found',
        })
        return
      }

      const goal = existing as { current_amount: number; target_amount: number; status: string }
      const newCurrent = Math.min(goal.current_amount + amount, goal.target_amount)

      db.prepare(`
        UPDATE financial_goals 
        SET current_amount = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newCurrent, Number(id))

      db.prepare(`
        INSERT INTO goal_transactions (goal_id, transaction_id, amount, type, remark)
        VALUES (?, ?, ?, 'deposit', ?)
      `).run(Number(id), transaction_id || null, amount, remark || null)

      if (newCurrent >= goal.target_amount && goal.status !== 'completed') {
        db.prepare(`
          UPDATE financial_goals SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(Number(id))
      }

      const updatedGoal = db.prepare('SELECT * FROM financial_goals WHERE id = ?').get(Number(id))
      const data = calculateGoalProgress(updatedGoal as Record<string, number | string | null>)

      res.json({
        success: true,
        data,
      })
    } catch (error) {
      res.json({
        success: false,
        error: error instanceof Error ? error.message : 'Deposit failed',
      })
    }
  })

  try {
    tx()
  } catch (innerError) {
    res.json({
      success: false,
      error: innerError instanceof Error ? innerError.message : 'Deposit transaction failed',
    })
  }
})

router.post('/:id/withdraw', (req: Request, res: Response): void => {
  const tx = db.transaction(() => {
    try {
      const { id } = req.params
      const { amount, remark } = req.body as { amount: number; remark?: string }

      if (!amount || amount <= 0) {
        res.json({
          success: false,
          error: 'Valid amount is required',
        })
        return
      }

      const existing = db.prepare('SELECT * FROM financial_goals WHERE id = ?').get(Number(id))
      if (!existing) {
        res.json({
          success: false,
          error: 'Goal not found',
        })
        return
      }

      const goal = existing as { current_amount: number; status: string }
      if (amount > goal.current_amount) {
        res.json({
          success: false,
          error: 'Insufficient funds',
        })
        return
      }

      const newCurrent = goal.current_amount - amount

      db.prepare(`
        UPDATE financial_goals 
        SET current_amount = ?, status = 'active', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newCurrent, Number(id))

      db.prepare(`
        INSERT INTO goal_transactions (goal_id, amount, type, remark)
        VALUES (?, ?, 'withdraw', ?)
      `).run(Number(id), amount, remark || null)

      const updatedGoal = db.prepare('SELECT * FROM financial_goals WHERE id = ?').get(Number(id))
      const data = calculateGoalProgress(updatedGoal as Record<string, number | string | null>)

      res.json({
        success: true,
        data,
      })
    } catch (error) {
      res.json({
        success: false,
        error: error instanceof Error ? error.message : 'Withdraw failed',
      })
    }
  })

  try {
    tx()
  } catch (innerError) {
    res.json({
      success: false,
      error: innerError instanceof Error ? innerError.message : 'Withdraw transaction failed',
    })
  }
})

function calculateGoalProgress(goal: Record<string, number | string | null>): GoalWithProgress {
  const targetAmount = Number(goal.target_amount) || 0
  const deadline = goal.deadline as string | null
  const autoTrack = Number(goal.auto_track) || 0
  const createdAt = goal.created_at as string
  const status = goal.status as string

  let currentAmount: number

  if (autoTrack === 1 && status !== 'completed') {
    const createdAtDate = createdAt ? createdAt.split(' ')[0] : '2000-01-01'
    const savingsRow = db.prepare(`
      SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) as total
      FROM transactions
      WHERE date >= ?
        AND NOT EXISTS (
          SELECT 1 FROM transaction_splits ts WHERE ts.parent_transaction_id = transactions.id
        )
    `).get(createdAtDate) as { total: number }
    currentAmount = Math.max(0, savingsRow.total)
  } else {
    currentAmount = Number(goal.current_amount) || 0
  }

  const progressPercentage = targetAmount > 0 ? Math.min((currentAmount / targetAmount) * 100, 100) : 0
  const remainingAmount = Math.max(targetAmount - currentAmount, 0)

  let monthlySavingsNeeded = 0
  let estimatedCompletionDate: string | null = null

  if (deadline && remainingAmount > 0) {
    const now = new Date()
    const deadlineDate = new Date(deadline)
    const monthsRemaining = Math.max(
      (deadlineDate.getFullYear() - now.getFullYear()) * 12 + (deadlineDate.getMonth() - now.getMonth()),
      1
    )
    monthlySavingsNeeded = remainingAmount / monthsRemaining
  }

  const now = new Date()
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0]

  const savingsRow = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) as total
    FROM transactions
    WHERE date >= ?
      AND NOT EXISTS (
        SELECT 1 FROM transaction_splits ts WHERE ts.parent_transaction_id = transactions.id
      )
  `).get(sixMonthsAgoStr) as { total: number }

  const averageMonthlySavings = savingsRow.total / 6

  if (remainingAmount > 0 && averageMonthlySavings > 0) {
    const monthsNeeded = Math.ceil(remainingAmount / averageMonthlySavings)
    const estimatedDate = new Date(now.getFullYear(), now.getMonth() + monthsNeeded, 1)
    estimatedCompletionDate = estimatedDate.toISOString().split('T')[0]
  } else if (remainingAmount <= 0) {
    estimatedCompletionDate = new Date().toISOString().split('T')[0]
  }

  const milestones = [
    { percentage: 25, label: '25%', achieved: progressPercentage >= 25 },
    { percentage: 50, label: '50%', achieved: progressPercentage >= 50 },
    { percentage: 75, label: '75%', achieved: progressPercentage >= 75 },
    { percentage: 100, label: '100%', achieved: progressPercentage >= 100 },
  ]

  return {
    id: goal.id as number,
    name: goal.name as string,
    target_amount: targetAmount,
    current_amount: currentAmount,
    deadline,
    description: goal.description as string | null,
    color: (goal.color as string) || '#3b82f6',
    icon: (goal.icon as string) || '🎯',
    auto_track: autoTrack,
    status: goal.status as string,
    created_at: goal.created_at as string,
    updated_at: goal.updated_at as string,
    progress_percentage: progressPercentage,
    remaining_amount: remainingAmount,
    monthly_savings_needed: monthlySavingsNeeded,
    estimated_completion_date: estimatedCompletionDate,
    milestones,
  }
}

export default router
