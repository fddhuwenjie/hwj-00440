import { create } from 'zustand'
import type {
  Member,
  Transaction,
  TransactionListParams,
  PaginatedResponse,
  Tag,
  Budget,
  SaveBudgetData,
} from '@/api'
import {
  getMembers,
  createMember as apiCreateMember,
  updateMember as apiUpdateMember,
  deleteMember as apiDeleteMember,
  getTransactions,
  createTransaction as apiCreateTransaction,
  updateTransaction as apiUpdateTransaction,
  deleteTransaction as apiDeleteTransaction,
  getTags,
  createTag as apiCreateTag,
  updateTag as apiUpdateTag,
  deleteTag as apiDeleteTag,
  getBudget as apiGetBudget,
  saveBudget as apiSaveBudget,
} from '@/api'

interface MemberData {
  name: string
  avatar: string
}

interface TransactionData {
  type: 'income' | 'expense'
  amount: number
  category: string
  remark?: string
  date: string
  member_id: number
  tags?: string[]
}

interface TagData {
  name: string
  color?: string
}

interface MemberState {
  members: Member[]
  loading: boolean
  fetchMembers: () => Promise<void>
  addMember: (data: MemberData) => Promise<Member>
  updateMember: (id: number, data: Partial<MemberData>) => Promise<Member>
  removeMember: (id: number) => Promise<void>
}

interface TransactionState {
  transactions: Transaction[]
  total: number
  page: number
  page_size: number
  loading: boolean
  fetchTransactions: (params?: TransactionListParams) => Promise<void>
  addTransaction: (data: TransactionData) => Promise<Transaction>
  updateTransaction: (id: number, data: Partial<TransactionData>) => Promise<Transaction>
  removeTransaction: (id: number) => Promise<void>
}

interface TagState {
  tags: Tag[]
  loading: boolean
  fetchTags: () => Promise<void>
  addTag: (data: TagData) => Promise<Tag>
  updateTag: (id: number, data: Partial<TagData>) => Promise<Tag>
  removeTag: (id: number) => Promise<void>
}

interface BudgetState {
  currentBudget: Budget | null
  loading: boolean
  fetchBudget: (month: string) => Promise<void>
  saveBudget: (data: SaveBudgetData) => Promise<Budget>
}

interface UIState {
  confirmDialog: {
    open: boolean
    title: string
    message: string
    onConfirm: (() => void) | null
    confirmText?: string
    cancelText?: string
    confirmColor?: 'primary' | 'danger'
  }
  toast: {
    open: boolean
    message: string
    type: 'info' | 'success' | 'warning' | 'error'
  }
  showConfirm: (
    title: string,
    message: string,
    onConfirm: () => void,
    options?: { confirmText?: string; cancelText?: string; confirmColor?: 'primary' | 'danger' }
  ) => void
  hideConfirm: () => void
  showToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void
  hideToast: () => void
}

