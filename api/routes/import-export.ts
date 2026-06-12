import { Router, type Request, type Response } from 'express'
import multer from 'multer'
import { db } from '../db.js'

const router = Router()

const upload = multer({ storage: multer.memoryStorage() })

interface TransactionExport {
  id: number
  type: string
  amount: number
  category: string
  remark: string | null
  date: string
  member_id: number
  member_name: string
  tags: string
  created_at: string
  updated_at: string
}

interface ImportResult {
  success_count: number
  fail_count: number
  failures: Array<{
    row: number
    data: Record<string, string>
    reason: string
  }>
}

interface CsvFieldMap {
  date: string[]
  amount: string[]
  type: string[]
  category: string[]
  remark: string[]
  member_id: string[]
}

const FIELD_MAPPINGS: CsvFieldMap = {
  date: ['交易时间', '日期', 'date', '时间', '交易创建时间'],
  amount: ['金额', 'amount', '交易金额', '金额(元)', '金额（元）'],
  type: ['交易类型', 'type', '收/支', '收支', '类型'],
  category: ['分类', '类别', 'category', '交易分类', '商品', '交易对方'],
  remark: ['备注', '说明', 'remark', '商品说明', '备注信息'],
  member_id: ['记账人', '成员', 'member_id', '成员名称', '用户'],
}

const ALIPAY_KEYWORDS = ['交易时间', '交易分类', '交易状态', '收/支']
const WECHAT_KEYWORDS = ['交易时间', '交易类型', '交易对方', '商品', '收/支']

function getAllTransactions(): TransactionExport[] {
  const transactions = db.prepare(`
    SELECT 
      t.id,
      t.type,
      t.amount,
      t.category,
      t.remark,
      t.date,
      t.member_id,
      m.name as member_name,
      t.created_at,
      t.updated_at
    FROM transactions t
    LEFT JOIN members m ON t.member_id = m.id
    ORDER BY t.date DESC, t.id DESC
  `).all() as Array<Omit<TransactionExport, 'tags'>>

  return transactions.map((tx) => {
    const tags = db.prepare(`
      SELECT tg.name
      FROM transaction_tags tt
      JOIN tags tg ON tt.tag_id = tg.id
      WHERE tt.transaction_id = ?
    `).all(tx.id) as Array<{ name: string }>

    return {
      ...tx,
      tags: tags.map((t) => t.name).join(';'),
    }
  })
}

function escapeCsvField(field: string | number | null): string {
  if (field === null || field === undefined) return ''
  const str = String(field)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function transactionsToCsv(transactions: TransactionExport[]): string {
  const headers = [
    'ID',
    '类型',
    '金额',
    '分类',
    '备注',
    '日期',
    '成员ID',
    '成员名称',
    '标签',
    '创建时间',
    '更新时间',
  ]

  const rows = transactions.map((tx) => [
    tx.id,
    tx.type === 'income' ? '收入' : '支出',
    tx.amount,
    tx.category,
    tx.remark,
    tx.date,
    tx.member_id,
    tx.member_name,
    tx.tags,
    tx.created_at,
    tx.updated_at,
  ])

  const csvLines = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => escapeCsvField(cell)).join(',')),
  ]

  return csvLines.join('\n')
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
  }

  result.push(current.trim())
  return result
}

function parseCsv(content: string): string[][] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim() !== '')
  return lines.map((line) => parseCsvLine(line))
}

function detectBillFormat(headers: string[]): 'alipay' | 'wechat' | 'general' {
  const headerSet = new Set(headers.map((h) => h.trim()))

  let alipayMatches = 0
  for (const keyword of ALIPAY_KEYWORDS) {
    if (headerSet.has(keyword)) alipayMatches++
  }

  let wechatMatches = 0
  for (const keyword of WECHAT_KEYWORDS) {
    if (headerSet.has(keyword)) wechatMatches++
  }

  if (alipayMatches >= 3) return 'alipay'
  if (wechatMatches >= 3) return 'wechat'
  return 'general'
}

function mapFields(headers: string[], format: string): Record<string, number> {
  const fieldMap: Record<string, number> = {}

  for (const [field, aliases] of Object.entries(FIELD_MAPPINGS)) {
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i].trim()
      if (aliases.some((alias) => alias.toLowerCase() === header.toLowerCase())) {
        fieldMap[field] = i
        break
      }
    }
  }

  return fieldMap
}

function normalizeType(typeValue: string, amount: number): 'income' | 'expense' {
  const lower = typeValue.trim().toLowerCase()

  if (lower === '收入' || lower === '收' || lower === 'income' || lower === 'in') {
    return 'income'
  }
  if (lower === '支出' || lower === '支' || lower === 'expense' || lower === 'out' || lower === '支出') {
    return 'expense'
  }

  return amount >= 0 ? 'expense' : 'income'
}

