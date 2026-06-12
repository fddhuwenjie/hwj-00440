import { useState, useEffect } from 'react'
import ReactECharts from 'echarts-for-react'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  PieChart,
  BarChart3,
  Calendar,
  DollarSign,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import {
  getOverview,
  getTrend,
  getCategoryPie,
  getTopExpenses,
  getTagSummary,
  getMonthlyComparison,
  type OverviewData,
  type TrendItem,
  type CategoryPieData,
  type Transaction,
  type TagSummaryData,
  type MonthlyComparisonData,
} from '@/api'
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

function formatMoney(amount: number): string {
  return `¥${amount.toFixed(2)}`
}

function formatMonth(month: string): string {
  const [year, m] = month.split('-')
  return `${year}年${Number(m)}月`
}

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function getPreviousMonth(month: string): string {
  const [year, monthNum] = month.split('-').map(Number)
  const date = new Date(year, monthNum - 2, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function getNextMonth(month: string): string {
  const [year, monthNum] = month.split('-').map(Number)
  const date = new Date(year, monthNum, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function ChangeIndicator({ rate }: { rate: number }) {
  if (rate > 0) {
    return (
      <span className="flex items-center text-red-500 text-sm">
        <TrendingUp className="w-4 h-4 mr-1" />
        +{rate.toFixed(1)}%
      </span>
    )
  } else if (rate < 0) {
    return (
      <span className="flex items-center text-green-500 text-sm">
        <TrendingDown className="w-4 h-4 mr-1" />
        {rate.toFixed(1)}%
      </span>
    )
  }
  return (
    <span className="flex items-center text-gray-400 text-sm">
      <Minus className="w-4 h-4 mr-1" />
      0.0%
    </span>
  )
}

export default function Statistics() {
  const [month, setMonth] = useState<string>(getCurrentMonth())
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [trend, setTrend] = useState<TrendItem[]>([])
  const [categoryPie, setCategoryPie] = useState<CategoryPieData | null>(null)
  const [topExpenses, setTopExpenses] = useState<Transaction[]>([])
  const [tagSummary, setTagSummary] = useState<TagSummaryData | null>(null)
  const [monthlyComparison, setMonthlyComparison] = useState<MonthlyComparisonData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [
          overviewRes,
          trendRes,
          categoryPieRes,
          topExpensesRes,
          tagSummaryRes,
          monthlyComparisonRes,
        ] = await Promise.all([
          getOverview(month),
          getTrend(6),
          getCategoryPie(month),
          getTopExpenses(month, 5),
          getTagSummary(month),
          getMonthlyComparison(month),
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
        if (topExpensesRes.success && topExpensesRes.data) {
          setTopExpenses(topExpensesRes.data)
        }
        if (tagSummaryRes.success && tagSummaryRes.data) {
          setTagSummary(tagSummaryRes.data)
        }
        if (monthlyComparisonRes.success && monthlyComparisonRes.data) {
          setMonthlyComparison(monthlyComparisonRes.data)
        }
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [month])

  const handlePrevMonth = () => {
    setMonth(getPreviousMonth(month))
  }

  const handleNextMonth = () => {
    const next = getNextMonth(month)
    if (next <= getCurrentMonth()) {
      setMonth(next)
    }
  }

  const trendOption = {
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
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: trend.map((item) => formatMonth(item.month)),
      axisLabel: {
        fontSize: 11,
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => `¥${value}`,
        fontSize: 11,
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
  }

  const pieOption = {
    tooltip: {
      trigger: 'item',
      formatter: ({ name, value, percent }: { name: string; value: number; percent: number }) => {
        return `${name}<br/>金额: ¥${value.toFixed(2)}<br/>占比: ${percent}%`
      },
    },
    legend: {
      orient: 'vertical',
      right: '5%',
      top: 'center',
      itemWidth: 12,
      itemHeight: 12,
      textStyle: {
        fontSize: 12,
      },
    },
    series: [
      {
        name: '支出分类',
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 6,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: {
          show: false,
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold',
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
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">统计分析</h1>
        </div>

        <div className="flex items-center justify-center bg-white rounded-lg border p-3 w-fit">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center mx-4">
            <Calendar className="w-5 h-5 text-blue-600 mr-2" />
            <span className="text-lg font-semibold text-gray-800">
              {formatMonth(month)}
            </span>
          </div>
          <button
            onClick={handleNextMonth}
            disabled={getNextMonth(month) > getCurrentMonth()}
            className={cn(
              'p-2 rounded-lg hover:bg-gray-100 transition-colors',
              getNextMonth(month) > getCurrentMonth()
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-gray-600'
            )}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">总收入</span>
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-1">
                {formatMoney(overview?.total_income || 0)}
              </div>
              {monthlyComparison && (
                <ChangeIndicator rate={monthlyComparison.income.rate} />
              )}
            </div>

            <div className="bg-white rounded-lg border p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">总支出</span>
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-red-600" />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-1">
                {formatMoney(overview?.total_expense || 0)}
              </div>
              {monthlyComparison && (
                <ChangeIndicator rate={monthlyComparison.expense.rate} />
              )}
            </div>

            <div className="bg-white rounded-lg border p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">结余</span>
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <div
                className={cn(
                  'text-2xl font-bold mb-1',
                  (overview?.balance || 0) >= 0
                    ? 'text-green-600'
                    : 'text-red-600'
                )}
              >
                {formatMoney(overview?.balance || 0)}
              </div>
              <span className="text-sm text-gray-400">本月收支差</span>
            </div>

            <div className="bg-white rounded-lg border p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">日均消费</span>
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-purple-600" />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-1">
                {formatMoney(overview?.daily_average || 0)}
              </div>
              <span className="text-sm text-gray-400">
                共 {overview?.days_in_month || 0} 天
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border p-5">
              <div className="flex items-center mb-4">
                <TrendingUp className="w-5 h-5 text-blue-600 mr-2" />
                <h2 className="text-lg font-semibold text-gray-900">
                  收支趋势
                </h2>
              </div>
              <div className="h-72">
                <ReactECharts
                  option={trendOption}
                  style={{ height: '100%', width: '100%' }}
                />
              </div>
            </div>

            <div className="bg-white rounded-lg border p-5">
              <div className="flex items-center mb-4">
                <PieChart className="w-5 h-5 text-purple-600 mr-2" />
                <h2 className="text-lg font-semibold text-gray-900">
                  支出分类占比
                </h2>
              </div>
              <div className="h-72">
                <ReactECharts
                  option={pieOption}
                  style={{ height: '100%', width: '100%' }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border p-5">
              <div className="flex items-center mb-4">
                <BarChart3 className="w-5 h-5 text-orange-600 mr-2" />
                <h2 className="text-lg font-semibold text-gray-900">
                  最大单笔支出 TOP5
                </h2>
              </div>
              <div className="space-y-3">
                {topExpenses.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    暂无支出记录
                  </div>
                ) : (
                  topExpenses.map((expense, index) => (
                    <div
                      key={expense.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center">
                        <div
                          className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold mr-3',
                            index === 0
                              ? 'bg-yellow-500'
                              : index === 1
                              ? 'bg-gray-400'
                              : index === 2
                              ? 'bg-amber-600'
                              : 'bg-gray-300'
                          )}
                        >
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {expense.category}
                          </div>
                          <div className="text-xs text-gray-500">
                            {expense.date} · {expense.member?.name || '未知'}
                            {expense.remark && ` · ${expense.remark}`}
                          </div>
                        </div>
                      </div>
                      <div className="text-red-600 font-semibold">
                        -{formatMoney(expense.amount)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg border p-5">
              <div className="flex items-center mb-4">
                <PieChart className="w-5 h-5 text-green-600 mr-2" />
                <h2 className="text-lg font-semibold text-gray-900">
                  标签汇总
                </h2>
              </div>
              <div className="space-y-3">
                {!tagSummary || tagSummary.tags.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    暂无标签数据
                  </div>
                ) : (
                  tagSummary.tags.map((tag) => (
                    <div key={tag.id}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center">
                          <div
                            className="w-3 h-3 rounded-full mr-2"
                            style={{ backgroundColor: tag.color || '#6b7280' }}
                          />
                          <span className="text-sm text-gray-700">
                            {tag.name}
                          </span>
                        </div>
                        <div className="text-sm text-gray-900 font-medium">
                          {formatMoney(tag.amount)}
                        </div>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(tag.percentage, 100)}%`,
                            backgroundColor: tag.color || '#6b7280',
                          }}
                        />
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
