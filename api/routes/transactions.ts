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

function getTransactionWithTagsAndMember(transactionId: number) {
  const transaction = db.prepare(`
    SELECT 
      t.*,
      m.id as member_id,
      m.name as member_name,
      m.avatar as member_avatar
    FROM transactions t
    LEFT JOIN members m ON t.member_id = m.id
    WHERE t.id = ?
  `).get(transactionId) as TransactionWithMember | undefined

  if (!transaction) return null

  const tags = db.prepare(`
    SELECT tg.id, tg.name, tg.color
    FROM transaction_tags tt
    JOIN tags tg ON tt.tag_id = tg.id
    WHERE tt.transaction_id = ?
  `).all(transactionId) as Tag[]

  const { member_id, member_name, member_avatar, ...rest } = transaction
  return {
    ...rest,
    member: {
      id: member_id,
      name: member_name,
      avatar: member_avatar,
    },
    tags,
  }
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

      const { member_id, member_name, member_avatar, ...rest } = tx
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
  try {
    const { type, amount, category, remark, date, member_id, tags = [] } = req.body

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
      INSERT INTO transactions (type, amount, category, remark, date, member_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(type, amount, category, remark, date, member_id)

    const transactionId = result.lastInsertRowid as number

    const insertTransactionTag = db.prepare(`
      INSERT OR IGNORE INTO transaction_tags (transaction_id, tag_id)
      VALUES (?, (SELECT id FROM tags WHERE name = ?))
    `)

    for (const tagName of tags as string[]) {
      db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(tagName)
      insertTransactionTag.run(transactionId, tagName)
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

router.put('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const { type, amount, category, remark, date, member_id, tags } = req.body

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

router.delete('/:id', (req: Request, res: Response): void => {
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

export default router
