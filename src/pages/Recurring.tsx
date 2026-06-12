import { useState, useEffect } from 'react'
import {
  Calendar,
  Plus,
  Edit2,
  Trash2,
  Play,
  Pause,
  RefreshCw,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  Filter,
  User,
} from 'lucide-react'
import Modal from '@/components/Modal'
import { useUIStore } from '@/store'
import {
  getRecurring,
  createRecurring,
  updateRecurring,
  deleteRecurring,
  toggleRecurring,
  generateRecurring,
  getMembers,
  type RecurringTransaction,
  type CreateRecurringData,
  type UpdateRecurringData,
  type Member,
} from '@/api'
import { cn } from '@/lib/utils'

const INCOME_CATEGORIES = ['工资', '奖金', '兼职', '其他']
const EXPENSE_CATEGORIES = ['餐饮', '交通', '购物', '医疗', '教育', '娱乐', '居住', '其他']

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: '每日' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
  { value: 'yearly', label: '每年' },
]

export default function Recurring() {
  const { showConfirm, showToast } = useUIStore()

  const [recurringList, setRecurringList] = useState<RecurringTransaction[]>([])
  const [loading, setLoading] = useState(false)
  const [members, setMembers] = useState<Member[]>([])

  const [statusFilter, setStatusFilter] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingRecurring, setEditingRecurring] = useState<RecurringTransaction | null>(null)

  const [formType, setFormType] = useState<'income' | 'expense'>('expense')
  const [formAmount, setFormAmount] = useState<string>('')
  const [formCategory, setFormCategory] = useState<string>(EXPENSE_CATEGORIES[0])
  const [formMember, setFormMember] = useState<number | ''>('')
  const [formRemark, setFormRemark] = useState<string>('')
  const [formStartDate, setFormStartDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [formEndDate, setFormEndDate] = useState<string>('')
  const [formFrequency, setFormFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly')
  const [formInterval, setFormInterval] = useState<number>(1)

  const fetchRecurring = async () => {
    setLoading(true)
    try {
      const params: { active?: boolean; type?: string } = {}
      if (statusFilter === 'active') params.active = true
      if (statusFilter === 'paused') params.active = false
      if (typeFilter) params.type = typeFilter

      const res = await getRecurring(params)
      if (res.success && res.data) {
        setRecurringList(res.data)
      } else {
        showToast(res.error || '获取定期账目列表失败', 'error')
      }
    } catch {
      showToast('获取定期账目列表失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  const fetchMembers = async () => {
    try {
      const res = await getMembers()
      if (res.success && res.data) {
        setMembers(res.data)
        if (res.data.length > 0) {
          setFormMember(res.data[0].id)
        }
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    fetchRecurring()
  }, [statusFilter, typeFilter])

  useEffect(() => {
    fetchMembers()
  }, [])

  const handleAdd = () => {
    setEditingRecurring(null)
    setFormType('expense')
    setFormAmount('')
    setFormCategory(EXPENSE_CATEGORIES[0])
    setFormStartDate(new Date().toISOString().split('T')[0])
    setFormEndDate('')
    setFormFrequency('monthly')
    setFormInterval(1)
    if (members.length > 0) setFormMember(members[0].id)
    setFormRemark('')
    setModalOpen(true)
  }

  const handleEdit = (recurring: RecurringTransaction) => {
    setEditingRecurring(recurring)
    setFormType(recurring.type)
    setFormAmount(String(recurring.amount))
    setFormCategory(recurring.category)
    setFormMember(recurring.member_id)
    setFormRemark(recurring.remark || '')
    setFormStartDate(recurring.start_date)
    setFormEndDate(recurring.end_date || '')
    setFormFrequency(recurring.frequency)
    setFormInterval(recurring.interval)
    setModalOpen(true)
  }

  const handleDelete = (id: number) => {
    showConfirm('确认删除', '确定要删除这条定期账目吗？此操作不可恢复。', async () => {
      try {
        const res = await deleteRecurring(id)
        if (res.success) {
          showToast('删除成功', 'success')
          fetchRecurring()
        } else {
          showToast(res.error || '删除失败', 'error')
        }
      } catch {
        showToast('删除失败', 'error')
      }
    })
  }

  const handleToggle = async (id: number) => {
    try {
      const res = await toggleRecurring(id)
      if (res.success) {
        showToast(res.data?.active ? '已恢复' : '已暂停', 'success')
        fetchRecurring()
      } else {
        showToast(res.error || '操作失败', 'error')
      }
    } catch {
      showToast('操作失败', 'error')
    }
  }

  const handleGenerate = async (id: number) => {
    showConfirm('立即生成', '确定要立即生成一笔账目吗？', async () => {
      try {
        const res = await generateRecurring(id)
        if (res.success) {
          showToast('生成成功', 'success')
          fetchRecurring()
        } else {
          showToast(res.error || '生成失败', 'error')
        }
      } catch {
        showToast('生成失败', 'error')
      }
    })
  }

  const handleSubmit = async () => {
    if (!formAmount || parseFloat(formAmount) <= 0) {
      showToast('请输入有效金额', 'warning')
      return
    }
    if (formMember === '') {
      showToast('请选择记账人', 'warning')
      return
    }
    if (!formStartDate) {
      showToast('请选择开始日期', 'warning')
      return
    }
    if (formInterval < 1) {
      showToast('间隔数必须大于0', 'warning')
      return
    }

    const data: CreateRecurringData = {
      type: formType,
      amount: parseFloat(formAmount),
      category: formCategory,
      member_id: formMember as number,
      start_date: formStartDate,
      frequency: formFrequency,
      interval: formInterval,
      remark: formRemark || undefined,
      end_date: formEndDate || undefined,
    }

    try {
      if (editingRecurring) {
        const updateData: UpdateRecurringData = { ...data }
        const res = await updateRecurring(editingRecurring.id, updateData)
        if (res.success) {
          showToast('更新成功', 'success')
          setModalOpen(false)
          fetchRecurring()
        } else {
          showToast(res.error || '更新失败', 'error')
        }
      } else {
        const res = await createRecurring(data)
        if (res.success) {
          showToast('创建成功', 'success')
          setModalOpen(false)
          fetchRecurring()
        } else {
          showToast(res.error || '创建失败', 'error')
        }
      }
    } catch {
      showToast(editingRecurring ? '更新失败' : '创建失败', 'error')
    }
  }

  const resetFilters = () => {
    setStatusFilter('')
    setTypeFilter('')
  }

  const getFrequencyLabel = (frequency: string) => {
    const option = FREQUENCY_OPTIONS.find((o) => o.value === frequency)
    return option ? option.label : frequency
  }

  const categories = formType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">定期账目</h1>
          <p className="mt-1 text-sm text-gray-500">管理您的定期收入和支出</p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="mr-2 h-4 w-4" />
          添加定期账目
        </button>
      </div>

      <div className="mb-6 rounded-lg border bg-white p-4 shadow-sm">
        <div className="flex items-center mb-4">
          <Filter className="mr-2 h-5 w-5 text-gray-500" />
          <span className="font-medium text-gray-700">筛选条件</span>
          {(statusFilter || typeFilter) && (
            <button
              onClick={resetFilters}
              className="ml-auto text-sm text-blue-600 hover:text-blue-700"
            >
              重置筛选
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">状态</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">全部</option>
              <option value="active">活跃</option>
              <option value="paused">暂停</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">类型</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">全部</option>
              <option value="income">收入</option>
              <option value="expense">支出</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-gray-500">
            加载中...
          </div>
        ) : recurringList.length === 0 ? (
          <div className="col-span-full py-12 text-center text-gray-500">
            <DollarSign className="mx-auto mb-2 h-12 w-12 text-gray-300" />
            <p>暂无定期账目</p>
          </div>
        ) : (
          recurringList.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div
                    className={cn(
                      'flex items-center justify-center w-10 h-10 rounded-full',
                      item.type === 'income' ? 'bg-green-100' : 'bg-red-100'
                    )}
                  >
                    <DollarSign
                      className={cn(
                        'h-5 w-5',
                        item.type === 'income' ? 'text-green-600' : 'text-red-600'
                      )}
                    />
                  </div>
                  <div>
                    <div
                      className={cn(
                        'text-lg font-bold',
                        item.type === 'income' ? 'text-green-600' : 'text-red-600'
                      )}
                    >
                      {item.type === 'income' ? '+' : '-'}¥{item.amount.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-500">{item.category}</div>
                  </div>
                </div>
                <span
                  className={cn(
                    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                    item.active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-600'
                  )}
                >
                  {item.active ? (
                    <>
                      <CheckCircle className="mr-1 h-3 w-3" />
                      活跃
                    </>
                  ) : (
                    <>
                      <XCircle className="mr-1 h-3 w-3" />
                      暂停
                    </>
                  )}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center text-sm text-gray-600">
                  <RefreshCw className="mr-2 h-4 w-4 text-gray-400" />
                  <span>
                    {getFrequencyLabel(item.frequency)}
                    {item.interval > 1 && ` (每${item.interval}${item.frequency === 'daily' ? '天' : item.frequency === 'weekly' ? '周' : item.frequency === 'monthly' ? '月' : '年'})`}
                  </span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Calendar className="mr-2 h-4 w-4 text-gray-400" />
                  <span>下次生成: {item.next_generation}</span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <User className="mr-2 h-4 w-4 text-gray-400" />
                  <span>
                    记账人: {members.find((m) => m.id === item.member_id)?.name || '-'}
                  </span>
                </div>
                {item.remark && (
                  <div className="flex items-start text-sm text-gray-600">
                    <Clock className="mr-2 h-4 w-4 text-gray-400 mt-0.5" />
                    <span className="line-clamp-2">{item.remark}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleEdit(item)}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="编辑"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleToggle(item.id)}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      item.active
                        ? 'text-gray-500 hover:text-yellow-600 hover:bg-yellow-50'
                        : 'text-gray-500 hover:text-green-600 hover:bg-green-50'
                    )}
                    title={item.active ? '暂停' : '恢复'}
                  >
                    {item.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => handleGenerate(item.id)}
                    className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                    title="立即生成"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="删除"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        open={modalOpen}
        title={editingRecurring ? '编辑定期账目' : '添加定期账目'}
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <button
              onClick={() => setModalOpen(false)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              {editingRecurring ? '保存' : '创建'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">类型</label>
            <div className="flex space-x-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  value="expense"
                  checked={formType === 'expense'}
                  onChange={() => {
                    setFormType('expense')
                    setFormCategory(EXPENSE_CATEGORIES[0])
                  }}
                  className="h-4 w-4 text-red-600 focus:ring-red-500"
                />
                <span className="ml-2 text-sm text-gray-700">支出</span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  value="income"
                  checked={formType === 'income'}
                  onChange={() => {
                    setFormType('income')
                    setFormCategory(INCOME_CATEGORIES[0])
                  }}
                  className="h-4 w-4 text-green-600 focus:ring-green-500"
                />
                <span className="ml-2 text-sm text-gray-700">收入</span>
              </label>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">金额</label>
            <input
              type="number"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
              placeholder="请输入金额"
              step="0.01"
              min="0"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">分类</label>
            <select
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">记账人</label>
            <select
              value={formMember}
              onChange={(e) => setFormMember(e.target.value ? Number(e.target.value) : '')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">请选择记账人</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">备注</label>
            <textarea
              value={formRemark}
              onChange={(e) => setFormRemark(e.target.value)}
              placeholder="请输入备注"
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">开始日期</label>
              <input
                type="date"
                value={formStartDate}
                onChange={(e) => setFormStartDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">结束日期</label>
              <input
                type="date"
                value={formEndDate}
                onChange={(e) => setFormEndDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">频率</label>
              <select
                value={formFrequency}
                onChange={(e) =>
                  setFormFrequency(e.target.value as 'daily' | 'weekly' | 'monthly' | 'yearly')
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {FREQUENCY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">间隔数</label>
              <input
                type="number"
                value={formInterval}
                onChange={(e) => setFormInterval(Number(e.target.value))}
                min="1"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
