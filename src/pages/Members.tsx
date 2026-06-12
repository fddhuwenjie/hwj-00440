import { useState, useEffect } from 'react'
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  ArrowLeftRight,
  CreditCard,
  DollarSign,
} from 'lucide-react'
import {
  getMembers,
  createMember,
  updateMember,
  deleteMember,
  getAARecords,
  createAARecord,
  updateAARecord,
  deleteAARecord,
  settleAARecord,
  unsettleAARecord,
  type Member,
  type AARecord,
  type CreateAARecordData,
} from '@/api'
import { useUIStore } from '@/store'
import { cn } from '@/lib/utils'
import Modal from '@/components/Modal'
import ConfirmDialog from '@/components/ConfirmDialog'

const EMOJI_LIST = [
  '👨', '👩', '👦', '👧', '👴', '👵', '🧑', '👱‍♂️', '👱‍♀️',
  '🐱', '🐶', '🐼', '🐨', '🦊', '🦁', '🐯', '🐰', '🐻', '🐸',
]

interface MemberSummary {
  member: Member
  receivable: number
  payable: number
  net: number
}

export default function Members() {
  const { showToast } = useUIStore()

  const [members, setMembers] = useState<Member[]>([])
  const [aaRecords, setAaRecords] = useState<AARecord[]>([])
  const [memberSummaries, setMemberSummaries] = useState<MemberSummary[]>([])

  const [memberModalOpen, setMemberModalOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [memberForm, setMemberForm] = useState({ name: '', avatar: '👨' })

  const [aaModalOpen, setAaModalOpen] = useState(false)
  const [editingAARecord, setEditingAARecord] = useState<AARecord | null>(null)
  const [aaForm, setAaForm] = useState({
    payer_id: 0,
    beneficiary_id: 0,
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
  })

  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean
    type: 'member' | 'aa'
    id: number | null
  }>({ open: false, type: 'member', id: null })

  const [loading, setLoading] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [membersRes, recordsRes] = await Promise.all([
        getMembers(),
        getAARecords(),
      ])
      if (membersRes.success && membersRes.data) {
        setMembers(membersRes.data)
      }
      if (recordsRes.success && recordsRes.data) {
        setAaRecords(recordsRes.data)
      }
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : '加载数据失败',
        'error'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    const summaries: MemberSummary[] = members.map((member) => {
      const receivable = aaRecords
        .filter((r) => r.beneficiary_id === member.id && r.settled === 0)
        .reduce((sum, r) => sum + r.amount, 0)
      const payable = aaRecords
        .filter((r) => r.payer_id === member.id && r.settled === 0)
        .reduce((sum, r) => sum + r.amount, 0)
      return {
        member,
        receivable,
        payable,
        net: receivable - payable,
      }
    })
    setMemberSummaries(summaries)
  }, [members, aaRecords])

  const openAddMemberModal = () => {
    setEditingMember(null)
    setMemberForm({ name: '', avatar: '👨' })
    setMemberModalOpen(true)
  }

  const openEditMemberModal = (member: Member) => {
    setEditingMember(member)
    setMemberForm({ name: member.name, avatar: member.avatar })
    setMemberModalOpen(true)
  }

  const handleSaveMember = async () => {
    if (!memberForm.name.trim()) {
      showToast('请输入成员名称', 'warning')
      return
    }

    try {
      if (editingMember) {
        const res = await updateMember(editingMember.id, memberForm)
        if (res.success && res.data) {
          setMembers((prev) =>
            prev.map((m) => (m.id === editingMember.id ? res.data! : m))
          )
          showToast('成员更新成功', 'success')
        }
      } else {
        const res = await createMember(memberForm)
        if (res.success && res.data) {
          setMembers((prev) => [...prev, res.data!])
          showToast('成员添加成功', 'success')
        }
      }
      setMemberModalOpen(false)
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : '保存失败',
        'error'
      )
    }
  }

  const handleDeleteMember = (id: number) => {
    setDeleteConfirm({ open: true, type: 'member', id })
  }

  const confirmDeleteMember = async () => {
    if (!deleteConfirm.id) return
    try {
      const res = await deleteMember(deleteConfirm.id)
      if (res.success) {
        setMembers((prev) => prev.filter((m) => m.id !== deleteConfirm.id))
        showToast('成员删除成功', 'success')
      }
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : '删除失败',
        'error'
      )
    } finally {
      setDeleteConfirm({ open: false, type: 'member', id: null })
    }
  }

  const openAddAAModal = () => {
    setEditingAARecord(null)
    const firstMemberId = members.length > 0 ? members[0].id : 0
    const secondMemberId = members.length > 1 ? members[1].id : firstMemberId
    setAaForm({
      payer_id: firstMemberId,
      beneficiary_id: secondMemberId,
      amount: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
    })
    setAaModalOpen(true)
  }

  const openEditAAModal = (record: AARecord) => {
    setEditingAARecord(record)
    setAaForm({
      payer_id: record.payer_id,
      beneficiary_id: record.beneficiary_id,
      amount: String(record.amount),
      description: record.description || '',
      date: record.date,
    })
    setAaModalOpen(true)
  }

  const handleSaveAARecord = async () => {
    if (!aaForm.payer_id || !aaForm.beneficiary_id) {
      showToast('请选择付款人和受益人', 'warning')
      return
    }
    if (aaForm.payer_id === aaForm.beneficiary_id) {
      showToast('付款人和受益人不能相同', 'warning')
      return
    }
    if (!aaForm.amount || parseFloat(aaForm.amount) <= 0) {
      showToast('请输入有效金额', 'warning')
      return
    }

    const data: CreateAARecordData = {
      payer_id: aaForm.payer_id,
      beneficiary_id: aaForm.beneficiary_id,
      amount: parseFloat(aaForm.amount),
      description: aaForm.description || undefined,
      date: aaForm.date,
    }

    try {
      if (editingAARecord) {
        const res = await updateAARecord(editingAARecord.id, data)
        if (res.success && res.data) {
          setAaRecords((prev) =>
            prev.map((r) => (r.id === editingAARecord.id ? res.data! : r))
          )
          showToast('AA记录更新成功', 'success')
        }
      } else {
        const res = await createAARecord(data)
        if (res.success && res.data) {
          setAaRecords((prev) => [res.data!, ...prev])
          showToast('AA记录添加成功', 'success')
        }
      }
      setAaModalOpen(false)
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : '保存失败',
        'error'
      )
    }
  }

  const handleDeleteAARecord = (id: number) => {
    setDeleteConfirm({ open: true, type: 'aa', id })
  }

  const confirmDeleteAARecord = async () => {
    if (!deleteConfirm.id) return
    try {
      const res = await deleteAARecord(deleteConfirm.id)
      if (res.success) {
        setAaRecords((prev) => prev.filter((r) => r.id !== deleteConfirm.id))
        showToast('AA记录删除成功', 'success')
      }
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : '删除失败',
        'error'
      )
    } finally {
      setDeleteConfirm({ open: false, type: 'aa', id: null })
    }
  }

  const handleToggleSettle = async (record: AARecord) => {
    try {
      const res = record.settled === 0
        ? await settleAARecord(record.id)
        : await unsettleAARecord(record.id)
      if (res.success && res.data) {
        setAaRecords((prev) =>
          prev.map((r) => (r.id === record.id ? res.data! : r))
        )
        showToast(
          record.settled === 0 ? '已标记为已结算' : '已标记为未结算',
          'success'
        )
      }
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : '操作失败',
        'error'
      )
    }
  }

  const getMemberById = (id: number) => members.find((m) => m.id === id)

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">成员管理</h2>
          </div>
          <button
            onClick={openAddMemberModal}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            添加成员
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-500">加载中...</p>
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">暂无成员，点击上方按钮添加</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="relative group bg-gray-50 hover:bg-gray-100 rounded-xl p-4 transition-colors"
                >
                  <div className="flex flex-col items-center">
                    <div className="text-4xl mb-2">{member.avatar}</div>
                    <span className="text-sm font-medium text-gray-900">
                      {member.name}
                    </span>
                  </div>
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                    <button
                      onClick={() => openEditMemberModal(member)}
                      className="p-1.5 bg-white rounded-md shadow-sm text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteMember(member.id)}
                      className="p-1.5 bg-white rounded-md shadow-sm text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">应收应付汇总</h2>
          </div>
        </div>

        <div className="p-6">
          {memberSummaries.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">暂无汇总数据</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {memberSummaries.map((summary) => (
                <div
                  key={summary.member.id}
                  className="bg-gray-50 rounded-xl p-4"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{summary.member.avatar}</span>
                    <span className="font-medium text-gray-900">
                      {summary.member.name}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">应收</span>
                      <span className="font-medium text-green-600">
                        +¥{summary.receivable.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">应付</span>
                      <span className="font-medium text-red-600">
                        -¥{summary.payable.toFixed(2)}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-gray-200 flex justify-between">
                      <span className="text-sm text-gray-500">净额</span>
                      <span
                        className={cn(
                          'font-semibold',
                          summary.net > 0
                            ? 'text-green-600'
                            : summary.net < 0
                            ? 'text-red-600'
                            : 'text-gray-600'
                        )}
                      >
                        {summary.net >= 0 ? '+' : ''}¥{summary.net.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <ArrowLeftRight className="h-5 w-5 text-purple-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">AA记录</h2>
          </div>
          <button
            onClick={openAddAAModal}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            添加记录
          </button>
        </div>

        <div className="overflow-x-auto">
          {aaRecords.length === 0 ? (
            <div className="text-center py-12">
              <ArrowLeftRight className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">暂无AA记录</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    日期
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    付款人
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    受益人
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    金额
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    描述
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状态
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {aaRecords.map((record) => {
                  const payer = getMemberById(record.payer_id)
                  const beneficiary = getMemberById(record.beneficiary_id)
                  return (
                    <tr
                      key={record.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {record.date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">
                            {payer?.avatar || '❓'}
                          </span>
                          <span className="text-sm text-gray-900">
                            {payer?.name || '未知'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">
                            {beneficiary?.avatar || '❓'}
                          </span>
                          <span className="text-sm text-gray-900">
                            {beneficiary?.name || '未知'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        ¥{record.amount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                        {record.description || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium',
                            record.settled === 1
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          )}
                        >
                          {record.settled === 1 ? (
                            <>
                              <Check className="h-3 w-3" />
                              已结算
                            </>
                          ) : (
                            <>
                              <X className="h-3 w-3" />
                              未结算
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleSettle(record)}
                            className={cn(
                              'p-1.5 rounded-md transition-colors',
                              record.settled === 0
                                ? 'text-green-600 hover:bg-green-50'
                                : 'text-yellow-600 hover:bg-yellow-50'
                            )}
                            title={record.settled === 0 ? '标记已结算' : '标记未结算'}
                          >
                            {record.settled === 0 ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <X className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={() => openEditAAModal(record)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteAARecord(record.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal
        open={memberModalOpen}
        title={editingMember ? '编辑成员' : '添加成员'}
        onClose={() => setMemberModalOpen(false)}
        footer={
          <>
            <button
              onClick={() => setMemberModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSaveMember}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              保存
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              成员名称
            </label>
            <input
              type="text"
              value={memberForm.name}
              onChange={(e) =>
                setMemberForm((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="请输入成员名称"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              选择头像
            </label>
            <div className="grid grid-cols-9 gap-2">
              {EMOJI_LIST.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() =>
                    setMemberForm((prev) => ({ ...prev, avatar: emoji }))
                  }
                  className={cn(
                    'p-2 text-2xl rounded-lg border-2 transition-all',
                    memberForm.avatar === emoji
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={aaModalOpen}
        title={editingAARecord ? '编辑AA记录' : '添加AA记录'}
        onClose={() => setAaModalOpen(false)}
        footer={
          <>
            <button
              onClick={() => setAaModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSaveAARecord}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
            >
              保存
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                付款人
              </label>
              <select
                value={aaForm.payer_id}
                onChange={(e) =>
                  setAaForm((prev) => ({
                    ...prev,
                    payer_id: parseInt(e.target.value),
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-shadow"
              >
                <option value={0}>请选择付款人</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.avatar} {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                受益人
              </label>
              <select
                value={aaForm.beneficiary_id}
                onChange={(e) =>
                  setAaForm((prev) => ({
                    ...prev,
                    beneficiary_id: parseInt(e.target.value),
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-shadow"
              >
                <option value={0}>请选择受益人</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.avatar} {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                金额
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  ¥
                </span>
                <input
                  type="number"
                  value={aaForm.amount}
                  onChange={(e) =>
                    setAaForm((prev) => ({ ...prev, amount: e.target.value }))
                  }
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-shadow"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                日期
              </label>
              <input
                type="date"
                value={aaForm.date}
                onChange={(e) =>
                  setAaForm((prev) => ({ ...prev, date: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-shadow"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              描述
            </label>
            <input
              type="text"
              value={aaForm.description}
              onChange={(e) =>
                setAaForm((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="可选：记录描述"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-shadow"
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteConfirm.open}
        title={deleteConfirm.type === 'member' ? '删除成员' : '删除AA记录'}
        message={
          deleteConfirm.type === 'member'
            ? '确定要删除该成员吗？相关的AA记录将保留。'
            : '确定要删除这条AA记录吗？此操作不可撤销。'
        }
        confirmText="删除"
        cancelText="取消"
        confirmColor="danger"
        onConfirm={
          deleteConfirm.type === 'member'
            ? confirmDeleteMember
            : confirmDeleteAARecord
        }
        onCancel={() =>
          setDeleteConfirm({ open: false, type: 'member', id: null })
        }
      />
    </div>
  )
}
