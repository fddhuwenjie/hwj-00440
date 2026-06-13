import { Router, type Request, type Response } from 'express'
import { db } from '../db.js'

const router = Router()

interface CategoryCount {
  category: string
  count: number
  total: number
}

interface QuickEntry {
  remark: string
  category: string
  type: 'income' | 'expense'
  amount: number
  frequency: number
  member_id: number
  member_name: string
  member_avatar: string
}

router.get('/predict-category', (req: Request, res: Response): void => {
  try {
    const { remark, type } = req.query

    if (!remark) {
      res.json({
        success: false,
        error: 'Remark is required',
      })
      return
    }

    const remarkStr = String(remark)
    const keywords = remarkStr
      .split(/[\s,，。、！？!?;；:：]+/)
      .filter((k) => k.length > 0)
      .map((k) => `%${k}%`)

    if (keywords.length === 0) {
      res.json({
        success: true,
        data: null,
      })
      return
    }

    let typeCondition = ''
    const params: (string | number)[] = []

    if (type && (type === 'income' || type === 'expense')) {
      typeCondition = 'AND type = ?'
      params.push(type as string)
    }

    const conditions = keywords.map(() => 'remark LIKE ?').join(' OR ')
    params.push(...keywords)

    const query = `
      SELECT 
        category,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE (${conditions})
      ${typeCondition}
        AND NOT EXISTS (SELECT 1 FROM transaction_splits ts WHERE ts.parent_transaction_id = transactions.id)
      GROUP BY category
      ORDER BY count DESC, total DESC
      LIMIT 5
    `

    const categories = db.prepare(query).all(...params) as CategoryCount[]

    if (categories.length === 0) {
      res.json({
        success: true,
        data: null,
      })
      return
    }

    const totalCount = categories.reduce((sum, c) => sum + c.count, 0)
    const result = categories.map((c) => ({
      category: c.category,
      count: c.count,
      total: c.total,
      confidence: totalCount > 0 ? (c.count / totalCount) * 100 : 0,
    }))

    res.json({
      success: true,
      data: {
        predicted: result[0].category,
        alternatives: result.slice(1),
        all_categories: result,
      },
    })
  } catch (error) {
    res.json({
      success: false,
      error: error instanceof Error ? error.message : 'Prediction failed',
    })
  }
})

router.get('/quick-entries', (req: Request, res: Response): void => {
  try {
    const { limit = '5' } = req.query
    const limitNum = Math.min(Number(limit) || 5, 10)

    const date = new Date()
    date.setDate(date.getDate() - 30)
    const thirtyDaysAgo = date.toISOString().split('T')[0]

    const query = `
      SELECT 
        t.remark,
        t.category,
        t.type,
        t.amount,
        t.member_id,
        m.name as member_name,
        m.avatar as member_avatar,
        COUNT(*) as frequency
      FROM transactions t
      LEFT JOIN members m ON t.member_id = m.id
      WHERE t.date >= ? AND t.remark IS NOT NULL AND t.remark != ''
        AND NOT EXISTS (SELECT 1 FROM transaction_splits ts WHERE ts.parent_transaction_id = t.id)
      GROUP BY t.remark, t.category, t.type, t.member_id, t.amount
      ORDER BY frequency DESC
      LIMIT ?
    `

    const entries = db.prepare(query).all(thirtyDaysAgo, limitNum) as QuickEntry[]

    const result = entries.map((entry) => ({
      remark: entry.remark,
      category: entry.category,
      type: entry.type,
      amount: entry.amount,
      frequency: entry.frequency,
      member: {
        id: entry.member_id,
        name: entry.member_name,
        avatar: entry.member_avatar,
      },
    }))

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    res.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get quick entries',
    })
  }
})

export default router
