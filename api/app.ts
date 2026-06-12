/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { initDatabase } from './db.js'
import memberRoutes from './routes/members.js'
import transactionRoutes from './routes/transactions.js'
import tagRoutes from './routes/tags.js'
import budgetRoutes from './routes/budgets.js'
import statisticsRoutes from './routes/statistics.js'
import importExportRoutes from './routes/import-export.js'
import recurringRoutes from './routes/recurring.js'
import aaRoutes from './routes/aa-records.js'
import { checkAndGenerateRecurring } from './services/recurring-service.js'
import cron from 'node-cron'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

initDatabase()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use('/api/members', memberRoutes)
app.use('/api/transactions', transactionRoutes)
app.use('/api/tags', tagRoutes)
app.use('/api/budgets', budgetRoutes)
app.use('/api/statistics', statisticsRoutes)
app.use('/api/import-export', importExportRoutes)
app.use('/api/recurring', recurringRoutes)
app.use('/api/aa', aaRoutes)

checkAndGenerateRecurring()

cron.schedule('0 0 * * *', () => {
  console.log('Running daily recurring transaction check...')
  checkAndGenerateRecurring()
})

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
