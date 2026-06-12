import { Router, type Request, type Response } from 'express'
import { db } from '../db.js'

const router = Router()

interface RecurringTransaction {
  id: number
  type: string
  amount: number
  category: string
  remark: string | null
  member_id: number
  start_date: string
  end_date: string | null
  frequency: string
  interval: number
  last_generated: string | null
  next_generation: string
  active: number
  created_at: string
}

function calculateNextGeneration(startDate: string, frequency: string, interval: number): string {
  const date = new Date(startDate)

  switch (frequency) {
    case 'daily':
      date.setDate(date.getDate() + interval)
      break
    case 'weekly':
      date.setDate(date.getDate() + interval * 7)
      break
    case 'monthly':
      date.setMonth(date.getMonth() + interval)
      break
    case 'yearly':
      date.setFullYear(date.getFullYear() + interval)
      break
  }

  return date.toISOString().split('T')[0]
}

router.get('/', (req: Request, res: Response): void => {
  try {
    const { active } = req.query

    const conditions: string[] = []
    const params: (string | number)[] = []

    if (active !== undefined) {
      conditions.push('active = ?')
      params.push(active === 'true' || active === '1' ? 1 : 0)
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

    const query = `
      SELECT * FROM recurring_transactions
      ${whereClause}
      ORDER BY id DESC
    `
    const recurringList = db.prepare(query).all(...params) as RecurringTransaction[]

    res.json({
      success: true,
      data: recurringList,
    })
  } catch (error) {
    res.json({
      success: false,
      error: error instanceof Error ? error.message : '获取定期账目列表失败',
    })
  }
})

router.get('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const recurring = db.prepare('SELECT * FROM recurring_transactions WHERE id = ?').get(Number(id)) as RecurringTransaction | undefined

    if (!recurring) {
      res.json({
        success: false,
        error: '定期账目不存在',
      })
      return
    }

    res.json({
      success: true,
      data: recurring,
    })
  } catch (error) {
    res.json({
      success: false,
      error: error instanceof Error ? error.message : '获取定期账目详情失败',
    })
  }
})

