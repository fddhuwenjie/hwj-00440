import { Router, type Request, type Response } from 'express'
import { db } from '../db.js'

const router = Router()

interface TransactionWithMember {
  id: number
  type: string
  amount: number
  category: string
  remark: string | null
  date: string
  member_id: number
  reimbursement_status: string
  receipt_image: string | null
  reimbursed_by: number | null
  reimbursed_at: string | null
  parent_transaction_id: number | null
  is_split: number
  created_at: string
  updated_at: string
  member_name: string
  member_avatar: string
}

interface Tag {
  id: number
  name: string
  color: string
}

interface SplitInfo {
  id: number
  member_id: number
  amount: number
  member_name: string
  member_avatar: string
  child_transaction_id: number
}

function getTransactionWithTagsAndMember(transactionId: number) {
  const transaction = db.prepare(`
    SELECT 
      t.*,
      m.id as member_id,
      m.name as member_name,
      m.avatar as member_avatar,
      rb.name as reimbursed_by_name,
      rb.avatar as reimbursed_by_avatar
    FROM transactions t
    LEFT JOIN members m ON t.member_id = m.id
    LEFT JOIN members rb ON t.reimbursed_by = rb.id
    WHERE t.id = ?
  `).get(transactionId) as (TransactionWithMember & { reimbursed_by_name: string | null; reimbursed_by_avatar: string | null }) | undefined

  if (!transaction) return null

  const tags = db.prepare(`
    SELECT tg.id, tg.name, tg.color
    FROM transaction_tags tt
    JOIN tags tg ON tt.tag_id = tg.id
    WHERE tt.transaction_id = ?
  `).all(transactionId) as Tag[]

  const splits = db.prepare(`
    SELECT 
      ts.id,
      ts.member_id,
      ts.amount,
      ts.child_transaction_id,
      m.name as member_name,
      m.avatar as member_avatar
    FROM transaction_splits ts
    JOIN members m ON ts.member_id = m.id
    WHERE ts.parent_transaction_id = ?
  `).all(transactionId) as SplitInfo[]

  const { member_id, member_name, member_avatar, reimbursed_by_name, reimbursed_by_avatar, ...rest } = transaction
  const result: Record<string, unknown> = {
    ...rest,
    member: {
      id: member_id,
      name: member_name,
      avatar: member_avatar,
    },
    tags,
  }

  if (transaction.reimbursed_by) {
    result.reimbursed_by_member = {
      id: transaction.reimbursed_by,
      name: reimbursed_by_name,
      avatar: reimbursed_by_avatar,
    }
  }

  if (splits.length > 0) {
    result.splits = splits
  }

  return result
}