function parseAmount(amountStr: string): number {
  const cleaned = amountStr.replace(/[¥￥$,，\s]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

function normalizeDate(dateStr: string): string {
  let cleaned = dateStr.trim()

  if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) {
    return cleaned.substring(0, 10)
  }

  if (/^\d{4}\/\d{2}\/\d{2}/.test(cleaned)) {
    return cleaned.replace(/\//g, '-').substring(0, 10)
  }

  if (/^\d{4}年\d{1,2}月\d{1,2}日/.test(cleaned)) {
    const match = cleaned.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/)
    if (match) {
      const year = match[1]
      const month = match[2].padStart(2, '0')
      const day = match[3].padStart(2, '0')
      return `${year}-${month}-${day}`
    }
  }

  const date = new Date(cleaned)
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0]
  }

  return cleaned
}

function getDefaultMemberId(): number {
  const member = db.prepare('SELECT id FROM members ORDER BY id ASC LIMIT 1').get() as
    | { id: number }
    | undefined
  return member?.id ?? 1
}

router.get('/export/csv', (req: Request, res: Response): void => {
  try {
    const transactions = getAllTransactions()
    const csvContent = transactionsToCsv(transactions)

    const filename = `transactions_${new Date().toISOString().split('T')[0]}.csv`

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Length', Buffer.byteLength('\uFEFF' + csvContent, 'utf8'))

    res.send('\uFEFF' + csvContent)
  } catch (error) {
    res.json({
      success: false,
      error: error instanceof Error ? error.message : '导出CSV失败',
    })
  }
})

router.get('/export/json', (req: Request, res: Response): void => {
  try {
    const transactions = getAllTransactions()

    res.json({
      success: true,
      data: transactions,
    })
  } catch (error) {
    res.json({
      success: false,
      error: error instanceof Error ? error.message : '导出JSON失败',
    })
  }
})

router.post(
  '/import/csv',
  upload.single('file'),
  (req: Request, res: Response): void => {
    try {
      if (!req.file) {
        res.json({
          success: false,
          error: '请上传CSV文件',
        })
        return
      }

      const content = req.file.buffer.toString('utf-8')
      const rows = parseCsv(content)

      if (rows.length < 2) {
        res.json({
          success: false,
          error: 'CSV文件内容为空或格式不正确',
        })
        return
      }

      const headers = rows[0]
      const format = detectBillFormat(headers)
      const fieldMap = mapFields(headers, format)

      if (fieldMap.date === undefined || fieldMap.amount === undefined) {
        res.json({
          success: false,
          error: '无法识别必要字段（日期、金额），请检查CSV格式',
        })
        return
      }

      const result: ImportResult = {
        success_count: 0,
        fail_count: 0,
        failures: [],
      }

      const defaultMemberId = getDefaultMemberId()
      const insertStmt = db.prepare(`
        INSERT INTO transactions (type, amount, category, remark, date, member_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `)

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i]
        const rowData: Record<string, string> = {}
        headers.forEach((h, idx) => {
          rowData[h] = row[idx] || ''
        })

        try {
          const dateStr = row[fieldMap.date] || ''
          const amountStr = row[fieldMap.amount] || '0'

          if (!dateStr || !amountStr) {
            throw new Error('日期或金额为空')
          }

          const date = normalizeDate(dateStr)
          let amount = parseAmount(amountStr)

          let type: 'income' | 'expense' = 'expense'
          if (fieldMap.type !== undefined && row[fieldMap.type]) {
            type = normalizeType(row[fieldMap.type], amount)
          } else if (amount < 0) {
            type = 'expense'
            amount = Math.abs(amount)
          }

          let category = '其他'
          if (fieldMap.category !== undefined && row[fieldMap.category]) {
            category = row[fieldMap.category].trim() || '其他'
          }

          let remark = ''
          if (fieldMap.remark !== undefined && row[fieldMap.remark]) {
            remark = row[fieldMap.remark].trim()
          }

          let memberId = defaultMemberId
          if (fieldMap.member_id !== undefined && row[fieldMap.member_id]) {
            const memberValue = row[fieldMap.member_id].trim()
            const memberNum = parseInt(memberValue)
            if (!isNaN(memberNum)) {
              const member = db
                .prepare('SELECT id FROM members WHERE id = ?')
                .get(memberNum) as { id: number } | undefined
              if (member) {
                memberId = member.id
              }
            } else {
              const member = db
                .prepare('SELECT id FROM members WHERE name = ?')
                .get(memberValue) as { id: number } | undefined
              if (member) {
                memberId = member.id
              }
            }
          }

          if (amount <= 0) {
            throw new Error('金额必须大于0')
          }

          if (type !== 'income' && type !== 'expense') {
            throw new Error('交易类型无效')
          }

          insertStmt.run(type, amount, category, remark || null, date, memberId)
          result.success_count++
        } catch (error) {
          result.fail_count++
          result.failures.push({
            row: i + 1,
            data: rowData,
            reason: error instanceof Error ? error.message : '未知错误',
          })
        }
      }

      res.json({
        success: true,
        data: result,
      })
    } catch (error) {
      res.json({
        success: false,
        error: error instanceof Error ? error.message : '导入CSV失败',
      })
    }
  },
)

export default router