router.post('/', (req: Request, res: Response): void => {
  try {
    const {
      type,
      amount,
      category,
      remark,
      member_id,
      start_date,
      end_date,
      frequency,
      interval = 1,
    } = req.body

    if (!type || !amount || !category || !member_id || !start_date || !frequency) {
      res.json({
        success: false,
        error: '缺少必填字段',
      })
      return
    }

    if (type !== 'income' && type !== 'expense') {
      res.json({
        success: false,
        error: '类型必须是 income 或 expense',
      })
      return
    }

    if (!['daily', 'weekly', 'monthly', 'yearly'].includes(frequency)) {
      res.json({
        success: false,
        error: '频率必须是 daily、weekly、monthly 或 yearly',
      })
      return
    }

    const next_generation = calculateNextGeneration(start_date, frequency, interval)

    const result = db.prepare(`
      INSERT INTO recurring_transactions 
        (type, amount, category, remark, member_id, start_date, end_date, frequency, interval, next_generation)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      type,
      amount,
      category,
      remark || null,
      member_id,
      start_date,
      end_date || null,
      frequency,
      interval,
      next_generation
    )

    const recurring = db.prepare('SELECT * FROM recurring_transactions WHERE id = ?').get(result.lastInsertRowid) as RecurringTransaction

    res.json({
      success: true,
      data: recurring,
    })
  } catch (error) {
    res.json({
      success: false,
      error: error instanceof Error ? error.message : '创建定期账目失败',
    })
  }
})

router.put('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const {
      type,
      amount,
      category,
      remark,
      member_id,
      start_date,
      end_date,
      frequency,
      interval,
      active,
    } = req.body

    const existing = db.prepare('SELECT * FROM recurring_transactions WHERE id = ?').get(Number(id)) as RecurringTransaction | undefined
    if (!existing) {
      res.json({
        success: false,
        error: '定期账目不存在',
      })
      return
    }

    if (type && type !== 'income' && type !== 'expense') {
      res.json({
        success: false,
        error: '类型必须是 income 或 expense',
      })
      return
    }

    if (frequency && !['daily', 'weekly', 'monthly', 'yearly'].includes(frequency)) {
      res.json({
        success: false,
        error: '频率必须是 daily、weekly、monthly 或 yearly',
      })
      return
    }

    const updates: string[] = []
    const params: (string | number | null)[] = []

    if (type !== undefined) {
      updates.push('type = ?')
      params.push(type)
    }
    if (amount !== undefined) {
      updates.push('amount = ?')
      params.push(amount)
    }
    if (category !== undefined) {
      updates.push('category = ?')
      params.push(category)
    }
    if (remark !== undefined) {
      updates.push('remark = ?')
      params.push(remark || null)
    }
    if (member_id !== undefined) {
      updates.push('member_id = ?')
      params.push(member_id)
    }
    if (start_date !== undefined) {
      updates.push('start_date = ?')
      params.push(start_date)
    }
    if (end_date !== undefined) {
      updates.push('end_date = ?')
      params.push(end_date || null)
    }
    if (frequency !== undefined) {
      updates.push('frequency = ?')
      params.push(frequency)
    }
    if (interval !== undefined) {
      updates.push('interval = ?')
      params.push(interval)
    }
    if (active !== undefined) {
      updates.push('active = ?')
      params.push(active ? 1 : 0)
    }

    if (updates.length > 0) {
      const finalStartDate = start_date || existing.start_date
      const finalFrequency = frequency || existing.frequency
      const finalInterval = interval || existing.interval

      if (start_date !== undefined || frequency !== undefined || interval !== undefined) {
        const next_generation = calculateNextGeneration(finalStartDate, finalFrequency, finalInterval)
        updates.push('next_generation = ?')
        params.push(next_generation)
      }

      params.push(Number(id))
      db.prepare(`UPDATE recurring_transactions SET ${updates.join(', ')} WHERE id = ?`).run(...params)
    }

    const recurring = db.prepare('SELECT * FROM recurring_transactions WHERE id = ?').get(Number(id)) as RecurringTransaction

    res.json({
      success: true,
      data: recurring,
    })
  } catch (error) {
    res.json({
      success: false,
      error: error instanceof Error ? error.message : '更新定期账目失败',
    })
  }
})

router.delete('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params

    const existing = db.prepare('SELECT * FROM recurring_transactions WHERE id = ?').get(Number(id)) as RecurringTransaction | undefined
    if (!existing) {
      res.json({
        success: false,
        error: '定期账目不存在',
      })
      return
    }

    db.prepare('DELETE FROM recurring_transactions WHERE id = ?').run(Number(id))

    res.json({
      success: true,
      data: { id: Number(id) },
    })
  } catch (error) {
    res.json({
      success: false,
      error: error instanceof Error ? error.message : '删除定期账目失败',
    })
  }
})

router.post('/:id/toggle', (req: Request, res: Response): void => {
  try {
    const { id } = req.params

    const existing = db.prepare('SELECT * FROM recurring_transactions WHERE id = ?').get(Number(id)) as RecurringTransaction | undefined
    if (!existing) {
      res.json({
        success: false,
        error: '定期账目不存在',
      })
      return
    }

    const newActive = existing.active === 1 ? 0 : 1
    db.prepare('UPDATE recurring_transactions SET active = ? WHERE id = ?').run(newActive, Number(id))

    const recurring = db.prepare('SELECT * FROM recurring_transactions WHERE id = ?').get(Number(id)) as RecurringTransaction

    res.json({
      success: true,
      data: recurring,
    })
  } catch (error) {
    res.json({
      success: false,
      error: error instanceof Error ? error.message : '切换定期账目状态失败',
    })
  }
})

router.post('/:id/generate', (req: Request, res: Response): void => {
  try {
    const { id } = req.params

    const recurring = db.prepare('SELECT * FROM recurring_transactions WHERE id = ?').get(Number(id)) as RecurringTransaction | undefined
    if (!recurring) {
      res.json({
        success: false,
        error: '定期账目不存在',
      })
      return
    }

    if (recurring.active === 0) {
      res.json({
        success: false,
        error: '定期账目已暂停，无法生成',
      })
      return
    }

    const result = db.prepare(`
      INSERT INTO transactions (type, amount, category, remark, date, member_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      recurring.type,
      recurring.amount,
      recurring.category,
      recurring.remark,
      recurring.next_generation,
      recurring.member_id
    )

    const transactionId = result.lastInsertRowid as number

    const nextGen = calculateNextGeneration(recurring.next_generation, recurring.frequency, recurring.interval)

    db.prepare(`
      UPDATE recurring_transactions 
      SET last_generated = ?, next_generation = ?
      WHERE id = ?
    `).run(recurring.next_generation, nextGen, Number(id))

    const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(transactionId)

    res.json({
      success: true,
      data: transaction,
    })
  } catch (error) {
    res.json({
      success: false,
      error: error instanceof Error ? error.message : '生成账目失败',
    })
  }
})

export default router
