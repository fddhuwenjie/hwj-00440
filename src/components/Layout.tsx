import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  Home,
  Wallet,
  Users,
  PieChart,
  TrendingUp,
  Calendar,
  Download,
  Menu,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { path: '/', label: '首页', icon: Home },
  { path: '/transactions', label: '账目管理', icon: Wallet },
  { path: '/members', label: '成员管理', icon: Users },
  { path: '/budgets', label: '预算管理', icon: PieChart },
  { path: '/statistics', label: '统计分析', icon: TrendingUp },
  { path: '/recurring', label: '定期账目', icon: Calendar },
  { path: '/import-export', label: '数据导入导出', icon: Download },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex h-16 items-center justify-between border-b bg-white px-4 md:hidden">
        <h1 className="text-lg font-bold text-gray-900">家庭记账</h1>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
        >
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <div className="flex">
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-50 w-64 transform border-r bg-white transition-transform duration-300 ease-in-out md:static md:translate-x-0',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="flex h-16 items-center border-b px-6">
            <Wallet className="mr-3 h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">家庭记账</h1>
          </div>

          <nav className="space-y-1 p-4">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center rounded-lg px-4 py-3 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    )
                  }
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {item.label}
                </NavLink>
              )
            })}
          </nav>
        </aside>

        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <main className="flex-1 min-h-screen">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