router.get('/', (req: Request, res: Response): void => {
  try {
    const {
      type,
      category,
      member_id,
      start_date,
      end_date,
      tag,
      reimbursement_status,
      page = '1',
      page_size = '20',
    } = req.query

    const conditions: string[] = []
    const params: (string | number)[] = []

    if (type) {
      conditions.push('t.type = ?')
      params.push(type as string)
    }
    if (category) {
      conditions.push('t.category = ?')
      params.push(category as string)
    }
    if (member_id) {
      conditions.push('t.member_id = ?')
      params.push(Number(member_id))
    }
    if (start_date) {
      conditions.push('t.date >= ?')
      params.push(start_date as string)
    }
    if (end_date) {
      conditions.push('t.date <= ?')
      params.push(end_date as string)
    }
    if (reimbursement_status) {
      conditions.push('t.reimbursement_status = ?')
      params.push(reimbursement_status as string)
    }

    let joinClause = ''
    if (tag) {
      joinClause = `
        JOIN transaction_tags tt ON t.id = tt.transaction_id
        JOIN tags tg ON tt.tag_id = tg.id
      `
      conditions.push('tg.name = ?')
      params.push(tag as string)
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

    const countQuery = `
      SELECT COUNT(DISTINCT t.id) as total
      FROM transactions t
      ${joinClause}
      ${whereClause}
    `
    const { total } = db.prepare(countQuery).get(...params) as { total: number }

    const pageNum = Number(page)
    const pageSizeNum = Number(page_size)
    const offset = (pageNum - 1) * pageSizeNum

    const listQuery = `
      SELECT DISTINCT
        t.*,
        m.id as member_id,
        m.name as member_name,
        m.avatar as member_avatar
      FROM transactions t
      ${joinClause}
      LEFT JOIN members m ON t.member_id = m.id
      ${whereClause}
      ORDER BY t.date DESC, t.id DESC
      LIMIT ? OFFSET ?
    `
    const transactions = db.prepare(listQuery).all(...params, pageSizeNum, offset) as Array<Record<string, unknown>>

    const result = transactions.map((tx) => {
      const txId = tx.id as number
      const tags = db.prepare(`
        SELECT tg.id, tg.name, tg.color
        FROM transaction_tags tt
        JOIN tags tg ON tt.tag_id = tg.id
        WHERE tt.transaction_id = ?
      `).all(txId)

      const splits = db.prepare(`
        SELECT 
          ts.id,
          ts.member_id,
          ts.amount,
          ts.child_transaction_id,
          m.name as member_name,
          m.avatar as member_avatar
        FROM transaction_splits ts
        JOIN members m ON ts.member_id = m.id
        WHERE ts.parent_transaction_id = ?
      `).all(txId)

      const { member_id, member_name, member_avatar, ...rest } = tx
      const txResult: Record<string, unknown> = {
        ...rest,
        member: {
          id: member_id,
          name: member_name,
          avatar: member_avatar,
        },
        tags,
      }
      if (splits.length > 0) {
        txResult.splits = splits
      }
      return txResult
    })

    res.json({
      success: true,
      data: {
        list: result,
        total,
        page: pageNum,
        page_size: pageSizeNum,
      },
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
    const transaction = getTransactionWithTagsAndMember(Number(id))

    if (!transaction) {
      res.json({
        success: false,
        error: 'Transaction not found',
      })
      return
    }

    res.json({
      success: true,
      data: transaction,
    })
  } catch (error) {
    res.json({
      success: false,
      error: error instanceof Error ? error.message : 'Query failed',
    })
  }
})

router.post('/', (req: Request, res: Response): void => {
  const tx = db.transaction(() => {
    try {
      const { type, amount, category, remark, date, member_id, tags = [], reimbursement_status = 'none', receipt_image, goal_id } = req.body

      if (!type || !amount || !category || !date || !member_id) {
        res.json({
          success: false,
          error: 'Missing required fields',
        })
        return
      }

      if (type !== 'income' && type !== 'expense') {
        res.json({
          success: false,
          error: 'Type must be either income or expense',
        })
        return
      }

      const result = db.prepare(`
        INSERT INTO transactions (type, amount, category, remark, date, member_id, reimbursement_status, receipt_image)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(type, amount, category, remark, date, member_id, reimbursement_status, receipt_image || null)

      const transactionId = result.lastInsertRowid as number

      const insertTransactionTag = db.prepare(`
        INSERT OR IGNORE INTO transaction_tags (transaction_id, tag_id)
        VALUES (?, (SELECT id FROM tags WHERE name = ?))
      `)

      for (const tagName of tags as string[]) {
        db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(tagName)
        insertTransactionTag.run(transactionId, tagName)
      }

      if (goal_id) {
        const goal = db.prepare('SELECT * FROM financial_goals WHERE id = ?').get(goal_id) as Record<string, unknown> | undefined
        if (goal) {
          const delta = type === 'income' ? Number(amount) : -Number(amount)
          const newAmount = Math.max(0, Number(goal.current_amount) + delta)
          db.prepare(`
            UPDATE financial_goals SET current_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
          `).run(newAmount, goal_id)

          db.prepare(`
            INSERT INTO goal_transactions (goal_id, transaction_id, amount, type, remark)
            VALUES (?, ?, ?, 'auto', ?)
          `).run(goal_id, transactionId, Math.abs(Number(amount)), `自动关联：${remark || category}`)
        }
      }

      const transaction = getTransactionWithTagsAndMember(transactionId)

      res.json({
        success: true,
        data: transaction,
      })
    } catch (error) {
      res.json({
        success: false,
        error: error instanceof Error ? error.message : 'Create failed',
      })
    }
  })

  try {
    tx()
  } catch (innerError) {
    res.json({
      success: false,
      error: innerError instanceof Error ? innerError.message : 'Create transaction failed',
    })
  }
})

router.put('/:id', (req: Request, res: Response): void => {
  const tx = db.transaction(() => {
    try {
      const { id } = req.params
      const { type, amount, category, remark, date, member_id, tags, reimbursement_status, receipt_image, goal_id } = req.body

      const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(Number(id))
      if (!existing) {
        res.json({
          success: false,
          error: 'Transaction not found',
        })
        return
      }

      if (type && type !== 'income' && type !== 'expense') {
        res.json({
          success: false,
          error: 'Type must be either income or expense',
        })
        return
      }

      const existingTx = existing as { type: string; amount: number; goal_id?: number }

      const updates: string[] = []
      const params: (string | number)[] = []

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
        params.push(remark)
      }
      if (date !== undefined) {
        updates.push('date = ?')
        params.push(date)
      }
      if (member_id !== undefined) {
        updates.push('member_id = ?')
        params.push(member_id)
      }
      if (reimbursement_status !== undefined) {
        updates.push('reimbursement_status = ?')
        params.push(reimbursement_status)
      }
      if (receipt_image !== undefined) {
        updates.push('receipt_image = ?')
        params.push(receipt_image)
      }
      updates.push('updated_at = CURRENT_TIMESTAMP')

      if (updates.length > 0) {
        params.push(Number(id))
        db.prepare(`UPDATE transactions SET ${updates.join(', ')} WHERE id = ?`).run(...params)
      }

      if (tags !== undefined) {
        db.prepare('DELETE FROM transaction_tags WHERE transaction_id = ?').run(Number(id))

        const insertTransactionTag = db.prepare(`
          INSERT OR IGNORE INTO transaction_tags (transaction_id, tag_id)
          VALUES (?, (SELECT id FROM tags WHERE name = ?))
        `)

        for (const tagName of tags as string[]) {
          db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(tagName)
          insertTransactionTag.run(Number(id), tagName)
        }
      }

      if (goal_id !== undefined) {
        const existingLink = db.prepare(`
          SELECT * FROM goal_transactions WHERE transaction_id = ? AND type = 'auto'
        `).get(Number(id)) as { goal_id: number; amount: number } | undefined

        if (existingLink) {
          const oldDelta = existingTx.type === 'income' ? -existingLink.amount : existingLink.amount
          db.prepare(`
            UPDATE financial_goals SET current_amount = MAX(0, current_amount + ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?
          `).run(oldDelta, existingLink.goal_id)
          db.prepare('DELETE FROM goal_transactions WHERE transaction_id = ? AND type = ?').run(Number(id), 'auto')
        }

        if (goal_id) {
          const goal = db.prepare('SELECT * FROM financial_goals WHERE id = ?').get(goal_id) as Record<string, unknown> | undefined
          if (goal) {
            const effectiveType = type || existingTx.type
            const effectiveAmount = amount !== undefined ? Number(amount) : existingTx.amount
            const delta = effectiveType === 'income' ? effectiveAmount : -effectiveAmount
            const newAmount = Math.max(0, Number(goal.current_amount) + delta)
            db.prepare(`
              UPDATE financial_goals SET current_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
            `).run(newAmount, goal_id)

            db.prepare(`
              INSERT INTO goal_transactions (goal_id, transaction_id, amount, type, remark)
              VALUES (?, ?, ?, 'auto', ?)
            `).run(goal_id, Number(id), effectiveAmount, `自动关联：${remark || category || existingTx.type}`)
          }
        }
      }

      const transaction = getTransactionWithTagsAndMember(Number(id))

      res.json({
        success: true,
        data: transaction,
      })
    } catch (error) {
      res.json({
        success: false,
        error: error instanceof Error ? error.message : 'Update failed',
      })
    }
  })

  try {
    tx()
  } catch (innerError) {
    res.json({
      success: false,
      error: innerError instanceof Error ? innerError.message : 'Update transaction failed',
    })
  }
})

router.delete('/:id', (req: Request, res: Response): void => {
  const tx = db.transaction(() => {
    try {
      const { id } = req.params

      const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(Number(id))
      if (!existing) {
        res.json({
          success: false,
          error: 'Transaction not found',
        })
        return
      }

      const existingTx = existing as { type: string; amount: number }

      const autoLink = db.prepare(`
        SELECT * FROM goal_transactions WHERE transaction_id = ? AND type = 'auto'
      `).get(Number(id)) as { goal_id: number; amount: number } | undefined

      if (autoLink) {
        const reverseDelta = existingTx.type === 'income' ? -autoLink.amount : autoLink.amount
        db.prepare(`
          UPDATE financial_goals SET current_amount = MAX(0, current_amount + ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(reverseDelta, autoLink.goal_id)
        db.prepare('DELETE FROM goal_transactions WHERE transaction_id = ? AND type = ?').run(Number(id), 'auto')
      }

      db.prepare('DELETE FROM transactions WHERE id = ?').run(Number(id))

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

  try {
    tx()
  } catch (innerError) {
    res.json({
      success: false,
      error: innerError instanceof Error ? innerError.message : 'Delete transaction failed',
    })
  }
})

router.post('/:id/split', (req: Request, res: Response): void => {
  const tx = db.transaction(() => {
    try {
      const { id } = req.params
      const { splits } = req.body as { splits: Array<{ member_id: number; amount: number }> }

      const parentTx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(Number(id))
      if (!parentTx) {
        res.json({ success: false, error: 'Parent transaction not found' })
        return
      }

      if (!splits || !Array.isArray(splits)) {
        res.json({ success: false, error: 'Splits are required' })
        return
      }

      const parent = parentTx as { amount: number; type: string; category: string; remark: string | null; date: string }
      const totalSplitAmount = splits.reduce((sum, s) => sum + (s.amount || 0), 0)
      if (Math.abs(totalSplitAmount - parent.amount) > 0.01) {
        res.json({ success: false, error: 'Split amounts must equal parent transaction amount' })
        return
      }

      const insertSplit = db.prepare(`
        INSERT INTO transactions (type, amount, category, remark, date, member_id, parent_transaction_id, is_split)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `)

      const insertSplitRelation = db.prepare(`
        INSERT INTO transaction_splits (parent_transaction_id, child_transaction_id, member_id, amount)
        VALUES (?, ?, ?, ?)
      `)

      for (const split of splits) {
        const childResult = insertSplit.run(
          parent.type,
          split.amount,
          parent.category,
          parent.remark,
          parent.date,
          split.member_id,
          Number(id)
        )
        insertSplitRelation.run(Number(id), childResult.lastInsertRowid, split.member_id, split.amount)
      }

      db.prepare('UPDATE transactions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(Number(id))

      const transaction = getTransactionWithTagsAndMember(Number(id))
      res.json({ success: true, data: transaction })
    } catch (error) {
      res.json({ success: false, error: error instanceof Error ? error.message : 'Split failed' })
    }
  })

  try {
    tx()
  } catch (innerError) {
    res.json({
      success: false,
      error: innerError instanceof Error ? innerError.message : 'Split transaction failed',
    })
  }
})

router.post('/:id/set-reimbursement', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const { status, receipt_image } = req.body

    const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(Number(id))
    if (!existing) {
      res.json({ success: false, error: 'Transaction not found' })
      return
    }

    const validStatuses = ['none', 'pending', 'reimbursed']
    if (status && !validStatuses.includes(status as string)) {
      res.json({ success: false, error: 'Invalid reimbursement status' })
      return
    }

    db.prepare(`
      UPDATE transactions 
      SET reimbursement_status = ?, receipt_image = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status || 'pending', receipt_image || null, Number(id))

    const transaction = getTransactionWithTagsAndMember(Number(id))
    res.json({ success: true, data: transaction })
  } catch (error) {
    res.json({ success: false, error: error instanceof Error ? error.message : 'Set reimbursement failed' })
  }
})

router.post('/:id/confirm-reimbursement', (req: Request, res: Response): void => {
  const tx = db.transaction(() => {
    try {
      const { id } = req.params
      const { confirmed_by_member_id } = req.body as { confirmed_by_member_id: number }

      const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(Number(id))
      if (!existing) {
        res.json({ success: false, error: 'Transaction not found' })
        return
      }

      const existingTx = existing as { reimbursement_status: string; amount: number; remark: string | null; member_id: number }
      if (existingTx.reimbursement_status !== 'pending') {
        res.json({ success: false, error: 'Transaction is not pending reimbursement' })
        return
      }

      if (!confirmed_by_member_id) {
        res.json({ success: false, error: 'Confirmed by member id is required' })
        return
      }

      db.prepare(`
        UPDATE transactions 
        SET reimbursement_status = 'reimbursed', reimbursed_by = ?, reimbursed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(confirmed_by_member_id, Number(id))

      const offsetIncome = db.prepare(`
        INSERT INTO transactions (type, amount, category, remark, date, member_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        'income',
        existingTx.amount,
        '报销',
        `报销确认 ${existingTx.remark || '账目'}`,
        new Date().toISOString().split('T')[0],
        existingTx.member_id
      )

      const transaction = getTransactionWithTagsAndMember(Number(id))
      res.json({
        success: true,
        data: {
          ...transaction,
          offset_transaction_id: offsetIncome.lastInsertRowid,
        },
      })
    } catch (error) {
      res.json({ success: false, error: error instanceof Error ? error.message : 'Confirm reimbursement failed' })
    }
  })

  try {
    tx()
  } catch (innerError) {
    res.json({
      success: false,
      error: innerError instanceof Error ? innerError.message : 'Confirm reimbursement failed',
    })
  }
})

export default router
