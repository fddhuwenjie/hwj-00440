import { useState, useEffect, useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import {
  Wallet,
  Edit,
  Save,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import { useBudgetStore, useUIStore } from '@/store'
import { cn } from '@/lib/utils'
import Modal from '@/components/Modal'
import type { BudgetCategoryDetail } from '@/api'

const CATEGORIES = [
  '餐饮',
  '交通',
  '购物',
  '医疗',
  '教育',
  '娱乐',
  '居住',
  '其他',
]

const DEFAULT_CATEGORY_BUDGETS: Record<string, number> = {
  餐饮: 1500,
  交通: 500,
  购物: 1000,
  医疗: 300,
  教育: 500,
  娱乐: 800,
  居住: 2000,
  其他: 500,
}

function getCurrentMonth(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function formatMonth(month: string): string {
  const [year, m] = month.split('-')
  return `${year}年${parseInt(m)}月`
}

function getStatusColor(status: 'normal' | 'warning' | 'danger'): string {
  switch (status) {
    case 'normal':
      return 'text-green-600'
    case 'warning':
      return 'text-yellow-600'
    case 'danger':
      return 'text-red-600'
  }
}

function getStatusBgColor(status: 'normal' | 'warning' | 'danger'): string {
  switch (status) {
    case 'normal':
      return 'bg-green-500'
    case 'warning':
      return 'bg-yellow-500'
    case 'danger':
      return 'bg-red-500'
  }
}

function getStatusLightBgColor(status: 'normal' | 'warning' | 'danger'): string {
  switch (status) {
    case 'normal':
      return 'bg-green-50'
    case 'warning':
      return 'bg-yellow-50'
    case 'danger':
      return 'bg-red-50'
  }
}

function getStatusIcon(status: 'normal' | 'warning' | 'danger') {
  switch (status) {
    case 'normal':
      return CheckCircle
    case 'warning':
      return AlertTriangle
    case 'danger':
      return XCircle
  }
}

export default function Budget() {
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonth())
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [totalBudgetInput, setTotalBudgetInput] = useState('')
  const [categoryBudgetsInput, setCategoryBudgetsInput] = useState<
    Record<string, string>
  >({})

  const { currentBudget, loading, fetchBudget, saveBudget } = useBudgetStore()
  const { showToast } = useUIStore()

  useEffect(() => {
    fetchBudget(currentMonth)
  }, [currentMonth, fetchBudget])

  const categoryBudgets = useMemo(() => {
    if (!currentBudget?.category_budgets) return {}
    const budgets = currentBudget.category_budgets as Record<
      string,
      BudgetCategoryDetail
    >
    return budgets
  }, [currentBudget])

  const totalPercentage = currentBudget?.total_percentage ?? 0
  const totalStatus = currentBudget?.total_status ?? 'normal'
  const totalUsed = currentBudget?.total_used ?? 0
  const totalBudget = currentBudget?.total_budget ?? 0
  const totalRemaining = currentBudget?.total_remaining ?? 0

  function handlePrevMonth() {
    const [year, month] = currentMonth.split('-').map(Number)
    const date = new Date(year, month - 2, 1)
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    setCurrentMonth(`${y}-${m}`)
  }

  function handleNextMonth() {
    const [year, month] = currentMonth.split('-').map(Number)
    const date = new Date(year, month, 1)
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    setCurrentMonth(`${y}-${m}`)
  }

  function openSettingsModal() {
    const budget = currentBudget?.total_budget ?? 0
    setTotalBudgetInput(String(budget))

    const cats: Record<string, string> = {}
    for (const category of CATEGORIES) {
      const detail = categoryBudgets[category]
      cats[category] = String(detail?.budget ?? DEFAULT_CATEGORY_BUDGETS[category] ?? 0)
    }
    setCategoryBudgetsInput(cats)
    setIsModalOpen(true)
  }

  function handleCategoryBudgetChange(category: string, value: string) {
    setCategoryBudgetsInput((prev) => ({
      ...prev,
      [category]: value,
    }))
  }

  async function handleSaveBudget() {
    const total = parseFloat(totalBudgetInput) || 0
    const cats: Record<string, number> = {}

    for (const category of CATEGORIES) {
      cats[category] = parseFloat(categoryBudgetsInput[category]) || 0
    }

    try {
      await saveBudget({
        month: currentMonth,
        total_budget: total,
        category_budgets: cats,
      })
      showToast('预算保存成功', 'success')
      setIsModalOpen(false)
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : '保存失败',
        'error'
      )
    }
  }

  const chartOption = useMemo(() => {
    const color =
      totalStatus === 'danger'
        ? '#ef4444'
        : totalStatus === 'warning'
          ? '#eab308'
          : '#22c55e'

    return {
      series: [
        {
          type: 'gauge',
          startAngle: 90,
          endAngle: -270,
          pointer: { show: false },
          progress: {
            show: true,
            overlap: false,
            roundCap: true,
            clip: false,
            itemStyle: { color },
            width: 12,
          },
          axisLine: {
            lineStyle: {
              width: 12,
              color: [[1, '#f3f4f6']],
            },
          },
          splitLine: { show: false },
          axisTick: { show: false },
          axisLabel: { show: false },
          data: [
            {
              value: Math.min(totalPercentage, 100),
              name: '已使用',
              title: { show: false },
              detail: { show: false },
            },
          ],
          title: { show: false },
          detail: { show: false },
        },
      ],
    }
  }, [totalPercentage, totalStatus])

  const StatusIcon = getStatusIcon(totalStatus)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Wallet className="h-7 w-7 text-blue-600" />
            预算管理
          </h1>
          <button
            onClick={openSettingsModal}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <Edit className="h-4 w-4" />
            设置预算
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-center gap-4 mb-6">
            <button
              onClick={handlePrevMonth}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div className="text-xl font-semibold text-gray-800 min-w-[140px] text-center">
              {formatMonth(currentMonth)}
            </div>
            <button
              onClick={handleNextMonth}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-center gap-8">
            <div className="relative w-56 h-56">
              <ReactECharts
                option={chartOption}
                style={{ width: '100%', height: '100%' }}
                opts={{ renderer: 'svg' }}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn('text-3xl font-bold', getStatusColor(totalStatus))}>
                  {totalPercentage.toFixed(1)}%
                </span>
                <span className="text-sm text-gray-500 mt-1">已使用</span>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full',
                    getStatusLightBgColor(totalStatus)
                  )}
                >
                  <StatusIcon className={cn('h-5 w-5', getStatusColor(totalStatus))} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">预算状态</p>
                  <p className={cn('font-semibold', getStatusColor(totalStatus))}>
                    {totalStatus === 'normal'
                      ? '正常'
                      : totalStatus === 'warning'
                        ? '警告'
                        : '超支'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">总预算</p>
                  <p className="text-lg font-bold text-gray-900">
                    ¥{totalBudget.toFixed(2)}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">已使用</p>
                  <p className="text-lg font-bold text-blue-600">
                    ¥{totalUsed.toFixed(2)}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 col-span-2">
                  <p className="text-xs text-gray-500 mb-1">剩余</p>
                  <p
                    className={cn(
                      'text-lg font-bold',
                      totalRemaining >= 0 ? 'text-green-600' : 'text-red-600'
                    )}
                  >
                    ¥{totalRemaining.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">分类预算</h2>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-500">加载中...</div>
          ) : (
            <div className="space-y-4">
              {CATEGORIES.map((category) => {
                const detail = categoryBudgets[category]
                const budget = detail?.budget ?? 0
                const used = detail?.used ?? 0
                const remaining = detail?.remaining ?? budget
                const percentage = detail?.percentage ?? 0
                const status = detail?.status ?? 'normal'

                return (
                  <div
                    key={category}
                    className="border border-gray-100 rounded-lg p-4 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-gray-900">{category}</span>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                            getStatusLightBgColor(status),
                            getStatusColor(status)
                          )}
                        >
                          {(() => {
                            const Icon = getStatusIcon(status)
                            return <Icon className="h-3 w-3" />
                          })()}
                          {status === 'normal'
                            ? '正常'
                            : status === 'warning'
                              ? '警告'
                              : '超支'}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">
                          预算: ¥{budget.toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="mb-2">
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-300',
                            getStatusBgColor(status)
                          )}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        已用: <span className="font-medium">¥{used.toFixed(2)}</span>
                      </span>
                      <span
                        className={cn(
                          remaining >= 0 ? 'text-green-600' : 'text-red-600'
                        )}
                      >
                        剩余: ¥{remaining.toFixed(2)} ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={isModalOpen}
        title="预算设置"
        onClose={() => setIsModalOpen(false)}
        footer={
          <>
            <button
              onClick={() => setIsModalOpen(false)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSaveBudget}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <Save className="h-4 w-4" />
              保存
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              月份
            </label>
            <div className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-gray-700">
              {formatMonth(currentMonth)}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              总预算 (元)
            </label>
            <input
              type="number"
              value={totalBudgetInput}
              onChange={(e) => setTotalBudgetInput(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
              placeholder="请输入总预算"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              分类预算 (元)
            </label>
            <div className="grid grid-cols-2 gap-3">
              {CATEGORIES.map((category) => (
                <div key={category}>
                  <label className="block text-xs text-gray-500 mb-1">
                    {category}
                  </label>
                  <input
                    type="number"
                    value={categoryBudgetsInput[category] ?? '0'}
                    onChange={(e) =>
                      handleCategoryBudgetChange(category, e.target.value)
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
