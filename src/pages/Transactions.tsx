import { useState, useEffect, useMemo } from 'react'
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
  type Transaction,
  type TransactionListParams,
  type CreateTransactionData,
  type Member,
  type Tag,
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

  const [modalOpen, setModalOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)

  const [formType, setFormType] = useState<'income' | 'expense'>('expense')
  const [formAmount, setFormAmount] = useState<string>('')
  const [formCategory, setFormCategory] = useState<string>(CATEGORIES[0])
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [formMember, setFormMember] = useState<number | ''>('')
  const [formRemark, setFormRemark] = useState<string>('')
  const [selectedTags, setSelectedTags] = useState<number[]>([])
  const [newTagName, setNewTagName] = useState<string>('')

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
  }, [page, typeFilter, categoryFilter, memberFilter, startDate, endDate, tagFilter])

  useEffect(() => {
    fetchMembers()
    fetchTags()
  }, [])

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
    setPage(1)
  }

  const formatAmount = (type: string, amount: number) => {
    const formatted = amount.toFixed(2)
    return type === 'income' ? `+${formatted}` : `-${formatted}`
  }

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
          {(typeFilter || categoryFilter || memberFilter || startDate || endDate || tagFilter) && (
            <button
              onClick={resetFilters}
              className="ml-auto text-sm text-blue-600 hover:text-blue-700"
            >
              重置筛选
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
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
                  标签
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
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(t)}
                        className="text-blue-600 hover:text-blue-900 mr-3 transition-colors"
                      >
                        <Edit2 className="h-4 w-4 inline mr-1" />
                        编辑
                      </button>
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
            <label className="mb-1 block text-sm font-medium text-gray-700">分类</label>
            <select
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
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
              placeholder="请输入备注"
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
    </div>
  )
}
