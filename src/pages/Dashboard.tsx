import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  DollarSign,
  PieChart,
  BarChart3,
  Users,
  ChevronRight,
  Calendar,
  Zap,
} from 'lucide-react'
import {
  getOverview,
  getCategoryPie,
  getTrend,
  getTransactions,
  getQuickEntries,
  createTransaction,
  type OverviewData,
  type TrendItem,
  type CategoryPieData,
  type Transaction,
  type Budget,
  type QuickEntry,
} from '@/api'
import { useMemberStore, useBudgetStore, useUIStore } from '@/store'
import { cn } from '@/lib/utils'

const CATEGORY_COLORS: Record<string, string> = {
  餐饮: '#f59e0b',
  交通: '#3b82f6',
  购物: '#8b5cf6',
  医疗: '#ef4444',
  教育: '#10b981',
  娱乐: '#ec4899',
  居住: '#6366f1',
  其他: '#6b7280',
}

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatMoney(amount: number): string {
  return `¥${amount.toFixed(2)}`
}

function formatMonth(month: string): string {
  const [year, m] = month.split('-')
  return `${year}年${Number(m)}月`
}

function getStatusText(status: 'normal' | 'warning' | 'danger'): string {
  switch (status) {
    case 'normal':
      return '正常'
    case 'warning':
      return '警告'
    case 'danger':
      return '危险'
  }
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

export default function Dashboard() {
  const navigate = useNavigate()
  const [month] = useState<string>(getCurrentMonth())
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [trend, setTrend] = useState<TrendItem[]>([])
  const [categoryPie, setCategoryPie] = useState<CategoryPieData | null>(null)
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])
  const [memberExpenses, setMemberExpenses] = useState<Map<number, number>>(new Map())
  const [quickEntries, setQuickEntries] = useState<QuickEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [quickLoading, setQuickLoading] = useState(false)

  const { members, fetchMembers } = useMemberStore()
  const { currentBudget, fetchBudget } = useBudgetStore()
  const { showToast } = useUIStore()

  useEffect(() => {
    fetchMembers()
    fetchBudget(month)
  }, [month, fetchMembers, fetchBudget])

  useEffect(() => {
    const fetchQuickEntries = async () => {
      setQuickLoading(true)
      try {
        const res = await getQuickEntries(5)
        if (res.success && res.data) {
          setQuickEntries(res.data)
        }
      } finally {
        setQuickLoading(false)
      }
    }
    fetchQuickEntries()
  }, [])

  const handleQuickEntry = async (entry: QuickEntry) => {
    try {
      const res = await createTransaction({
        type: entry.type,
        amount: entry.amount,
        category: entry.category,
        remark: entry.remark,
        date: new Date().toISOString().split('T')[0],
        member_id: entry.member.id,
      })
      if (res.success) {
        showToast(`快捷记账成功：${entry.remark} -¥${entry.amount.toFixed(2)}`, 'success')
      } else {
        showToast(res.error || '快捷记账失败', 'error')
      }
    } catch {
      showToast('快捷记账失败', 'error')
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [overviewRes, trendRes, categoryPieRes, transactionsRes] = await Promise.all([
          getOverview(month),
          getTrend(6),
          getCategoryPie(month),
          getTransactions({ page: 1, page_size: 100 }),
        ])

        if (overviewRes.success && overviewRes.data) {
          setOverview(overviewRes.data)
        }
        if (trendRes.success && trendRes.data) {
          setTrend(trendRes.data)
        }
        if (categoryPieRes.success && categoryPieRes.data) {
          setCategoryPie(categoryPieRes.data)
        }
        if (transactionsRes.success && transactionsRes.data) {
          const allTransactions = transactionsRes.data.list
          setRecentTransactions(allTransactions.slice(0, 5))

          const expenses = new Map<number, number>()
          allTransactions.forEach((t) => {
            if (t.type === 'expense' && !t.splits) {
              const current = expenses.get(t.member_id) || 0
              expenses.set(t.member_id, current + t.amount)
            }
          })
          setMemberExpenses(expenses)
        }
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [month])

  const pieOption = useMemo(() => ({
    tooltip: {
      trigger: 'item',
      formatter: ({ name, value, percent }: { name: string; value: number; percent: number }) =>
        `${name}<br/>金额: ¥${value.toFixed(2)}<br/>占比: ${percent}%`,
    },
    legend: {
      show: false,
    },
    series: [
      {
        name: '支出分类',
        type: 'pie',
        radius: ['50%', '75%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 4,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          show: false,
        },
        emphasis: {
          label: {
            show: false,
          },
        },
        labelLine: {
          show: false,
        },
        data: categoryPie?.categories.map((item) => ({
          value: item.amount,
          name: item.category,
          itemStyle: {
            color: CATEGORY_COLORS[item.category] || '#6b7280',
          },
        })) || [],
      },
    ],
  }), [categoryPie])

  const trendOption = useMemo(() => ({
    tooltip: {
      trigger: 'axis',
      formatter: (params: Array<{ seriesName: string; value: number; name: string }>) => {
        let result = `${params[0].name}<br/>`
        params.forEach((item) => {
          result += `${item.seriesName}: ¥${item.value.toFixed(2)}<br/>`
        })
        return result
      },
    },
    legend: {
      data: ['收入', '支出'],
      bottom: 0,
      itemWidth: 12,
      itemHeight: 12,
      textStyle: {
        fontSize: 11,
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '18%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: trend.map((item) => formatMonth(item.month)),
      axisLabel: {
        fontSize: 10,
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => `¥${value}`,
        fontSize: 10,
      },
    },
    series: [
      {
        name: '收入',
        type: 'line',
        smooth: true,
        data: trend.map((item) => item.income),
        lineStyle: {
          color: '#10b981',
          width: 2,
        },
        itemStyle: {
          color: '#10b981',
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(16, 185, 129, 0.3)' },
              { offset: 1, color: 'rgba(16, 185, 129, 0.05)' },
            ],
          },
        },
      },
      {
        name: '支出',
        type: 'line',
        smooth: true,
        data: trend.map((item) => item.expense),
        lineStyle: {
          color: '#ef4444',
          width: 2,
        },
        itemStyle: {
          color: '#ef4444',
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(239, 68, 68, 0.3)' },
              { offset: 1, color: 'rgba(239, 68, 68, 0.05)' },
            ],
          },
        },
      },
    ],
  }), [trend])

  const budget = currentBudget as Budget | null
  const totalBudget = budget?.total_budget ?? 0
  const totalUsed = budget?.total_used ?? 0
  const totalPercentage = budget?.total_percentage ?? 0
  const totalStatus = budget?.total_status ?? 'normal'

  const sortedMemberExpenses = useMemo(() => {
    return members
      .map((member) => ({
        member,
        amount: memberExpenses.get(member.id) || 0,
      }))
      .sort((a, b) => b.amount - a.amount)
  }, [members, memberExpenses])

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">仪表盘</h1>
        <div className="flex items-center text-sm text-gray-500">
          <Calendar className="w-4 h-4 mr-1" />
          <span>{formatMonth(month)}</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="space-y-6">
          {quickEntries.length > 0 && (
            <div className="bg-white rounded-lg border p-5">
              <div className="flex items-center mb-4">
                <Zap className="w-5 h-5 text-yellow-500 mr-2" />
                <h2 className="text-lg font-semibold text-gray-900">快捷记账</h2>
                <span className="ml-2 text-xs text-gray-400">近30天高频账目，一键记账</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {quickEntries.map((entry) => (
                  <button
                    key={`${entry.remark}-${entry.category}-${entry.member.id}`}
                    onClick={() => handleQuickEntry(entry)}
                    disabled={quickLoading}
                    className="flex flex-col items-start p-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all text-left group disabled:opacity-50"
                  >
                    <div className="flex items-center w-full justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900 truncate flex-1">{entry.remark}</span>
                      <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-600">
                        {entry.frequency}次
                      </span>
                    </div>
                    <div className="flex items-center text-xs text-gray-500 mb-1">
                      <span>{entry.category}</span>
                      <span className="mx-1">·</span>
                      <span>{entry.member.name}</span>
                    </div>
                    <div className={cn(
                      'text-base font-bold',
                      entry.type === 'income' ? 'text-green-600' : 'text-red-600'
                    )}>
                      {entry.type === 'income' ? '+' : '-'}¥{entry.amount.toFixed(2)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500">本月收入</span>
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
              </div>
              <div className="text-2xl font-bold text-green-600">
                {formatMoney(overview?.total_income || 0)}
              </div>
            </div>

            <div className="bg-white rounded-lg border p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500">本月支出</span>
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-red-600" />
                </div>
              </div>
              <div className="text-2xl font-bold text-red-600">
                {formatMoney(overview?.total_expense || 0)}
              </div>
            </div>

            <div className="bg-white rounded-lg border p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500">本月结余</span>
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <div
                className={cn(
                  'text-2xl font-bold',
                  (overview?.balance || 0) >= 0 ? 'text-blue-600' : 'text-red-600'
                )}
              >
                {formatMoney(overview?.balance || 0)}
              </div>
            </div>

            <div className="bg-white rounded-lg border p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-500">日均消费</span>
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-purple-600" />
                </div>
              </div>
              <div className="text-2xl font-bold text-purple-600">
                {formatMoney(overview?.daily_average || 0)}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-5">
            <div className="flex items-center mb-4">
              <Wallet className="w-5 h-5 text-blue-600 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">预算概览</h2>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">
                    已用 <span className="font-semibold text-gray-900">{formatMoney(totalUsed)}</span> / {formatMoney(totalBudget)}
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                      getStatusLightBgColor(totalStatus),
                      getStatusColor(totalStatus)
                    )}
                  >
                    {getStatusText(totalStatus)}
                  </span>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', getStatusBgColor(totalStatus))}
                    style={{ width: `${Math.min(totalPercentage, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                  <span>剩余: {formatMoney(Math.max(totalBudget - totalUsed, 0))}</span>
                  <span>{totalPercentage.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <BarChart3 className="w-5 h-5 text-purple-600 mr-2" />
                  <h2 className="text-lg font-semibold text-gray-900">近期账目</h2>
                </div>
                <button
                  onClick={() => navigate('/transactions')}
                  className="flex items-center text-sm text-blue-600 hover:text-blue-700 transition-colors"
                >
                  查看全部
                  <ChevronRight className="w-4 h-4 ml-0.5" />
                </button>
              </div>
              <div className="space-y-3">
                {recentTransactions.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    暂无账目记录
                  </div>
                ) : (
                  recentTransactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center flex-1 min-w-0">
                        <div
                          className={cn(
                            'w-10 h-10 rounded-full flex items-center justify-center mr-3 flex-shrink-0',
                            transaction.type === 'income' ? 'bg-green-100' : 'bg-red-100'
                          )}
                        >
                          {transaction.type === 'income' ? (
                            <TrendingUp className="w-5 h-5 text-green-600" />
                          ) : (
                            <TrendingDown className="w-5 h-5 text-red-600" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-900 truncate">
                            {transaction.category}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center gap-2">
                            <span>{transaction.date}</span>
                            <span>·</span>
                            <span className="truncate">{transaction.member?.name || '未知'}</span>
                          </div>
                        </div>
                      </div>
                      <div
                        className={cn(
                          'font-semibold ml-3 flex-shrink-0',
                          transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                        )}
                      >
                        {transaction.type === 'income' ? '+' : '-'}
                        {formatMoney(transaction.amount)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg border p-5">
              <div className="flex items-center mb-4">
                <PieChart className="w-5 h-5 text-purple-600 mr-2" />
                <h2 className="text-lg font-semibold text-gray-900">支出分类占比</h2>
              </div>
              <div className="h-56">
                <ReactECharts
                  option={pieOption}
                  style={{ height: '100%', width: '100%' }}
                />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2 px-2">
                {categoryPie?.categories.slice(0, 4).map((item) => (
                  <div key={item.category} className="flex items-center text-xs">
                    <div
                      className="w-2.5 h-2.5 rounded-full mr-1.5"
                      style={{ backgroundColor: CATEGORY_COLORS[item.category] || '#6b7280' }}
                    />
                    <span className="text-gray-600">{item.category}</span>
                    <span className="text-gray-400 ml-1">{item.percentage.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border p-5">
              <div className="flex items-center mb-4">
                <TrendingUp className="w-5 h-5 text-blue-600 mr-2" />
                <h2 className="text-lg font-semibold text-gray-900">收支趋势</h2>
              </div>
              <div className="h-56">
                <ReactECharts
                  option={trendOption}
                  style={{ height: '100%', width: '100%' }}
                />
              </div>
            </div>

            <div className="bg-white rounded-lg border p-5">
              <div className="flex items-center mb-4">
                <Users className="w-5 h-5 text-orange-600 mr-2" />
                <h2 className="text-lg font-semibold text-gray-900">成员统计</h2>
              </div>
              <div className="space-y-3">
                {sortedMemberExpenses.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    暂无成员数据
                  </div>
                ) : (
                  sortedMemberExpenses.map(({ member, amount }) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full overflow-hidden mr-3 flex-shrink-0 bg-gray-200">
                          {member.avatar ? (
                            <img
                              src={member.avatar}
                              alt={member.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-500 font-medium">
                              {member.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{member.name}</div>
                          <div className="text-xs text-gray-500">本月支出</div>
                        </div>
                      </div>
                      <div className="text-red-600 font-semibold">
                        {formatMoney(amount)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
