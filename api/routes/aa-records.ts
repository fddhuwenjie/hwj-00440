import { Router, type Request, type Response } from 'express'
import { db } from '../db.js'

const router = Router()

interface AARecordWithMembers {
  id: number
  transaction_id: number | null
  payer_id: number
  beneficiary_id: number
  amount: number
  description: string | null
  date: string
  settled: number
  created_at: string
  payer_name: string
  payer_avatar: string
  beneficiary_name: string
  beneficiary_avatar: string
}

function getAARecordWithMembers(id: number) {
  const record = db.prepare(`
    SELECT 
      a.*,
      p.name as payer_name,
      p.avatar as payer_avatar,
      b.name as beneficiary_name,
      b.avatar as beneficiary_avatar
    FROM aa_records a
    LEFT JOIN members p ON a.payer_id = p.id
    LEFT JOIN members b ON a.beneficiary_id = b.id
    WHERE a.id = ?
  `).get(id) as AARecordWithMembers | undefined

  if (!record) return null

  const { payer_id, payer_name, payer_avatar, beneficiary_id, beneficiary_name, beneficiary_avatar, ...rest } = record
  return {
    ...rest,
    payer: {
      id: payer_id,
      name: payer_name,
      avatar: payer_avatar,
    },
    beneficiary: {
      id: beneficiary_id,
      name: beneficiary_name,
      avatar: beneficiary_avatar,
    },
  }
}

