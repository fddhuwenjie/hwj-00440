import { useState, useRef, useCallback } from 'react'
import {
  Download,
  Upload,
  FileText,
  Check,
  X,
  AlertCircle,
  FileSpreadsheet,
  FileJson,
} from 'lucide-react'
import {
  exportCSV,
  exportJSON,
  importCSV,
  type ImportResult,
} from '@/api'
import { useUIStore } from '@/store'
import { cn } from '@/lib/utils'

const fieldMappings = [
  { source: '交易时间 / 日期', target: 'date', desc: '交易日期' },
  { source: '金额', target: 'amount', desc: '交易金额' },
  { source: '交易类型 / 收/支', target: 'type', desc: '收入 / 支出' },
  { source: '分类 / 类别 / 交易分类 / 商品', target: 'category', desc: '交易分类' },
  { source: '备注 / 说明 / 商品说明', target: 'remark', desc: '备注信息' },
  { source: '记账人 / 成员', target: 'member_id', desc: '成员ID或名称' },
]

export default function ImportExport() {
  const { showToast } = useUIStore()

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState<'csv' | 'json' | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [showFailures, setShowFailures] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      if (file.name.endsWith('.csv')) {
        setSelectedFile(file)
        setImportResult(null)
      } else {
        showToast('请上传 .csv 格式的文件', 'warning')
      }
    }
  }, [showToast])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.name.endsWith('.csv')) {
        setSelectedFile(file)
        setImportResult(null)
      } else {
        showToast('请上传 .csv 格式的文件', 'warning')
      }
    }
  }

  const handleClickUpload = () => {
    fileInputRef.current?.click()
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    setImportResult(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  const handleExportCSV = async () => {
    setExporting('csv')
    try {
      const res = await exportCSV()
      if (res.success && res.data) {
        const url = URL.createObjectURL(res.data)
        const a = document.createElement('a')
        a.href = url
        a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        showToast('CSV 导出成功', 'success')
      } else {
        showToast(res.error || '导出失败', 'error')
      }
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : '导出失败',
        'error'
      )
    } finally {
      setExporting(null)
    }
  }

  const handleExportJSON = async () => {
    setExporting('json')
    try {
      const res = await exportJSON()
      if (res.success && res.data) {
        const jsonStr = JSON.stringify(res.data, null, 2)
        const blob = new Blob([jsonStr], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `transactions_${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        showToast('JSON 导出成功', 'success')
      } else {
        showToast(res.error || '导出失败', 'error')
      }
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : '导出失败',
        'error'
      )
    } finally {
      setExporting(null)
    }
  }

  const handleImportCSV = async () => {
    if (!selectedFile) {
      showToast('请先选择 CSV 文件', 'warning')
      return
    }

    setImporting(true)
    try {
      const res = await importCSV(selectedFile)
      if (res.success && res.data) {
        setImportResult(res.data)
        if (res.data.fail_count === 0) {
          showToast(`导入成功，共 ${res.data.success_count} 条记录`, 'success')
        } else {
          showToast(
            `导入完成：成功 ${res.data.success_count} 条，失败 ${res.data.fail_count} 条`,
            res.data.success_count === 0 ? 'error' : 'warning'
          )
        }
      } else {
        showToast(res.error || '导入失败', 'error')
      }
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : '导入失败',
        'error'
      )
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="p-2 bg-green-50 rounded-lg">
            <Download className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">数据导出</h2>
            <p className="text-sm text-gray-500">导出所有账目信息</p>
          </div>
        </div>

        <div className="p-6">
          <p className="text-sm text-gray-600 mb-6">
            导出的数据包含所有账目记录，包括交易类型、金额、分类、备注、日期、成员等完整信息。
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={handleExportCSV}
              disabled={exporting !== null}
              className="flex items-center justify-center gap-3 px-6 py-4 bg-white border-2 border-green-200 text-green-700 rounded-xl hover:bg-green-50 hover:border-green-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting === 'csv' ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600"></div>
              ) : (
                <FileSpreadsheet className="h-6 w-6" />
              )}
              <div className="text-left">
                <div className="font-medium">导出 CSV</div>
                <div className="text-xs text-green-600">表格格式，兼容 Excel</div>
              </div>
            </button>

            <button
              onClick={handleExportJSON}
              disabled={exporting !== null}
              className="flex items-center justify-center gap-3 px-6 py-4 bg-white border-2 border-blue-200 text-blue-700 rounded-xl hover:bg-blue-50 hover:border-blue-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting === 'json' ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              ) : (
                <FileJson className="h-6 w-6" />
              )}
              <div className="text-left">
                <div className="font-medium">导出 JSON</div>
                <div className="text-xs text-blue-600">结构化数据，开发者友好</div>
              </div>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Upload className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">CSV 导入</h2>
            <p className="text-sm text-gray-500">支持支付宝、微信账单格式自动识别</p>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div
            className={cn(
              'border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer',
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleClickUpload}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            {selectedFile ? (
              <div className="flex flex-col items-center gap-3">
                <div className="p-3 bg-green-100 rounded-full">
                  <FileText className="h-8 w-8 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemoveFile()
                  }}
                  className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
                >
                  <X className="h-4 w-4" />
                  移除文件
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="p-3 bg-gray-100 rounded-full">
                  <Upload className="h-8 w-8 text-gray-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    拖拽文件到此处，或点击选择
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    支持 .csv 格式的账单文件
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-center">
            <button
              onClick={handleImportCSV}
              disabled={!selectedFile || importing}
              className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <Upload className="h-5 w-5" />
              )}
              {importing ? '导入中...' : '开始导入'}
            </button>
          </div>

          {importResult && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">导入结果</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-green-50 rounded-xl p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Check className="h-5 w-5 text-green-600" />
                      <span className="text-2xl font-bold text-green-600">
                        {importResult.success_count}
                      </span>
                    </div>
                    <p className="text-sm text-green-700">成功条数</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-4 text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <X className="h-5 w-5 text-red-600" />
                      <span className="text-2xl font-bold text-red-600">
                        {importResult.fail_count}
                      </span>
                    </div>
                    <p className="text-sm text-red-700">失败条数</p>
                  </div>
                </div>

                {importResult.fail_count > 0 && (
                  <div>
                    <button
                      onClick={() => setShowFailures(!showFailures)}
                      className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      <AlertCircle className="h-4 w-4" />
                      {showFailures ? '收起' : '查看'}失败记录详情
                    </button>

                    {showFailures && (
                      <div className="mt-4 overflow-x-auto max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                行号
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                原始数据
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                错误原因
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {importResult.failures.map((failure, index) => (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">
                                  第 {failure.row} 行
                                </td>
                                <td className="px-4 py-3">
                                  <div className="text-xs text-gray-600 space-y-1 max-w-xs">
                                    {Object.entries(failure.data).slice(0, 3).map(([key, value]) => (
                                      <div key={key} className="truncate">
                                        <span className="text-gray-400">{key}:</span>{' '}
                                        {value || '-'}
                                      </div>
                                    ))}
                                    {Object.keys(failure.data).length > 3 && (
                                      <div className="text-gray-400">
                                        ...还有 {Object.keys(failure.data).length - 3} 个字段
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-red-600 text-xs">
                                  {failure.reason}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <div className="p-2 bg-purple-50 rounded-lg">
            <FileText className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">字段映射说明</h2>
            <p className="text-sm text-gray-500">系统支持自动识别常见账单格式</p>
          </div>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">支持的账单格式</h3>
              <p className="text-sm text-blue-700">
                系统可自动识别支付宝账单、微信账单以及通用 CSV 格式。上传后系统会自动检测并匹配对应字段。
              </p>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 mb-3">字段映射关系</h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        源字段（支持的别名）
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        目标字段
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        说明
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {fieldMappings.map((mapping, index) => (
                      <tr key={index}>
                        <td className="px-4 py-3 text-gray-900">
                          {mapping.source}
                        </td>
                        <td className="px-4 py-3">
                          <code className="bg-gray-100 px-2 py-0.5 rounded text-xs font-mono text-gray-700">
                            {mapping.target}
                          </code>
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {mapping.desc}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">支付宝账单字段</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 交易时间 → date</li>
                  <li>• 金额（元）→ amount</li>
                  <li>• 收/支 → type</li>
                  <li>• 交易分类 → category</li>
                  <li>• 商品说明 → remark</li>
                  <li>• 交易状态（仅成功交易导入）</li>
                </ul>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-2">微信账单字段</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• 交易时间 → date</li>
                  <li>• 金额(元) → amount</li>
                  <li>• 收/支 → type</li>
                  <li>• 交易类型 → category</li>
                  <li>• 交易对方 / 商品 → remark</li>
                  <li>• 当前状态（仅支付成功导入）</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
