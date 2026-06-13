const BASE_URL = '/api'

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export interface Member {
  id: number
  name: string
  avatar: string
  created_at: string
}

export interface Tag {
  id: number
  name: string
  color: string
  created_at: string
}

export interface Transaction {
  id: number
  type: 'income' | 'expense'
  amount: number
  category: string
  remark: string | null
  date: string
  member_id: number
  reimbursement_status: 'none' | 'pending' | 'reimbursed'
  receipt_image: string | null
  reimbursed_by: number | null
  reimbursed_at: string | null
  parent_transaction_id: number | null
  is_split: number
  created_at: string
  updated_at: string
  member: Member
  tags: Tag[]
  splits?: TransactionSplit[]
  reimbursed_by_member?: Member
}

export interface TransactionSplit {
  id: number
  member_id: number
  amount: number
  member_name: string
  member_avatar: string
  child_transaction_id: number
}

export interface TransactionListParams {
  type?: string
  category?: string
  member_id?: number
  start_date?: string
  end_date?: string
  tag?: string
  reimbursement_status?: string
  page?: number
  page_size?: number
}

export interface PaginatedResponse<T> {
  list: T[]
  total: number
  page: number
  page_size: number
}

export interface CreateTransactionData {
  type: 'income' | 'expense'
  amount: number
  category: string
  remark?: string
  date: string
  member_id: number
  tags?: string[]
  reimbursement_status?: 'none' | 'pending' | 'reimbursed'
  receipt_image?: string
  goal_id?: number
}

export interface UpdateTransactionData {
  type?: 'income' | 'expense'
  amount?: number
  category?: string
  remark?: string
  date?: string
  member_id?: number
  tags?: string[]
  reimbursement_status?: 'none' | 'pending' | 'reimbursed'
  receipt_image?: string
  goal_id?: number | null
}

export interface SplitTransactionData {
  splits: Array<{ member_id: number; amount: number }>
}

export interface SetReimbursementData {
  status: 'none' | 'pending' | 'reimbursed'
  receipt_image?: string
}

export interface ConfirmReimbursementData {
  confirmed_by_member_id: number
}

export interface BudgetCategoryDetail {
  budget: number
  used: number
  remaining: number
  percentage: number
  status: 'normal' | 'warning' | 'danger'
}

export interface Budget {
  id: number
  month: string
  total_budget: number
  total_used: number
  total_remaining: number
  total_percentage: number
  total_status: 'normal' | 'warning' | 'danger'
  category_budgets: Record<string, BudgetCategoryDetail> | Record<string, number>
  created_at: string
  updated_at: string
}

export interface SaveBudgetData {
  month: string
  total_budget: number
  category_budgets: Record<string, number>
}

export interface OverviewData {
  total_income: number
  total_expense: number
  balance: number
  daily_average: number
  days_in_month: number
}

export interface TrendItem {
  month: string
  income: number
  expense: number
}

export interface CategoryPieItem {
  category: string
  amount: number
  count: number
  percentage: number
}

export interface CategoryPieData {
  total_expense: number
  categories: CategoryPieItem[]
}

export interface TagSummaryItem {
  id: number
  name: string
  color: string
  amount: number
  count: number
  percentage: number
}

export interface TagSummaryData {
  total_expense: number
  tags: TagSummaryItem[]
}

export interface MonthlyComparisonData {
  current_month: string
  previous_month: string
  income: {
    current: number
    previous: number
    change: number
    rate: number
  }
  expense: {
    current: number
    previous: number
    change: number
    rate: number
  }
  categories: Array<{
    category: string
    current: number
    previous: number
    change: number
    rate: number
  }>
}

export interface AARecord {
  id: number
  transaction_id: number | null
  payer_id: number
  beneficiary_id: number
  amount: number
  description: string | null
  date: string
  settled: number
  created_at: string
  payer: Member
  beneficiary: Member
}

export interface AARecordListParams {
  payer_id?: number
  beneficiary_id?: number
  settled?: number
}

export interface CreateAARecordData {
  payer_id: number
  beneficiary_id: number
  amount: number
  description?: string
  date: string
  transaction_id?: number
}

export interface UpdateAARecordData {
  payer_id?: number
  beneficiary_id?: number
  amount?: number
  description?: string
  date?: string
  transaction_id?: number
  settled?: number
}