router.get('/', (req: Request, res: Response): void => {
  try {
    const { payer_id, beneficiary_id, settled } = req.query

    const conditions: string[] = []
    const params: (string | number)[] = []

    if (payer_id) {
      conditions.push('a.payer_id = ?')
      params.push(Number(payer_id))
    }
    if (beneficiary_id) {
      conditions.push('a.beneficiary_id = ?')
      params.push(Number(beneficiary_id))
    }
    if (settled !== undefined && settled !== '') {
      conditions.push('a.settled = ?')
      params.push(Number(settled))
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''

    const records = db.prepare(`
      SELECT 
        a.*,
        p.name as payer_name,
        p.avatar as payer_avatar,
        b.name as beneficiary_name,
        b.avatar as beneficiary_avatar
      FROM aa_records a
      LEFT JOIN members p ON a.payer_id = p.id
      LEFT JOIN members b ON a.beneficiary_id = b.id
      ${whereClause}
      ORDER BY a.date DESC, a.id DESC
    `).all(...params) as Array<Record<string, unknown>>

    const result = records.map((record) => {
      const { payer_id, payer_name, payer_avatar, beneficiary_id, beneficiary_name, beneficiary_avatar, ...rest } = record
      return {
        ...rest,
        payer: {
          id: payer_id,
          name: payer_name,
          avatar: payer_avatar,
        },
        beneficiary: {
          id: beneficiary_id,
          name: beneficiary_name,
          avatar: beneficiary_avatar,
        },
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

router.get('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const record = getAARecordWithMembers(Number(id))

    if (!record) {
      res.json({
        success: false,
        error: 'AA record not found',
      })
      return
    }

    res.json({
      success: true,
      data: record,
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
    const { payer_id, beneficiary_id, amount, description, date, transaction_id } = req.body

    if (!payer_id || !beneficiary_id || !amount || !date) {
      res.json({
        success: false,
        error: 'Missing required fields',
      })
      return
    }

    const result = db.prepare(`
      INSERT INTO aa_records (payer_id, beneficiary_id, amount, description, date, transaction_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(payer_id, beneficiary_id, amount, description || null, date, transaction_id || null)

    const recordId = result.lastInsertRowid as number
    const record = getAARecordWithMembers(recordId)

    res.json({
      success: true,
      data: record,
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
    const { payer_id, beneficiary_id, amount, description, date, transaction_id, settled } = req.body

    const existing = db.prepare('SELECT * FROM aa_records WHERE id = ?').get(Number(id))
    if (!existing) {
      res.json({
        success: false,
        error: 'AA record not found',
      })
      return
    }

    const updates: string[] = []
    const params: (string | number | null)[] = []

    if (payer_id !== undefined) {
      updates.push('payer_id = ?')
      params.push(payer_id)
    }
    if (beneficiary_id !== undefined) {
      updates.push('beneficiary_id = ?')
      params.push(beneficiary_id)
    }
    if (amount !== undefined) {
      updates.push('amount = ?')
      params.push(amount)
    }
    if (description !== undefined) {
      updates.push('description = ?')
      params.push(description)
    }
    if (date !== undefined) {
      updates.push('date = ?')
      params.push(date)
    }
    if (transaction_id !== undefined) {
      updates.push('transaction_id = ?')
      params.push(transaction_id)
    }
    if (settled !== undefined) {
      updates.push('settled = ?')
      params.push(settled)
    }

    if (updates.length > 0) {
      params.push(Number(id))
      db.prepare(`UPDATE aa_records SET ${updates.join(', ')} WHERE id = ?`).run(...params)
    }

    const record = getAARecordWithMembers(Number(id))

    res.json({
      success: true,
      data: record,
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

    const existing = db.prepare('SELECT * FROM aa_records WHERE id = ?').get(Number(id))
    if (!existing) {
      res.json({
        success: false,
        error: 'AA record not found',
      })
      return
    }

    db.prepare('DELETE FROM aa_records WHERE id = ?').run(Number(id))

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

router.post('/:id/settle', (req: Request, res: Response): void => {
  try {
    const { id } = req.params

    const existing = db.prepare('SELECT * FROM aa_records WHERE id = ?').get(Number(id))
    if (!existing) {
      res.json({
        success: false,
        error: 'AA record not found',
      })
      return
    }

    db.prepare('UPDATE aa_records SET settled = 1 WHERE id = ?').run(Number(id))

    const record = getAARecordWithMembers(Number(id))

    res.json({
      success: true,
      data: record,
    })
  } catch (error) {
    res.json({
      success: false,
      error: error instanceof Error ? error.message : 'Settle failed',
    })
  }
})

router.post('/:id/unsettle', (req: Request, res: Response): void => {
  try {
    const { id } = req.params

    const existing = db.prepare('SELECT * FROM aa_records WHERE id = ?').get(Number(id))
    if (!existing) {
      res.json({
        success: false,
        error: 'AA record not found',
      })
      return
    }

    db.prepare('UPDATE aa_records SET settled = 0 WHERE id = ?').run(Number(id))

    const record = getAARecordWithMembers(Number(id))

    res.json({
      success: true,
      data: record,
    })
  } catch (error) {
    res.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unsettle failed',
    })
  }
})

router.get('/summary/member/:memberId', (req: Request, res: Response): void => {
  try {
    const { memberId } = req.params

    const receivableRecords = db.prepare(`
      SELECT 
        a.*,
        p.name as payer_name,
        p.avatar as payer_avatar,
        b.name as beneficiary_name,
        b.avatar as beneficiary_avatar
      FROM aa_records a
      LEFT JOIN members p ON a.payer_id = p.id
      LEFT JOIN members b ON a.beneficiary_id = b.id
      WHERE a.beneficiary_id = ? AND a.settled = 0
      ORDER BY a.date DESC, a.id DESC
    `).all(Number(memberId)) as Array<Record<string, unknown>>

    const payableRecords = db.prepare(`
      SELECT 
        a.*,
        p.name as payer_name,
        p.avatar as payer_avatar,
        b.name as beneficiary_name,
        b.avatar as beneficiary_avatar
      FROM aa_records a
      LEFT JOIN members p ON a.payer_id = p.id
      LEFT JOIN members b ON a.beneficiary_id = b.id
      WHERE a.payer_id = ? AND a.settled = 0
      ORDER BY a.date DESC, a.id DESC
    `).all(Number(memberId)) as Array<Record<string, unknown>>

    const formatRecords = (records: Array<Record<string, unknown>>) => {
      return records.map((record) => {
        const { payer_id, payer_name, payer_avatar, beneficiary_id, beneficiary_name, beneficiary_avatar, ...rest } = record
        return {
          ...rest,
          payer: {
            id: payer_id,
            name: payer_name,
            avatar: payer_avatar,
          },
          beneficiary: {
            id: beneficiary_id,
            name: beneficiary_name,
            avatar: beneficiary_avatar,
          },
        }
      })
    }

    const receivableList = formatRecords(receivableRecords)
    const payableList = formatRecords(payableRecords)

    const receivableTotal = receivableRecords.reduce((sum: number, r: Record<string, unknown>) => sum + (r.amount as number), 0)
    const payableTotal = payableRecords.reduce((sum: number, r: Record<string, unknown>) => sum + (r.amount as number), 0)
    const netAmount = receivableTotal - payableTotal

    res.json({
      success: true,
      data: {
        receivable_total: receivableTotal,
        payable_total: payableTotal,
        net_amount: netAmount,
        receivable_list: receivableList,
        payable_list: payableList,
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
