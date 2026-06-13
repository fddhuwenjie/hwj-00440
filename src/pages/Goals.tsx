import { useState, useEffect } from 'react'
import {
  Plus,
  Target,
  Trash2,
  Edit2,
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  CheckCircle2,
  Pause,
  Play,
  ChevronDown,
  ChevronUp,
  Trophy,
} from 'lucide-react'
import Modal from '@/components/Modal'
import { useUIStore } from '@/store'
import {
  getGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  depositToGoal,
  withdrawFromGoal,
  type FinancialGoal,
  type CreateGoalData,
} from '@/api'
import { cn } from '@/lib/utils'

const GOAL_ICONS = ['🎯', '🏖️', '🏠', '🚗', '💰', '🎓', '💎', '🎁', '📱', '🎮']
const GOAL_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

function formatMoney(amount: number): string {
  return `¥${amount.toFixed(2)}`
}

function formatDate(date: string | null): string {
  if (!date) return '无截止日期'
  return date
}

export default function Goals() {
  const { showConfirm, showToast } = useUIStore()

  const [goals, setGoals] = useState<FinancialGoal[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [expandedGoal, setExpandedGoal] = useState<number | null>(null)

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<FinancialGoal | null>(null)
  const [formName, setFormName] = useState('')
  const [formTargetAmount, setFormTargetAmount] = useState('')
  const [formDeadline, setFormDeadline] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formIcon, setFormIcon] = useState('🎯')
  const [formColor, setFormColor] = useState('#3b82f6')
  const [formAutoTrack, setFormAutoTrack] = useState(false)

  const [depositModalOpen, setDepositModalOpen] = useState(false)
  const [depositGoal, setDepositGoal] = useState<FinancialGoal | null>(null)
  const [depositAmount, setDepositAmount] = useState('')
  const [depositRemark, setDepositRemark] = useState('')
  const [depositType, setDepositType] = useState<'deposit' | 'withdraw'>('deposit')

  const fetchGoals = async () => {
    setLoading(true)
    try {
      const res = await getGoals(statusFilter || undefined)
      if (res.success && res.data) {
        setGoals(res.data)
      } else {
        showToast(res.error || '获取目标列表失败', 'error')
      }
    } catch {
      showToast('获取目标列表失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGoals()
  }, [statusFilter])

  const handleAdd = () => {
    setEditingGoal(null)
    setFormName('')
    setFormTargetAmount('')
    setFormDeadline('')
    setFormDescription('')
    setFormIcon('🎯')
    setFormColor('#3b82f6')
    setFormAutoTrack(false)
    setCreateModalOpen(true)
  }

  const handleEdit = (goal: FinancialGoal) => {
    setEditingGoal(goal)
    setFormName(goal.name)
    setFormTargetAmount(String(goal.target_amount))
    setFormDeadline(goal.deadline || '')
    setFormDescription(goal.description || '')
    setFormIcon(goal.icon)
    setFormColor(goal.color)
    setFormAutoTrack(goal.auto_track === 1)
    setCreateModalOpen(true)
  }

  const handleSubmit = async () => {
    if (!formName.trim()) {
      showToast('请输入目标名称', 'warning')
      return
    }
    if (!formTargetAmount || parseFloat(formTargetAmount) <= 0) {
      showToast('请输入有效的目标金额', 'warning')
      return
    }

    const data: CreateGoalData = {
      name: formName.trim(),
      target_amount: parseFloat(formTargetAmount),
      deadline: formDeadline || undefined,
      description: formDescription.trim() || undefined,
      icon: formIcon,
      color: formColor,
      auto_track: formAutoTrack,
    }

    try {
      if (editingGoal) {
        const res = await updateGoal(editingGoal.id, data)
        if (res.success) {
          showToast('目标已更新', 'success')
          setCreateModalOpen(false)
          fetchGoals()
        } else {
          showToast(res.error || '更新失败', 'error')
        }
      } else {
        const res = await createGoal(data)
        if (res.success) {
          showToast('目标已创建', 'success')
          setCreateModalOpen(false)
          fetchGoals()
        } else {
          showToast(res.error || '创建失败', 'error')
        }
      }
    } catch {
      showToast(editingGoal ? '更新失败' : '创建失败', 'error')
    }
  }

  const handleDelete = (goal: FinancialGoal) => {
    showConfirm('确认删除', `确定要删除目标「${goal.name}」吗？此操作不可恢复。`, async () => {
      try {
        const res = await deleteGoal(goal.id)
        if (res.success) {
          showToast('目标已删除', 'success')
          fetchGoals()
        } else {
          showToast(res.error || '删除失败', 'error')
        }
      } catch {
        showToast('删除失败', 'error')
      }
    })
  }

  const handleToggleStatus = async (goal: FinancialGoal) => {
    const newStatus = goal.status === 'active' ? 'paused' : 'active'
    try {
      const res = await updateGoal(goal.id, { status: newStatus })
      if (res.success) {
        showToast(newStatus === 'paused' ? '目标已暂停' : '目标已恢复', 'success')
        fetchGoals()
      } else {
        showToast(res.error || '操作失败', 'error')
      }
    } catch {
      showToast('操作失败', 'error')
    }
  }

  const openDepositModal = (goal: FinancialGoal, type: 'deposit' | 'withdraw') => {
    setDepositGoal(goal)
    setDepositType(type)
    setDepositAmount('')
    setDepositRemark('')
    setDepositModalOpen(true)
  }

  const handleDepositSubmit = async () => {
    if (!depositGoal) return
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      showToast('请输入有效金额', 'warning')
      return
    }

    try {
      const amount = parseFloat(depositAmount)
      if (depositType === 'withdraw' && amount > depositGoal.current_amount) {
        showToast('提取金额不能超过当前余额', 'warning')
        return
      }

      const res = depositType === 'deposit'
        ? await depositToGoal(depositGoal.id, { amount, remark: depositRemark || undefined })
        : await withdrawFromGoal(depositGoal.id, { amount, remark: depositRemark || undefined })

      if (res.success) {
        const updatedGoal = res.data as FinancialGoal
        showToast(
          depositType === 'deposit' ? `已存入 ${formatMoney(amount)}` : `已提取 ${formatMoney(amount)}`,
          'success'
        )
        setDepositModalOpen(false)
        fetchGoals()

        if (updatedGoal.progress_percentage >= 100 && depositGoal.progress_percentage < 100) {
          showToast(`🎉 恭喜！目标「${updatedGoal.name}」已达成！`, 'success')
        }
      } else {
        showToast(res.error || '操作失败', 'error')
      }
    } catch {
      showToast('操作失败', 'error')
    }
  }

  const getDaysRemaining = (deadline: string | null): number | null => {
    if (!deadline) return null
    const now = new Date()
    const deadlineDate = new Date(deadline)
    const diff = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return diff
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return { text: '进行中', className: 'bg-green-100 text-green-800' }
      case 'completed':
        return { text: '已完成', className: 'bg-blue-100 text-blue-800' }
      case 'paused':
        return { text: '已暂停', className: 'bg-yellow-100 text-yellow-800' }
      default:
        return { text: status, className: 'bg-gray-100 text-gray-800' }
    }
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">家庭财务目标</h1>
          <p className="mt-1 text-sm text-gray-500">设置储蓄目标，跟踪进度达成财务梦想</p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="mr-2 h-4 w-4" />
          新建目标
        </button>
      </div>

      <div className="mb-6 flex items-center gap-2">
        {['', 'active', 'completed', 'paused'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              statusFilter === status
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
            )}
          >
            {status === '' ? '全部' : status === 'active' ? '进行中' : status === 'completed' ? '已完成' : '已暂停'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : goals.length === 0 ? (
        <div className="text-center py-20">
          <Target className="mx-auto mb-4 h-16 w-16 text-gray-300" />
          <p className="text-gray-500 text-lg">暂无财务目标</p>
          <p className="text-gray-400 text-sm mt-1">点击「新建目标」开始规划您的财务梦想</p>
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map((goal) => {
            const isExpanded = expandedGoal === goal.id
            const daysRemaining = getDaysRemaining(goal.deadline)
            const statusBadge = getStatusBadge(goal.status)
            const achievedMilestones = goal.milestones.filter((m) => m.achieved)
            const latestMilestone = [...goal.milestones].reverse().find((m) => m.achieved)

            return (
              <div key={goal.id} className="bg-white rounded-lg border shadow-sm overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                        style={{ backgroundColor: `${goal.color}15` }}
                      >
                        {goal.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-gray-900">{goal.name}</h3>
                          <span className={cn('px-2 py-0.5 rounded text-xs font-medium', statusBadge.className)}>
                            {statusBadge.text}
                          </span>
                        </div>
                        {goal.description && (
                          <p className="text-sm text-gray-500 mt-0.5">{goal.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {goal.status !== 'completed' && (
                        <button
                          onClick={() => handleToggleStatus(goal)}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title={goal.status === 'active' ? '暂停' : '恢复'}
                        >
                          {goal.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(goal)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(goal)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-gray-600">
                        {formatMoney(goal.current_amount)} / {formatMoney(goal.target_amount)}
                      </span>
                      <span className="text-sm font-semibold" style={{ color: goal.color }}>
                        {goal.progress_percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(goal.progress_percentage, 100)}%`,
                          backgroundColor: goal.color,
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-4">
                      <span>剩余 {formatMoney(goal.remaining_amount)}</span>
                      {goal.deadline && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {daysRemaining !== null && daysRemaining > 0
                            ? `还剩${daysRemaining}天`
                            : daysRemaining !== null && daysRemaining <= 0
                            ? '已过期'
                            : formatDate(goal.deadline)}
                        </span>
                      )}
                      {goal.estimated_completion_date && goal.status !== 'completed' && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          预计 {goal.estimated_completion_date} 达成
                        </span>
                      )}
                    </div>
                    {goal.monthly_savings_needed > 0 && goal.status !== 'completed' && (
                      <span>月均需存 {formatMoney(goal.monthly_savings_needed)}</span>
                    )}
                  </div>

                  {achievedMilestones.length > 0 && (
                    <div className="mt-3 flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-yellow-500" />
                      <span className="text-xs text-yellow-700 font-medium">
                        已达成里程碑：{latestMilestone?.label}
                      </span>
                    </div>
                  )}

                  <div className="mt-4 flex items-center gap-2">
                    {goal.status !== 'completed' && (
                      <>
                        <button
                          onClick={() => openDepositModal(goal, 'deposit')}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                        >
                          <TrendingUp className="h-4 w-4" />
                          存入
                        </button>
                        {goal.current_amount > 0 && (
                          <button
                            onClick={() => openDepositModal(goal, 'withdraw')}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                          >
                            <TrendingDown className="h-4 w-4" />
                            提取
                          </button>
                        )}
                      </>
                    )}
                    <button
                      onClick={() => setExpandedGoal(isExpanded ? null : goal.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors ml-auto"
                    >
                      里程碑详情
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t bg-gray-50 px-5 py-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">完成度里程碑</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {goal.milestones.map((milestone) => (
                        <div
                          key={milestone.percentage}
                          className={cn(
                            'flex items-center gap-2 p-3 rounded-lg border',
                            milestone.achieved
                              ? 'bg-green-50 border-green-200'
                              : 'bg-white border-gray-200'
                          )}
                        >
                          {milestone.achieved ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex-shrink-0" />
                          )}
                          <span
                            className={cn(
                              'text-sm font-medium',
                              milestone.achieved ? 'text-green-800' : 'text-gray-500'
                            )}
                          >
                            {milestone.label}
                          </span>
                        </div>
                      ))}
                    </div>

                    {goal.deadline && goal.status === 'active' && (
                      <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
                        <div className="flex items-center gap-2 text-sm text-blue-800">
                          <Clock className="h-4 w-4" />
                          <span>
                            {goal.monthly_savings_needed > 0
                              ? `按当前进度，每月需存入 ${formatMoney(goal.monthly_savings_needed)} 方可在截止日期前达成目标`
                              : '当前余额已满足目标'}
                          </span>
                        </div>
                        {goal.estimated_completion_date && (
                          <div className="mt-1 text-xs text-blue-600 ml-6">
                            预计达成日期：{goal.estimated_completion_date}
                          </div>
                        )}
                      </div>
                    )}

                    {goal.status === 'completed' && (
                      <div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-200">
                        <div className="flex items-center gap-2 text-sm text-green-800">
                          <Trophy className="h-4 w-4" />
                          <span>🎉 目标已达成！恭喜完成「{goal.name}」储蓄目标！</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Modal
        open={createModalOpen}
        title={editingGoal ? '编辑目标' : '新建目标'}
        onClose={() => setCreateModalOpen(false)}
        footer={
          <>
            <button
              onClick={() => setCreateModalOpen(false)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              {editingGoal ? '保存' : '创建'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">目标名称</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="例如：旅游基金"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">目标金额</label>
            <input
              type="number"
              value={formTargetAmount}
              onChange={(e) => setFormTargetAmount(e.target.value)}
              placeholder="请输入目标金额"
              min="0"
              step="100"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">截止日期（可选）</label>
            <input
              type="date"
              value={formDeadline}
              onChange={(e) => setFormDeadline(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">描述（可选）</label>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="关于这个目标的描述"
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">图标</label>
            <div className="flex flex-wrap gap-2">
              {GOAL_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setFormIcon(icon)}
                  className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-all',
                    formIcon === icon
                      ? 'ring-2 ring-blue-500 bg-blue-50'
                      : 'bg-gray-100 hover:bg-gray-200'
                  )}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">颜色</label>
            <div className="flex flex-wrap gap-2">
              {GOAL_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormColor(color)}
                  className={cn(
                    'w-8 h-8 rounded-full transition-all',
                    formColor === color ? 'ring-2 ring-offset-2 ring-blue-500' : 'hover:scale-110'
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formAutoTrack}
                onChange={(e) => setFormAutoTrack(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm font-medium text-gray-700">自动追踪进度</span>
            </label>
            <p className="mt-2 text-xs text-blue-600">
              开启后，将根据家庭总收入减去总支出的结余自动计算目标进度
            </p>
          </div>
        </div>
      </Modal>

      <Modal
        open={depositModalOpen}
        title={depositType === 'deposit' ? '存入资金' : '提取资金'}
        onClose={() => setDepositModalOpen(false)}
        footer={
          <>
            <button
              onClick={() => setDepositModalOpen(false)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleDepositSubmit}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors',
                depositType === 'deposit'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              )}
            >
              确认{depositType === 'deposit' ? '存入' : '提取'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 mb-1">目标：{depositGoal?.name}</div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">当前进度</span>
              <span className="text-sm font-semibold" style={{ color: depositGoal?.color }}>
                {formatMoney(depositGoal?.current_amount || 0)} / {formatMoney(depositGoal?.target_amount || 0)}
              </span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {depositType === 'deposit' ? '存入金额' : '提取金额'}
            </label>
            <input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="请输入金额"
              min="0"
              step="100"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">备注（可选）</label>
            <input
              type="text"
              value={depositRemark}
              onChange={(e) => setDepositRemark(e.target.value)}
              placeholder="例如：本月工资结余"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