export interface MemberAASummary {
  receivable_total: number
  payable_total: number
  net_amount: number
  receivable_list: AARecord[]
  payable_list: AARecord[]
}

export interface RecurringTransaction {
  id: number
  type: 'income' | 'expense'
  amount: number
  category: string
  remark: string | null
  member_id: number
  start_date: string
  end_date: string | null
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval: number
  last_generated: string | null
  next_generation: string
  active: number
  created_at: string
}

export interface RecurringListParams {
  active?: boolean
}

export interface CreateRecurringData {
  type: 'income' | 'expense'
  amount: number
  category: string
  remark?: string
  member_id: number
  start_date: string
  end_date?: string
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval?: number
}

export interface UpdateRecurringData {
  type?: 'income' | 'expense'
  amount?: number
  category?: string
  remark?: string
  member_id?: number
  start_date?: string
  end_date?: string
  frequency?: 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval?: number
  active?: boolean
}

export interface ImportResult {
  success_count: number
  fail_count: number
  failures: Array<{
    row: number
    data: Record<string, string>
    reason: string
  }>
}

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${BASE_URL}${url}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    })

    if (!response.ok) {
      try {
        const data = await response.json()
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
        }
      } catch {
        return {
          success: false,
          error: `HTTP ${response.status}`,
        }
      }
    }

    const data = await response.json()
    return data
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    }
  }
}

function buildQueryString(params?: Record<string, unknown> | null): string {
  const searchParams = new URLSearchParams()
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value))
      }
    }
  }
  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

export function getMembers(): Promise<ApiResponse<Member[]>> {
  return request<Member[]>('/members')
}

export function getMember(id: number): Promise<ApiResponse<Member>> {
  return request<Member>(`/members/${id}`)
}

