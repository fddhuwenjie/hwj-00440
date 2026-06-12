import { useEffect, useState } from 'react'
import { Check, X, AlertCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface ToastProps {
  message: string
  type?: ToastType
  duration?: number
  onClose: () => void
}

const iconMap = {
  success: Check,
  error: X,
  warning: AlertCircle,
  info: Info,
}

const colorMap = {
  success: 'bg-green-50 text-green-800 border-green-200',
  error: 'bg-red-50 text-red-800 border-red-200',
  warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  info: 'bg-blue-50 text-blue-800 border-blue-200',
}

const iconColorMap = {
  success: 'text-green-600',
  error: 'text-red-600',
  warning: 'text-yellow-600',
  info: 'text-blue-600',
}

export default function Toast({
  message,
  type = 'info',
  duration = 3000,
  onClose,
}: ToastProps) {
  const [visible, setVisible] = useState(true)
  const Icon = iconMap[type]

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onClose, 300)
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  return (
    <div
      className={cn(
        'fixed top-4 right-4 z-50 transition-all duration-300 ease-in-out',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      )}
    >
      <div
        className={cn(
          'flex items-center rounded-lg border px-4 py-3 shadow-lg min-w-72',
          colorMap[type]
        )}
      >
        <Icon className={cn('h-5 w-5 mr-3 flex-shrink-0', iconColorMap[type])} />
        <p className="text-sm font-medium">{message}</p>
        <button
          onClick={() => {
            setVisible(false)
            setTimeout(onClose, 300)
          }}
          className={cn('ml-auto p-1 rounded-full hover:bg-black hover:bg-opacity-10')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
