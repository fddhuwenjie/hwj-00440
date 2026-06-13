import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import ConfirmDialog from '@/components/ConfirmDialog'
import Toast from '@/components/Toast'
import Dashboard from '@/pages/Dashboard'
import Transactions from '@/pages/Transactions'
import Members from '@/pages/Members'
import Budget from '@/pages/Budget'
import Statistics from '@/pages/Statistics'
import Recurring from '@/pages/Recurring'
import ImportExport from '@/pages/ImportExport'
import Goals from '@/pages/Goals'
import { useUIStore } from '@/store'

function AppContent() {
  const { confirmDialog, hideConfirm, toast, hideToast } = useUIStore()

  return (
    <>
      <Layout />
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        confirmColor={confirmDialog.confirmColor}
        onConfirm={() => {
          confirmDialog.onConfirm?.()
          hideConfirm()
        }}
        onCancel={hideConfirm}
      />
      {toast.open && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={hideToast}
        />
      )}
    </>
  )
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AppContent />}>
          <Route index element={<Dashboard />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="members" element={<Members />} />
          <Route path="budgets" element={<Budget />} />
          <Route path="statistics" element={<Statistics />} />
          <Route path="recurring" element={<Recurring />} />
          <Route path="import-export" element={<ImportExport />} />
          <Route path="goals" element={<Goals />} />
        </Route>
      </Routes>
    </Router>
  )
}
