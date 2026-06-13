import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Plus,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  X,
  Tag as TagIcon,
  Calendar,
  User,
  Wallet,
  Scissors,
  FileText,
  CheckCircle2,
  Clock,
  Upload,
  Sparkles,
} from 'lucide-react'
import Modal from '@/components/Modal'
import { useUIStore } from '@/store'
import {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getMembers,
  getTags,
  createTag,
  splitTransaction,
  setTransactionReimbursement,
  confirmReimbursement,
  predictCategory,
  type Transaction,
  type TransactionListParams,
  type CreateTransactionData,
  type Member,
  type Tag,
  type CategoryPrediction,
} from '@/api'
import { cn } from '@/lib/utils'

const CATEGORIES = ['餐饮', '交通', '购物', '医疗', '教育', '娱乐', '居住', '其他']

const COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
]

function getRandomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)]
}

function getReimbursementStatusText(status: string) {
  switch (status) {
    case 'pending':
      return '待报销'
    case 'reimbursed':
      return '已报销'
    default:
      return ''
  }
}

function getReimbursementStatusStyle(status: string) {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800'
    case 'reimbursed':
      return 'bg-green-100 text-green-800'
    default:
      return ''
  }
}

export default function Transactions() {
  const { showConfirm, showToast } = useUIStore()

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [loading, setLoading] = useState(false)

  const [members, setMembers] = useState<Member[]>([])
  const [tags, setTags] = useState<Tag[]>([])

  const [typeFilter, setTypeFilter] = useState<string>('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [memberFilter, setMemberFilter] = useState<number | ''>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [tagFilter, setTagFilter] = useState<string>('')
  const [reimbursementFilter, setReimbursementFilter] = useState<string>('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)

  const [splitModalOpen, setSplitModalOpen] = useState(false)
  const [splittingTransaction, setSplittingTransaction] = useState<Transaction | null>(null)
  const [splitAmounts, setSplitAmounts] = useState<Record<number, number>>({})

  const [reimbursementModalOpen, setReimbursementModalOpen] = useState(false)
  const [reimbursingTransaction, setReimbursingTransaction] = useState<Transaction | null>(null)
  const [receiptImage, setReceiptImage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [confirmReimbursementModalOpen, setConfirmReimbursementModalOpen] = useState(false)
  const [confirmingTransaction, setConfirmingTransaction] = useState<Transaction | null>(null)
  const [confirmingMemberId, setConfirmingMemberId] = useState<number | ''>('')

  const [formType, setFormType] = useState<'income' | 'expense'>('expense')
  const [formAmount, setFormAmount] = useState<string>('')
  const [formCategory, setFormCategory] = useState<string>(CATEGORIES[0])
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [formMember, setFormMember] = useState<number | ''>('')
  const [formRemark, setFormRemark] = useState<string>('')
  const [selectedTags, setSelectedTags] = useState<number[]>([])
  const [newTagName, setNewTagName] = useState<string>('')

  const [categoryPrediction, setCategoryPrediction] = useState<CategoryPrediction | null>(null)
  const predictionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchTransactions = async () => {
    setLoading(true)
    try {
      const params: TransactionListParams = {
        page,
        page_size: pageSize,
      }
      if (typeFilter) params.type = typeFilter
      if (categoryFilter) params.category = categoryFilter
      if (memberFilter !== '') params.member_id = memberFilter
      if (startDate) params.start_date = startDate
      if (endDate) params.end_date = endDate
      if (tagFilter) params.tag = tagFilter
      if (reimbursementFilter) params.reimbursement_status = reimbursementFilter

      const res = await getTransactions(params)
      if (res.success && res.data) {
        setTransactions(res.data.list)
        setTotal(res.data.total)
      } else {
        showToast(res.error || '获取账目列表失败', 'error')
      }
    } catch {
      showToast('获取账目列表失败', 'error')
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

  const fetchTags = async () => {
    try {
      const res = await getTags()
      if (res.success && res.data) {
        setTags(res.data)
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    fetchTransactions()
  }, [page, typeFilter, categoryFilter, memberFilter, startDate, endDate, tagFilter, reimbursementFilter])

  useEffect(() => {
    fetchMembers()
    fetchTags()
  }, [])

  useEffect(() => {
    if (!formRemark.trim()) {
      setCategoryPrediction(null)
      return
    }

    if (predictionTimeoutRef.current) {
      clearTimeout(predictionTimeoutRef.current)
    }

    predictionTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await predictCategory(formRemark, parseFloat(formAmount) || undefined, formType)
        if (res.success && res.data) {
          setCategoryPrediction(res.data)
          if (!editingTransaction) {
            setFormCategory(res.data.predicted)
          }
        } else {
          setCategoryPrediction(null)
        }
      } catch {
        setCategoryPrediction(null)
      }
    }, 300)

    return () => {
      if (predictionTimeoutRef.current) {
        clearTimeout(predictionTimeoutRef.current)
      }
    }
  }, [formRemark, formAmount, formType, editingTransaction])

  const totalPages = useMemo(() => Math.ceil(total / pageSize), [total, pageSize])

  const handleAdd = () => {
    setEditingTransaction(null)
    setFormType('expense')
    setFormAmount('')
    setFormCategory(CATEGORIES[0])
    setFormDate(new Date().toISOString().split('T')[0])
    if (members.length > 0) setFormMember(members[0].id)
    setFormRemark('')
    setSelectedTags([])
    setNewTagName('')
    setCategoryPrediction(null)
    setModalOpen(true)
  }

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction)
    setFormType(transaction.type)
    setFormAmount(String(transaction.amount))
    setFormCategory(transaction.category)
    setFormDate(transaction.date)
    setFormMember(transaction.member_id)
    setFormRemark(transaction.remark || '')
    setSelectedTags(transaction.tags.map((t) => t.id))
    setNewTagName('')
    setCategoryPrediction(null)
    setModalOpen(true)
  }

  const handleDelete = (id: number) => {
    showConfirm('确认删除', '确定要删除这条账目吗？此操作不可恢复。', async () => {
      try {
        const res = await deleteTransaction(id)
        if (res.success) {
          showToast('删除成功', 'success')
          fetchTransactions()
        } else {
          showToast(res.error || '删除失败', 'error')
        }
      } catch {
        showToast('删除失败', 'error')
      }
    })
  }

  const handleSplit = (transaction: Transaction) => {
    if (transaction.type !== 'expense') {
      showToast('仅支持拆分支出账目', 'warning')
      return
    }
    setSplittingTransaction(transaction)
    const initialSplits: Record<number, number> = {}
    members.forEach((m, idx) => {
      if (idx === 0) {
        initialSplits[m.id] = Number(transaction.amount.toFixed(2))
      } else {
        initialSplits[m.id] = 0
      }
    })
    setSplitAmounts(initialSplits)
    setSplitModalOpen(true)
  }

  const handleSplitSubmit = async () => {
    if (!splittingTransaction) return

    const splits = Object.entries(splitAmounts)
      .filter(([, amount]) => amount > 0)
      .map(([memberId, amount]) => ({
        member_id: Number(memberId),
        amount: Number(amount.toFixed(2)),
      }))

    const totalSplit = splits.reduce((sum, s) => sum + s.amount, 0)
    if (Math.abs(totalSplit - splittingTransaction.amount) > 0.01) {
      showToast('拆分金额总和需等于原账目金额', 'warning')
      return
    }

    if (splits.length < 2) {
      showToast('至少需要拆分给2个成员', 'warning')
      return
    }

    try {
      const res = await splitTransaction(splittingTransaction.id, { splits })
      if (res.success) {
        showToast('拆分成功', 'success')
        setSplitModalOpen(false)
        fetchTransactions()
      } else {
        showToast(res.error || '拆分失败', 'error')
      }
    } catch {
      showToast('拆分失败', 'error')
    }
  }

  const handleSetReimbursement = (transaction: Transaction) => {
    setReimbursingTransaction(transaction)
    setReceiptImage(transaction.receipt_image)
    setReimbursementModalOpen(true)
  }

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      setReceiptImage(event.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleSubmitReimbursement = async () => {
    if (!reimbursingTransaction) return

    try {
      const res = await setTransactionReimbursement(reimbursingTransaction.id, {
        status: 'pending',
        receipt_image: receiptImage || undefined,
      })
      if (res.success) {
        showToast('已提交报销申请', 'success')
        setReimbursementModalOpen(false)
        fetchTransactions()
      } else {
        showToast(res.error || '提交失败', 'error')
      }
    } catch {
      showToast('提交失败', 'error')
    }
  }

  const handleConfirmReimbursement = (transaction: Transaction) => {
    setConfirmingTransaction(transaction)
    setConfirmingMemberId(members.find((m) => m.id !== transaction.member_id)?.id || members[0]?.id || '')
    setConfirmReimbursementModalOpen(true)
  }

  const handleSubmitConfirmReimbursement = async () => {
    if (!confirmingTransaction) return
    if (confirmingMemberId === '') {
      showToast('请选择确认人', 'warning')
      return
    }

    try {
      const res = await confirmReimbursement(confirmingTransaction.id, {
        confirmed_by_member_id: Number(confirmingMemberId),
      })
      if (res.success) {
        showToast('报销已确认，已生成冲抵收入记录', 'success')
        setConfirmReimbursementModalOpen(false)
        fetchTransactions()
      } else {
        showToast(res.error || '确认失败', 'error')
      }
    } catch {
      showToast('确认失败', 'error')
    }
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

    const data: CreateTransactionData = {
      type: formType,
      amount: parseFloat(formAmount),
      category: formCategory,
      date: formDate,
      member_id: formMember as number,
      remark: formRemark || undefined,
      tags: selectedTags
        .map((id) => tags.find((t) => t.id === id)?.name)
        .filter(Boolean) as string[],
    }

    try {
      if (editingTransaction) {
        const res = await updateTransaction(editingTransaction.id, data)
        if (res.success) {
          showToast('更新成功', 'success')
          setModalOpen(false)
          fetchTransactions()
        } else {
          showToast(res.error || '更新失败', 'error')
        }
      } else {
        const res = await createTransaction(data)
        if (res.success) {
          showToast('创建成功', 'success')
          setModalOpen(false)
          setPage(1)
          fetchTransactions()
        } else {
          showToast(res.error || '创建失败', 'error')
        }
      }
    } catch {
      showToast(editingTransaction ? '更新失败' : '创建失败', 'error')
    }
  }

  const toggleTag = (tagId: number) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    )
  }

  const handleAddNewTag = async () => {
    if (!newTagName.trim()) return
    try {
      const res = await createTag({ name: newTagName.trim(), color: getRandomColor() })
      if (res.success && res.data) {
        setTags((prev) => [...prev, res.data!])
        setSelectedTags((prev) => [...prev, res.data!.id])
        setNewTagName('')
      }
    } catch {
      // ignore
    }
  }

  const resetFilters = () => {
    setTypeFilter('')
    setCategoryFilter('')
    setMemberFilter('')
    setStartDate('')
    setEndDate('')
    setTagFilter('')
    setReimbursementFilter('')
    setPage(1)
  }

  const formatAmount = (type: string, amount: number) => {
    const formatted = amount.toFixed(2)
    return type === 'income' ? `+${formatted}` : `-${formatted}`
  }

  const totalSplitAmount = useMemo(
    () => Object.values(splitAmounts).reduce((sum, v) => sum + v, 0),
    [splitAmounts]
  )

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">账目管理</h1>
          <p className="mt-1 text-sm text-gray-500">管理您的收入和支出记录</p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="mr-2 h-4 w-4" />
          添加账目
        </button>
      </div>

      <div className="mb-6 rounded-lg border bg-white p-4 shadow-sm">
        <div className="flex items-center mb-4">
          <Filter className="mr-2 h-5 w-5 text-gray-500" />
          <span className="font-medium text-gray-700">筛选条件</span>
          {(typeFilter || categoryFilter || memberFilter || startDate || endDate || tagFilter || reimbursementFilter) && (
            <button
              onClick={resetFilters}
              className="ml-auto text-sm text-blue-600 hover:text-blue-700"
            >
              重置筛选
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">类型</label>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">全部</option>
              <option value="income">收入</option>
              <option value="expense">支出</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">分类</label>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">全部分类</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">记账人</label>
            <select
              value={memberFilter}
              onChange={(e) => {
                setMemberFilter(e.target.value ? Number(e.target.value) : '')
                setPage(1)
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">全部成员</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">开始日期</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">结束日期</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">标签</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={tagFilter}
                onChange={(e) => {
                  setTagFilter(e.target.value)
                  setPage(1)
                }}
                placeholder="输入标签筛选"
                className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">报销状态</label>
            <select
              value={reimbursementFilter}
              onChange={(e) => {
                setReimbursementFilter(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">全部</option>
              <option value="none">无报销</option>
              <option value="pending">待报销</option>
              <option value="reimbursed">已报销</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  日期
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  类型
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  金额
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  分类
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  备注
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  记账人
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  标签/状态
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    加载中...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <Wallet className="mx-auto mb-2 h-12 w-12 text-gray-300" />
                    <p>暂无账目记录</p>
                  </td>
                </tr>
              ) : (
                transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <Calendar className="mr-2 h-4 w-4 text-gray-400" />
                        {t.date}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={cn(
                          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                          t.type === 'income'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        )}
                      >
                        {t.type === 'income' ? '收入' : '支出'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={cn(
                          'text-sm font-semibold',
                          t.type === 'income' ? 'text-green-600' : 'text-red-600'
                        )}
                      >
                        ¥{formatAmount(t.type, t.amount)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {t.category}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {t.remark || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <User className="mr-2 h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-900">{t.member?.name || '-'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {t.reimbursement_status && t.reimbursement_status !== 'none' && (
                          <span
                            className={cn(
                              'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                              getReimbursementStatusStyle(t.reimbursement_status)
                            )}
                          >
                            {t.reimbursement_status === 'pending' ? (
                              <Clock className="mr-1 h-3 w-3" />
                            ) : (
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                            )}
                            {getReimbursementStatusText(t.reimbursement_status)}
                          </span>
                        )}
                        {t.tags && t.tags.length > 0 ? (
                          t.tags.map((tag) => (
                            <span
                              key={tag.id}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                              style={{
                                backgroundColor: `${tag.color}20`,
                                color: tag.color,
                              }}
                            >
                              <TagIcon className="mr-1 h-3 w-3" />
                              {tag.name}
                            </span>
                          ))
                        ) : null}
                        {t.splits && t.splits.length > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            <Scissors className="mr-1 h-3 w-3" />
                            已拆分
                          </span>
                        )}
                        {!t.tags?.length && t.reimbursement_status === 'none' && !t.splits?.length && (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(t)}
                        className="text-blue-600 hover:text-blue-900 mr-2 transition-colors"
                      >
                        <Edit2 className="h-4 w-4 inline mr-1" />
                        编辑
                      </button>
                      {t.type === 'expense' && !t.splits?.length && (
                        <button
                          onClick={() => handleSplit(t)}
                          className="text-purple-600 hover:text-purple-900 mr-2 transition-colors"
                        >
                          <Scissors className="h-4 w-4 inline mr-1" />
                          拆分
                        </button>
                      )}
                      {t.type === 'expense' && t.reimbursement_status === 'none' && (
                        <button
                          onClick={() => handleSetReimbursement(t)}
                          className="text-yellow-600 hover:text-yellow-900 mr-2 transition-colors"
                        >
                          <FileText className="h-4 w-4 inline mr-1" />
                          报销
                        </button>
                      )}
                      {t.reimbursement_status === 'pending' && (
                        <button
                          onClick={() => handleConfirmReimbursement(t)}
                          className="text-green-600 hover:text-green-900 mr-2 transition-colors"
                        >
                          <CheckCircle2 className="h-4 w-4 inline mr-1" />
                          确认报销
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="text-red-600 hover:text-red-900 transition-colors"
                      >
                        <Trash2 className="h-4 w-4 inline mr-1" />
                        删除
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
            <div className="text-sm text-gray-500">
              共 {total} 条记录，第 {page} / {totalPages} 页
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                上一页
              </button>
              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (page <= 3) {
                    pageNum = i + 1
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = page - 2 + i
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={cn(
                        'inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                        page === pageNum
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                      )}
                    >
                      {pageNum}
                    </button>
                  )
                })}
              </div>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                下一页
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        title={editingTransaction ? '编辑账目' : '添加账目'}
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
              {editingTransaction ? '保存' : '创建'}
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
                  onChange={() => setFormType('expense')}
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
                  onChange={() => setFormType('income')}
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
            <label className="mb-1 block text-sm font-medium text-gray-700">
              分类
              {categoryPrediction && (
                <span className="ml-2 inline-flex items-center text-xs text-blue-600">
                  <Sparkles className="mr-1 h-3 w-3" />
                  智能推荐
                </span>
              )}
            </label>
            <select
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                  {categoryPrediction?.predicted === cat ? ' (推荐)' : ''}
                </option>
              ))}
            </select>
            {categoryPrediction?.alternatives && categoryPrediction.alternatives.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {categoryPrediction.alternatives.slice(0, 3).map((alt) => (
                  <button
                    key={alt.category}
                    type="button"
                    onClick={() => setFormCategory(alt.category)}
                    className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                  >
                    {alt.category} ({alt.confidence.toFixed(0)}%)
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">日期</label>
            <input
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
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
              placeholder="请输入备注（输入后将智能推荐分类）"
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">标签</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={cn(
                    'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                    selectedTags.includes(tag.id)
                      ? 'text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  )}
                  style={
                    selectedTags.includes(tag.id)
                      ? { backgroundColor: tag.color }
                      : undefined
                  }
                >
                  {tag.name}
                </button>
              ))}
            </div>
            <div className="flex space-x-2">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddNewTag()
                  }
                }}
                placeholder="输入新标签名称"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleAddNewTag}
                disabled={!newTagName.trim()}
                className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={splitModalOpen}
        title="拆分账目"
        onClose={() => setSplitModalOpen(false)}
        footer={
          <>
            <button
              onClick={() => setSplitModalOpen(false)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSplitSubmit}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              确认拆分
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">原账目金额</span>
              <span className="text-lg font-bold text-red-600">
                ¥{splittingTransaction?.amount.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-sm text-gray-600">已拆分金额</span>
              <span
                className={cn(
                  'text-lg font-bold',
                  Math.abs(totalSplitAmount - (splittingTransaction?.amount || 0)) < 0.01
                    ? 'text-green-600'
                    : 'text-yellow-600'
                )}
              >
                ¥{totalSplitAmount.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-sm text-gray-600">差额</span>
              <span
                className={cn(
                  'text-sm font-medium',
                  Math.abs(totalSplitAmount - (splittingTransaction?.amount || 0)) < 0.01
                    ? 'text-green-600'
                    : 'text-red-600'
                )}
              >
                ¥{(totalSplitAmount - (splittingTransaction?.amount || 0)).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {members.map((member) => (
              <div key={member.id} className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">{member.avatar}</span>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{member.name}</div>
                </div>
                <input
                  type="number"
                  value={splitAmounts[member.id] || 0}
                  onChange={(e) =>
                    setSplitAmounts((prev) => ({
                      ...prev,
                      [member.id]: parseFloat(e.target.value) || 0,
                    }))
                  }
                  step="0.01"
                  min="0"
                  className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-right"
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => {
                if (!splittingTransaction) return
                const avg = splittingTransaction.amount / members.length
                const evenSplits: Record<number, number> = {}
                members.forEach((m, idx) => {
                  if (idx === members.length - 1) {
                    const used = Object.values(evenSplits).reduce((s, v) => s + v, 0)
                    evenSplits[m.id] = Number((splittingTransaction.amount - used).toFixed(2))
                  } else {
                    evenSplits[m.id] = Number(avg.toFixed(2))
                  }
                })
                setSplitAmounts(evenSplits)
              }}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              平均分配
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={reimbursementModalOpen}
        title="申请报销"
        onClose={() => setReimbursementModalOpen(false)}
        footer={
          <>
            <button
              onClick={() => setReimbursementModalOpen(false)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSubmitReimbursement}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              提交报销
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">账目金额</span>
              <span className="text-lg font-bold text-red-600">
                ¥{reimbursingTransaction?.amount.toFixed(2)}
              </span>
            </div>
            <div className="mt-2">
              <span className="text-sm text-gray-600">备注：</span>
              <span className="text-sm text-gray-900 ml-1">
                {reimbursingTransaction?.remark || '无'}
              </span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">上传凭证（可选）</label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleReceiptUpload}
              accept="image/*"
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              {receiptImage ? (
                <div className="relative">
                  <img
                    src={receiptImage}
                    alt="凭证"
                    className="max-h-48 mx-auto rounded"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setReceiptImage(null)
                    }}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div>
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">点击上传凭证图片</p>
                  <p className="text-xs text-gray-400 mt-1">支持 JPG、PNG 格式</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={confirmReimbursementModalOpen}
        title="确认报销"
        onClose={() => setConfirmReimbursementModalOpen(false)}
        footer={
          <>
            <button
              onClick={() => setConfirmReimbursementModalOpen(false)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSubmitConfirmReimbursement}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
            >
              确认报销
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">账目金额</span>
              <span className="text-lg font-bold text-red-600">
                ¥{confirmingTransaction?.amount.toFixed(2)}
              </span>
            </div>
            <div className="mt-2">
              <span className="text-sm text-gray-600">备注：</span>
              <span className="text-sm text-gray-900 ml-1">
                {confirmingTransaction?.remark || '无'}
              </span>
            </div>
            <div className="mt-2">
              <span className="text-sm text-gray-600">申请人：</span>
              <span className="text-sm text-gray-900 ml-1">
                {confirmingTransaction?.member?.name || '未知'}
              </span>
            </div>
            {confirmingTransaction?.receipt_image && (
              <div className="mt-3">
                <span className="text-sm text-gray-600">凭证：</span>
                <img
                  src={confirmingTransaction.receipt_image}
                  alt="报销凭证"
                  className="mt-2 max-h-40 rounded border"
                />
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              确认人（报销付款人）
            </label>
            <select
              value={confirmingMemberId}
              onChange={(e) => setConfirmingMemberId(e.target.value ? Number(e.target.value) : '')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">请选择确认人</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              确认后将自动生成一笔对应的收入冲抵记录给申请人
            </p>
          </div>
        </div>
      </Modal>
    </div>
  )
}
