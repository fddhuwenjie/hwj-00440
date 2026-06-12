import { Router, type Request, type Response } from 'express'
import { db } from '../db.js'

const router = Router()

function getMonthRange(month: string): { start: string; end: string; daysInMonth: number } {
  const [year, monthNum] = month.split('-').map(Number)
  const daysInMonth = new Date(year, monthNum, 0).getDate()
  const start = `${month}-01`
  const end = `${month}-${String(daysInMonth).padStart(2, '0')}`
  return { start, end, daysInMonth }
}

function getPreviousMonth(month: string): string {
  const [year, monthNum] = month.split('-').map(Number)
  const date = new Date(year, monthNum - 2, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

router.get('/overview', (req: Request, res: Response): void => {
  try {
    const { month } = req.query

    if (!month) {
      res.json({
        success: false,
        error: 'Missing required parameter: month',
      })
      return
    }

    const { start, end, daysInMonth } = getMonthRange(month as string)

    const incomeRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE type = 'income' AND date >= ? AND date <= ?
    `).get(start, end) as { total: number }

    const expenseRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE type = 'expense' AND date >= ? AND date <= ?
    `).get(start, end) as { total: number }

    const totalIncome = incomeRow.total
    const totalExpense = expenseRow.total
    const balance = totalIncome - totalExpense
    const dailyAverage = daysInMonth > 0 ? totalExpense / daysInMonth : 0

    res.json({
      success: true,
      data: {
        total_income: totalIncome,
        total_expense: totalExpense,
        balance,
        daily_average: dailyAverage,
        days_in_month: daysInMonth,
      },
    })
  } catch (error) {
    res.json({
      success: false,
      error: error instanceof Error ? error.message : 'Query failed',
    })
  }
})

router.get('/trend', (req: Request, res: Response): void => {
  try {
    const { months = '6' } = req.query
    const monthCount = Number(months)

    if (isNaN(monthCount) || monthCount < 1 || monthCount > 36) {
      res.json({
        success: false,
        error: 'Invalid months parameter, must be between 1 and 36',
      })
      return
    }

    const now = new Date()
    const monthList: string[] = []

    for (let i = monthCount - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      monthList.push(monthStr)
    }

    const result = monthList.map((month) => {
      const { start, end } = getMonthRange(month)

      const incomeRow = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE type = 'income' AND date >= ? AND date <= ?
      `).get(start, end) as { total: number }

      const expenseRow = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE type = 'expense' AND date >= ? AND date <= ?
      `).get(start, end) as { total: number }

      return {
        month,
        income: incomeRow.total,
        expense: expenseRow.total,
      }
    })

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

router.get('/category-pie', (req: Request, res: Response): void => {
  try {
    const { month } = req.query

    if (!month) {
      res.json({
        success: false,
        error: 'Missing required parameter: month',
      })
      return
    }

    const { start, end } = getMonthRange(month as string)

    const categories = db.prepare(`
      SELECT 
        category,
        SUM(amount) as total,
        COUNT(*) as count
      FROM transactions
      WHERE type = 'expense' AND date >= ? AND date <= ?
      GROUP BY category
      ORDER BY total DESC
    `).all(start, end) as Array<{ category: string; total: number; count: number }>

    const totalExpense = categories.reduce((sum, cat) => sum + cat.total, 0)

    const result = categories.map((cat) => ({
      category: cat.category,
      amount: cat.total,
      count: cat.count,
      percentage: totalExpense > 0 ? (cat.total / totalExpense) * 100 : 0,
    }))

    res.json({
      success: true,
      data: {
        total_expense: totalExpense,
        categories: result,
      },
    })
  } catch (error) {
    res.json({
      success: false,
      error: error instanceof Error ? error.message : 'Query failed',
    })
  }
})

router.get('/top-expenses', (req: Request, res: Response): void => {
  try {
    const { month, limit = '5' } = req.query

    if (!month) {
      res.json({
        success: false,
        error: 'Missing required parameter: month',
      })
      return
    }

    const limitNum = Number(limit)
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      res.json({
        success: false,
        error: 'Invalid limit parameter, must be between 1 and 100',
      })
      return
    }

    const { start, end } = getMonthRange(month as string)

    const expenses = db.prepare(`
      SELECT 
        t.id,
        t.amount,
        t.category,
        t.remark,
        t.date,
        t.member_id,
        m.name as member_name,
        m.avatar as member_avatar
      FROM transactions t
      LEFT JOIN members m ON t.member_id = m.id
      WHERE t.type = 'expense' AND t.date >= ? AND t.date <= ?
      ORDER BY t.amount DESC
      LIMIT ?
    `).all(start, end, limitNum) as Array<Record<string, unknown>>

    const result = expenses.map((expense) => {
      const txId = expense.id as number
      const tags = db.prepare(`
        SELECT tg.id, tg.name, tg.color
        FROM transaction_tags tt
        JOIN tags tg ON tt.tag_id = tg.id
        WHERE tt.transaction_id = ?
      `).all(txId)

      const { member_id, member_name, member_avatar, ...rest } = expense
      return {
        ...rest,
        member: {
          id: member_id,
          name: member_name,
          avatar: member_avatar,
        },
        tags,
      }
    })

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

router.get('/tag-summary', (req: Request, res: Response): void => {
  try {
    const { month } = req.query

    if (!month) {
      res.json({
        success: false,
        error: 'Missing required parameter: month',
      })
      return
    }

    const { start, end } = getMonthRange(month as string)

    const tags = db.prepare(`
      SELECT 
        tg.id,
        tg.name,
        tg.color,
        COALESCE(SUM(t.amount), 0) as total,
        COUNT(DISTINCT t.id) as count
      FROM tags tg
      LEFT JOIN transaction_tags tt ON tg.id = tt.tag_id
      LEFT JOIN transactions t ON tt.transaction_id = t.id
        AND t.type = 'expense' AND t.date >= ? AND t.date <= ?
      GROUP BY tg.id, tg.name, tg.color
      ORDER BY total DESC
    `).all(start, end) as Array<{ id: number; name: string; color: string; total: number; count: number }>

    const totalExpenseRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE type = 'expense' AND date >= ? AND date <= ?
    `).get(start, end) as { total: number }

    const totalExpense = totalExpenseRow.total

    const result = tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      amount: tag.total,
      count: tag.count,
      percentage: totalExpense > 0 ? (tag.total / totalExpense) * 100 : 0,
    }))

    res.json({
      success: true,
      data: {
        total_expense: totalExpense,
        tags: result,
      },
    })
  } catch (error) {
    res.json({
      success: false,
      error: error instanceof Error ? error.message : 'Query failed',
    })
  }
})

router.get('/monthly-comparison', (req: Request, res: Response): void => {
  try {
    const { month } = req.query

    if (!month) {
      res.json({
        success: false,
        error: 'Missing required parameter: month',
      })
      return
    }

    const currentMonth = month as string
    const previousMonth = getPreviousMonth(currentMonth)

    const { start: currStart, end: currEnd } = getMonthRange(currentMonth)
    const { start: prevStart, end: prevEnd } = getMonthRange(previousMonth)

    const currIncomeRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE type = 'income' AND date >= ? AND date <= ?
    `).get(currStart, currEnd) as { total: number }

    const prevIncomeRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE type = 'income' AND date >= ? AND date <= ?
    `).get(prevStart, prevEnd) as { total: number }

    const currExpenseRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE type = 'expense' AND date >= ? AND date <= ?
    `).get(currStart, currEnd) as { total: number }

    const prevExpenseRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE type = 'expense' AND date >= ? AND date <= ?
    `).get(prevStart, prevEnd) as { total: number }

    const currIncome = currIncomeRow.total
    const prevIncome = prevIncomeRow.total
    const currExpense = currExpenseRow.total
    const prevExpense = prevExpenseRow.total

    const incomeChange = currIncome - prevIncome
    const incomeRate = prevIncome > 0 ? ((currIncome - prevIncome) / prevIncome) * 100 : (currIncome > 0 ? 100 : 0)

    const expenseChange = currExpense - prevExpense
    const expenseRate = prevExpense > 0 ? ((currExpense - prevExpense) / prevExpense) * 100 : (currExpense > 0 ? 100 : 0)

    const currCategories = db.prepare(`
      SELECT category, SUM(amount) as total
      FROM transactions
      WHERE type = 'expense' AND date >= ? AND date <= ?
      GROUP BY category
    `).all(currStart, currEnd) as Array<{ category: string; total: number }>

    const prevCategories = db.prepare(`
      SELECT category, SUM(amount) as total
      FROM transactions
      WHERE type = 'expense' AND date >= ? AND date <= ?
      GROUP BY category
    `).all(prevStart, prevEnd) as Array<{ category: string; total: number }>

    const prevCatMap = new Map(prevCategories.map((c) => [c.category, c.total]))
    const allCategories = new Set([...currCategories.map((c) => c.category), ...prevCategories.map((c) => c.category)])

    const categoryComparison = Array.from(allCategories).map((category) => {
      const current = currCategories.find((c) => c.category === category)?.total || 0
      const previous = prevCatMap.get(category) || 0
      const change = current - previous
      const rate = previous > 0 ? ((current - previous) / previous) * 100 : (current > 0 ? 100 : 0)
      return {
        category,
        current,
        previous,
        change,
        rate,
      }
    }).sort((a, b) => b.current - a.current)

    res.json({
      success: true,
      data: {
        current_month: currentMonth,
        previous_month: previousMonth,
        income: {
          current: currIncome,
          previous: prevIncome,
          change: incomeChange,
          rate: incomeRate,
        },
        expense: {
          current: currExpense,
          previous: prevExpense,
          change: expenseChange,
          rate: expenseRate,
        },
        categories: categoryComparison,
      },
    })
  } catch (error) {
    res.json({
      success: false,
      error: error instanceof Error ? error.message : 'Query failed',
    })
  }
})

export default router