export const useMemberStore = create<MemberState>((set) => ({
  members: [],
  loading: false,

  fetchMembers: async () => {
    set({ loading: true })
    try {
      const res = await getMembers()
      if (res.success && res.data) {
        set({ members: res.data, loading: false })
      } else {
        throw new Error(res.error || '获取成员列表失败')
      }
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },

  addMember: async (data: MemberData) => {
    set({ loading: true })
    try {
      const res = await apiCreateMember(data)
      if (res.success && res.data) {
        const newMember = res.data
        set((state) => ({
          members: [...state.members, newMember],
          loading: false,
        }))
        return newMember
      } else {
        throw new Error(res.error || '添加成员失败')
      }
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },

  updateMember: async (id: number, data: Partial<MemberData>) => {
    set({ loading: true })
    try {
      const res = await apiUpdateMember(id, data)
      if (res.success && res.data) {
        const updatedMember = res.data
        set((state) => ({
          members: state.members.map((m) => (m.id === id ? updatedMember : m)),
          loading: false,
        }))
        return updatedMember
      } else {
        throw new Error(res.error || '更新成员失败')
      }
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },

  removeMember: async (id: number) => {
    set({ loading: true })
    try {
      const res = await apiDeleteMember(id)
      if (res.success) {
        set((state) => ({
          members: state.members.filter((m) => m.id !== id),
          loading: false,
        }))
      } else {
        throw new Error(res.error || '删除成员失败')
      }
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },
}))

export const useTransactionStore = create<TransactionState>((set) => ({
  transactions: [],
  total: 0,
  page: 1,
  page_size: 20,
  loading: false,

  fetchTransactions: async (params?: TransactionListParams) => {
    set({ loading: true })
    try {
      const res = await getTransactions(params)
      if (res.success && res.data) {
        const result = res.data as PaginatedResponse<Transaction>
        set({
          transactions: result.list,
          total: result.total,
          page: result.page,
          page_size: result.page_size,
          loading: false,
        })
      } else {
        throw new Error(res.error || '获取账目列表失败')
      }
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },

  addTransaction: async (data: TransactionData) => {
    set({ loading: true })
    try {
      const res = await apiCreateTransaction(data)
      if (res.success && res.data) {
        const newTransaction = res.data as Transaction
        set((state) => ({
          transactions: [newTransaction, ...state.transactions],
          total: state.total + 1,
          loading: false,
        }))
        return newTransaction
      } else {
        throw new Error(res.error || '添加账目失败')
      }
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },

  updateTransaction: async (id: number, data: Partial<TransactionData>) => {
    set({ loading: true })
    try {
      const res = await apiUpdateTransaction(id, data)
      if (res.success && res.data) {
        const updatedTransaction = res.data as Transaction
        set((state) => ({
          transactions: state.transactions.map((t) =>
            t.id === id ? updatedTransaction : t
          ),
          loading: false,
        }))
        return updatedTransaction
      } else {
        throw new Error(res.error || '更新账目失败')
      }
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },

  removeTransaction: async (id: number) => {
    set({ loading: true })
    try {
      const res = await apiDeleteTransaction(id)
      if (res.success) {
        set((state) => ({
          transactions: state.transactions.filter((t) => t.id !== id),
          total: state.total - 1,
          loading: false,
        }))
      } else {
        throw new Error(res.error || '删除账目失败')
      }
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },
}))

export const useTagStore = create<TagState>((set) => ({
  tags: [],
  loading: false,

  fetchTags: async () => {
    set({ loading: true })
    try {
      const res = await getTags()
      if (res.success && res.data) {
        set({ tags: res.data, loading: false })
      } else {
        throw new Error(res.error || '获取标签列表失败')
      }
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },

  addTag: async (data: TagData) => {
    set({ loading: true })
    try {
      const res = await apiCreateTag(data)
      if (res.success && res.data) {
        const newTag = res.data as Tag
        set((state) => ({
          tags: [...state.tags, newTag],
          loading: false,
        }))
        return newTag
      } else {
        throw new Error(res.error || '添加标签失败')
      }
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },

  updateTag: async (id: number, data: Partial<TagData>) => {
    set({ loading: true })
    try {
      const res = await apiUpdateTag(id, data)
      if (res.success && res.data) {
        const updatedTag = res.data as Tag
        set((state) => ({
          tags: state.tags.map((t) => (t.id === id ? updatedTag : t)),
          loading: false,
        }))
        return updatedTag
      } else {
        throw new Error(res.error || '更新标签失败')
      }
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },

  removeTag: async (id: number) => {
    set({ loading: true })
    try {
      const res = await apiDeleteTag(id)
      if (res.success) {
        set((state) => ({
          tags: state.tags.filter((t) => t.id !== id),
          loading: false,
        }))
      } else {
        throw new Error(res.error || '删除标签失败')
      }
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },
}))

export const useBudgetStore = create<BudgetState>((set) => ({
  currentBudget: null,
  loading: false,

  fetchBudget: async (month: string) => {
    set({ loading: true })
    try {
      const res = await apiGetBudget(month)
      if (res.success) {
        set({ currentBudget: res.data || null, loading: false })
      } else {
        throw new Error(res.error || '获取预算失败')
      }
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },

  saveBudget: async (data: SaveBudgetData) => {
    set({ loading: true })
    try {
      const res = await apiSaveBudget(data)
      if (res.success && res.data) {
        const budget = res.data as Budget
        set({ currentBudget: budget, loading: false })
        return budget
      } else {
        throw new Error(res.error || '保存预算失败')
      }
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },
}))

export const useUIStore = create<UIState>((set) => ({
  confirmDialog: {
    open: false,
    title: '',
    message: '',
    onConfirm: null,
    confirmText: '确认',
    cancelText: '取消',
    confirmColor: 'primary',
  },
  toast: {
    open: false,
    message: '',
    type: 'info',
  },

  showConfirm: (
    title: string,
    message: string,
    onConfirm: () => void,
    options?: { confirmText?: string; cancelText?: string; confirmColor?: 'primary' | 'danger' }
  ) => {
    set({
      confirmDialog: {
        open: true,
        title,
        message,
        onConfirm,
        confirmText: options?.confirmText || '确认',
        cancelText: options?.cancelText || '取消',
        confirmColor: options?.confirmColor || 'primary',
      },
    })
  },

  hideConfirm: () => {
    set({
      confirmDialog: {
        open: false,
        title: '',
        message: '',
        onConfirm: null,
        confirmText: '确认',
        cancelText: '取消',
        confirmColor: 'primary',
      },
    })
  },

  showToast: (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    set({
      toast: {
        open: true,
        message,
        type,
      },
    })
  },

  hideToast: () => {
    set({
      toast: {
        open: false,
        message: '',
        type: 'info',
      },
    })
  },
}))
