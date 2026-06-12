import { db } from '../db.js'

type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

interface RecurringTransaction {
  id: number
  type: string
  amount: number
  category: string
  remark: string | null
  member_id: number
  start_date: string
  end_date: string | null
  frequency: Frequency
  interval: number
  last_generated: string | null
  next_generation: string
  active: number
  created_at: string
}

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function calculateNextGeneration(
  startDate: string,
  frequency: Frequency,
  interval: number,
  lastGenerated?: string
): string {
  const baseDateStr = lastGenerated || startDate
  const date = parseDate(baseDateStr)

  switch (frequency) {
    case 'daily':
      date.setDate(date.getDate() + interval)
      break
    case 'weekly':
      date.setDate(date.getDate() + interval * 7)
      break
    case 'monthly': {
      const originalDay = date.getDate()
      date.setMonth(date.getMonth() + interval)
      if (date.getDate() !== originalDay) {
        date.setDate(0)
      }
      break
    }
    case 'yearly': {
      const originalDay = date.getDate()
      const originalMonth = date.getMonth()
      date.setFullYear(date.getFullYear() + interval)
      if (date.getDate() !== originalDay || date.getMonth() !== originalMonth) {
        date.setDate(0)
      }
      break
    }
  }

  return formatDate(date)
}

export function checkAndGenerateRecurring(): {
  success: boolean
  generated: number
  error?: string
} {
  try {
    const today = formatDate(new Date())

    const stmt = db.prepare(`
      SELECT * FROM recurring_transactions
      WHERE active = 1 AND next_generation <= ?
    `)
    const recurringList = stmt.all(today) as RecurringTransaction[]

    if (recurringList.length === 0) {
      return { success: true, generated: 0 }
    }

    const insertTransaction = db.prepare(`
      INSERT INTO transactions (type, amount, category, remark, date, member_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    const updateRecurring = db.prepare(`
      UPDATE recurring_transactions
      SET last_generated = ?, next_generation = ?, active = ?
      WHERE id = ?
    `)

    let generatedCount = 0

    const transaction = db.transaction(() => {
      for (const recurring of recurringList) {
        const generationDate = recurring.next_generation

        insertTransaction.run(
          recurring.type,
          recurring.amount,
          recurring.category,
          recurring.remark,
          generationDate,
          recurring.member_id
        )

        const nextGen = calculateNextGeneration(
          recurring.start_date,
          recurring.frequency,
          recurring.interval,
          generationDate
        )

        let active = 1
        if (recurring.end_date && nextGen > recurring.end_date) {
          active = 0
        }

        updateRecurring.run(generationDate, nextGen, active, recurring.id)
        generatedCount++
      }
    })

    transaction()

    return { success: true, generated: generatedCount }
  } catch (error) {
    return {
      success: false,
      generated: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
