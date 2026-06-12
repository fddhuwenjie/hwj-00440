import { Router, type Request, type Response } from 'express'
import { db } from '../db.js'

const router = Router()

interface Tag {
  id: number
  name: string
  color: string
  created_at: string
}

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const tags = db.prepare('SELECT * FROM tags ORDER BY created_at DESC').all() as Tag[]
    res.json({
      success: true,
      data: tags,
    })
  } catch (error) {
    res.json({
      success: false,
      error: error instanceof Error ? error.message : '获取标签失败',
    })
  }
})

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, color } = req.body

    if (!name || typeof name !== 'string' || name.trim() === '') {
      res.json({
        success: false,
        error: '标签名称不能为空',
      })
      return
    }

    const tagColor = color && typeof color === 'string' ? color : '#3b82f6'

    const existingTag = db.prepare('SELECT id FROM tags WHERE name = ?').get(name)
    if (existingTag) {
      res.json({
        success: false,
        error: '标签名称已存在',
      })
      return
    }

    const result = db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)').run(name.trim(), tagColor)

    const newTag = db.prepare('SELECT * FROM tags WHERE id = ?').get(result.lastInsertRowid) as Tag

    res.json({
      success: true,
      data: newTag,
    })
  } catch (error) {
    res.json({
      success: false,
      error: error instanceof Error ? error.message : '添加标签失败',
    })
  }
})

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { name, color } = req.body

    const tagId = parseInt(id, 10)
    if (isNaN(tagId)) {
      res.json({
        success: false,
        error: '无效的标签ID',
      })
      return
    }

    const existingTag = db.prepare('SELECT id FROM tags WHERE id = ?').get(tagId)
    if (!existingTag) {
      res.json({
        success: false,
        error: '标签不存在',
      })
      return
    }

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim() === '') {
        res.json({
          success: false,
          error: '标签名称不能为空',
        })
        return
      }

      const duplicateTag = db.prepare('SELECT id FROM tags WHERE name = ? AND id != ?').get(name.trim(), tagId)
      if (duplicateTag) {
        res.json({
          success: false,
          error: '标签名称已存在',
        })
        return
      }
    }

    const currentTag = db.prepare('SELECT * FROM tags WHERE id = ?').get(tagId) as Tag
    const updatedName = name !== undefined ? name.trim() : currentTag.name
    const updatedColor = color && typeof color === 'string' ? color : currentTag.color

    db.prepare('UPDATE tags SET name = ?, color = ? WHERE id = ?').run(updatedName, updatedColor, tagId)

    const updatedTag = db.prepare('SELECT * FROM tags WHERE id = ?').get(tagId) as Tag

    res.json({
      success: true,
      data: updatedTag,
    })
  } catch (error) {
    res.json({
      success: false,
      error: error instanceof Error ? error.message : '更新标签失败',
    })
  }
})

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const tagId = parseInt(id, 10)
    if (isNaN(tagId)) {
      res.json({
        success: false,
        error: '无效的标签ID',
      })
      return
    }

    const existingTag = db.prepare('SELECT id FROM tags WHERE id = ?').get(tagId)
    if (!existingTag) {
      res.json({
        success: false,
        error: '标签不存在',
      })
      return
    }

    db.prepare('DELETE FROM tags WHERE id = ?').run(tagId)

    res.json({
      success: true,
      data: { message: '删除成功' },
    })
  } catch (error) {
    res.json({
      success: false,
      error: error instanceof Error ? error.message : '删除标签失败',
    })
  }
})

export default router