export function createMember(data: {
  name: string
  avatar: string
}): Promise<ApiResponse<Member>> {
  return request<Member>('/members', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateMember(
  id: number,
  data: { name?: string; avatar?: string }
): Promise<ApiResponse<Member>> {
  return request<Member>(`/members/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteMember(id: number): Promise<ApiResponse<{ id: number }>> {
  return request<{ id: number }>(`/members/${id}`, {
    method: 'DELETE',
  })
}

export function getTransactions(
  params?: TransactionListParams
): Promise<ApiResponse<PaginatedResponse<Transaction>>> {
  const query = buildQueryString(params as Record<string, unknown>)
  return request<PaginatedResponse<Transaction>>(`/transactions${query}`)
}

export function getTransaction(
  id: number
): Promise<ApiResponse<Transaction>> {
  return request<Transaction>(`/transactions/${id}`)
}

export function createTransaction(
  data: CreateTransactionData
): Promise<ApiResponse<Transaction>> {
  return request<Transaction>('/transactions', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateTransaction(
  id: number,
  data: UpdateTransactionData
): Promise<ApiResponse<Transaction>> {
  return request<Transaction>(`/transactions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteTransaction(
  id: number
): Promise<ApiResponse<{ id: number }>> {
  return request<{ id: number }>(`/transactions/${id}`, {
    method: 'DELETE',
  })
}

export function getTags(): Promise<ApiResponse<Tag[]>> {
  return request<Tag[]>('/tags')
}

export function createTag(data: {
  name: string
  color?: string
}): Promise<ApiResponse<Tag>> {
  return request<Tag>('/tags', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateTag(
  id: number,
  data: { name?: string; color?: string }
): Promise<ApiResponse<Tag>> {
  return request<Tag>(`/tags/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteTag(id: number): Promise<ApiResponse<{ message: string }>> {
  return request<{ message: string }>(`/tags/${id}`, {
    method: 'DELETE',
  })
}

export function getBudgets(): Promise<ApiResponse<Budget[]>> {
  return request<Budget[]>('/budgets')
}

export function getBudget(month: string): Promise<ApiResponse<Budget | null>> {
  return request<Budget | null>(`/budgets/${month}`)
}

export function saveBudget(
  data: SaveBudgetData
): Promise<ApiResponse<Budget>> {
  return request<Budget>('/budgets', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function getOverview(month: string): Promise<ApiResponse<OverviewData>> {
  const query = buildQueryString({ month })
  return request<OverviewData>(`/statistics/overview${query}`)
}

export function getTrend(months?: number): Promise<ApiResponse<TrendItem[]>> {
  const query = buildQueryString({ months })
  return request<TrendItem[]>(`/statistics/trend${query}`)
}

export function getCategoryPie(
  month: string
): Promise<ApiResponse<CategoryPieData>> {
  const query = buildQueryString({ month })
  return request<CategoryPieData>(`/statistics/category-pie${query}`)
}

export function getTopExpenses(
  month: string,
  limit?: number
): Promise<ApiResponse<Transaction[]>> {
  const query = buildQueryString({ month, limit })
  return request<Transaction[]>(`/statistics/top-expenses${query}`)
}

export function getTagSummary(
  month: string
): Promise<ApiResponse<TagSummaryData>> {
  const query = buildQueryString({ month })
  return request<TagSummaryData>(`/statistics/tag-summary${query}`)
}

export function getMonthlyComparison(
  month: string
): Promise<ApiResponse<MonthlyComparisonData>> {
  const query = buildQueryString({ month })
  return request<MonthlyComparisonData>(`/statistics/monthly-comparison${query}`)
}

export function getAARecords(
  params?: AARecordListParams
): Promise<ApiResponse<AARecord[]>> {
  const query = buildQueryString(params as Record<string, unknown>)
  return request<AARecord[]>(`/aa${query}`)
}

export function getAARecord(id: number): Promise<ApiResponse<AARecord>> {
  return request<AARecord>(`/aa/${id}`)
}

export function createAARecord(
  data: CreateAARecordData
): Promise<ApiResponse<AARecord>> {
  return request<AARecord>('/aa', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateAARecord(
  id: number,
  data: UpdateAARecordData
): Promise<ApiResponse<AARecord>> {
  return request<AARecord>(`/aa/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteAARecord(
  id: number
): Promise<ApiResponse<{ id: number }>> {
  return request<{ id: number }>(`/aa/${id}`, {
    method: 'DELETE',
  })
}

export function settleAARecord(id: number): Promise<ApiResponse<AARecord>> {
  return request<AARecord>(`/aa/${id}/settle`, {
    method: 'POST',
  })
}

export function unsettleAARecord(id: number): Promise<ApiResponse<AARecord>> {
  return request<AARecord>(`/aa/${id}/unsettle`, {
    method: 'POST',
  })
}

export function getMemberAASummary(
  memberId: number
): Promise<ApiResponse<MemberAASummary>> {
  return request<MemberAASummary>(`/aa/summary/member/${memberId}`)
}

export function getRecurring(
  params?: RecurringListParams
): Promise<ApiResponse<RecurringTransaction[]>> {
  const query = buildQueryString(params as Record<string, unknown>)
  return request<RecurringTransaction[]>(`/recurring${query}`)
}

export function getRecurringById(
  id: number
): Promise<ApiResponse<RecurringTransaction>> {
  return request<RecurringTransaction>(`/recurring/${id}`)
}

export function createRecurring(
  data: CreateRecurringData
): Promise<ApiResponse<RecurringTransaction>> {
  return request<RecurringTransaction>('/recurring', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateRecurring(
  id: number,
  data: UpdateRecurringData
): Promise<ApiResponse<RecurringTransaction>> {
  return request<RecurringTransaction>(`/recurring/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteRecurring(
  id: number
): Promise<ApiResponse<{ id: number }>> {
  return request<{ id: number }>(`/recurring/${id}`, {
    method: 'DELETE',
  })
}

export function toggleRecurring(
  id: number
): Promise<ApiResponse<RecurringTransaction>> {
  return request<RecurringTransaction>(`/recurring/${id}/toggle`, {
    method: 'POST',
  })
}

export function generateRecurring(
  id: number
): Promise<ApiResponse<Transaction>> {
  return request<Transaction>(`/recurring/${id}/generate`, {
    method: 'POST',
  })
}

export async function exportCSV(): Promise<ApiResponse<Blob>> {
  try {
    const response = await fetch(`${BASE_URL}/import-export/export/csv`)
    if (!response.ok) {
      try {
        const data = await response.json()
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
        }
      } catch {
        return {
          success: false,
          error: `HTTP ${response.status}`,
        }
      }
    }
    const blob = await response.blob()
    return {
      success: true,
      data: blob,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    }
  }
}

export async function exportJSON(): Promise<ApiResponse<unknown>> {
  return request<unknown>('/import-export/export/json')
}

export async function importCSV(file: File): Promise<ApiResponse<ImportResult>> {
  try {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${BASE_URL}/import-export/import/csv`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      try {
        const data = await response.json()
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
        }
      } catch {
        return {
          success: false,
          error: `HTTP ${response.status}`,
        }
      }
    }

    const data = await response.json()
    return data
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    }
  }
}

export function splitTransaction(
  id: number,
  data: SplitTransactionData
): Promise<ApiResponse<Transaction>> {
  return request<Transaction>(`/transactions/${id}/split`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function setTransactionReimbursement(
  id: number,
  data: SetReimbursementData
): Promise<ApiResponse<Transaction>> {
  return request<Transaction>(`/transactions/${id}/set-reimbursement`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function confirmReimbursement(
  id: number,
  data: ConfirmReimbursementData
): Promise<ApiResponse<Transaction & { offset_transaction_id: number }>> {
  return request<Transaction & { offset_transaction_id: number }>(`/transactions/${id}/confirm-reimbursement`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export interface CategoryPredictionItem {
  category: string
  count: number
  total: number
  confidence: number
}

export interface CategoryPrediction {
  predicted: string
  alternatives: CategoryPredictionItem[]
  all_categories: CategoryPredictionItem[]
}

export function predictCategory(
  remark: string,
  amount?: number,
  type?: 'income' | 'expense'
): Promise<ApiResponse<CategoryPrediction | null>> {
  const params: Record<string, unknown> = { remark }
  if (amount) params.amount = amount
  if (type) params.type = type
  const query = buildQueryString(params)
  return request<CategoryPrediction | null>(`/smart-suggestions/predict-category${query}`)
}

export interface QuickEntry {
  remark: string
  category: string
  type: 'income' | 'expense'
  amount: number
  frequency: number
  member: Member
}

export function getQuickEntries(limit?: number): Promise<ApiResponse<QuickEntry[]>> {
  const params = limit ? { limit } : null
  const query = buildQueryString(params)
  return request<QuickEntry[]>(`/smart-suggestions/quick-entries${query}`)
}

export interface GoalMilestone {
  percentage: number
  label: string
  achieved: boolean
}

export interface FinancialGoal {
  id: number
  name: string
  target_amount: number
  current_amount: number
  deadline: string | null
  description: string | null
  color: string
  icon: string
  auto_track: number
  status: 'active' | 'completed' | 'paused'
  created_at: string
  updated_at: string
  progress_percentage: number
  remaining_amount: number
  monthly_savings_needed: number
  estimated_completion_date: string | null
  milestones: GoalMilestone[]
  transactions?: Array<Record<string, unknown>>
}

export interface CreateGoalData {
  name: string
  target_amount: number
  deadline?: string
  description?: string
  color?: string
  icon?: string
  auto_track?: boolean
}

export interface UpdateGoalData {
  name?: string
  target_amount?: number
  current_amount?: number
  deadline?: string
  description?: string
  color?: string
  icon?: string
  auto_track?: boolean
  status?: 'active' | 'completed' | 'paused'
}

export interface GoalDepositData {
  amount: number
  remark?: string
  transaction_id?: number
}

export interface GoalWithdrawData {
  amount: number
  remark?: string
}

export function getGoals(status?: string): Promise<ApiResponse<FinancialGoal[]>> {
  const params = status ? { status } : null
  const query = buildQueryString(params)
  return request<FinancialGoal[]>(`/goals${query}`)
}

export function getGoal(id: number): Promise<ApiResponse<FinancialGoal>> {
  return request<FinancialGoal>(`/goals/${id}`)
}

export function createGoal(data: CreateGoalData): Promise<ApiResponse<FinancialGoal>> {
  return request<FinancialGoal>('/goals', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateGoal(
  id: number,
  data: UpdateGoalData
): Promise<ApiResponse<FinancialGoal>> {
  return request<FinancialGoal>(`/goals/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteGoal(id: number): Promise<ApiResponse<{ id: number }>> {
  return request<{ id: number }>(`/goals/${id}`, {
    method: 'DELETE',
  })
}

export function depositToGoal(
  id: number,
  data: GoalDepositData
): Promise<ApiResponse<FinancialGoal>> {
  return request<FinancialGoal>(`/goals/${id}/deposit`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function withdrawFromGoal(
  id: number,
  data: GoalWithdrawData
): Promise<ApiResponse<FinancialGoal>> {
  return request<FinancialGoal>(`/goals/${id}/withdraw`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}
