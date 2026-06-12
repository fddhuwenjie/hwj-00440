import { Router, type Request, type Response } from 'express'
import { db } from '../db.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  try {
    const members = db.prepare('SELECT * FROM members ORDER BY id ASC').all()
    res.json({
      success: true,
      data: members,
    })
  } catch (error) {
    res.json({
      success: false,
      error: error instanceof Error ? error.message : '获取成员列表失败',
    })
  }
})

router.get('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const member = db.prepare('SELECT * FROM members WHERE id = ?').get(id) as { id: number; name: string; avatar: string; created_at: string } | undefined
    if (!member) {
      res.json({
        success: false,
        error: '成员不存在',
      })
      return
    }
    res.json({
      success: true,
      data: member,
    })
  } catch (error) {
    res.json({
      success: false,
      error: error instanceof Error ? error.message : '获取成员失败',
    })
  }
})

router.post('/', (req: Request, res: Response): void => {
  try {
    const { name, avatar } = req.body
    if (!name || !avatar) {
      res.json({
        success: false,
        error: '姓名和头像不能为空',
      })
      return
    }
    const result = db
      .prepare('INSERT INTO members (name, avatar) VALUES (?, ?)')
      .run(name, avatar)
    const member = db
      .prepare('SELECT * FROM members WHERE id = ?')
      .get(result.lastInsertRowid)
    res.json({
      success: true,
      data: member,
    })
  } catch (error) {
    res.json({
      success: false,
      error: error instanceof Error ? error.message : '添加成员失败',
    })
  }
})

router.put('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const { name, avatar } = req.body
    const existingMember = db.prepare('SELECT * FROM members WHERE id = ?').get(id) as { id: number; name: string; avatar: string } | undefined
    if (!existingMember) {
      res.json({
        success: false,
        error: '成员不存在',
      })
      return
    }
    const updateName = name ?? existingMember.name
    const updateAvatar = avatar ?? existingMember.avatar
    db.prepare('UPDATE members SET name = ?, avatar = ? WHERE id = ?').run(
      updateName,
      updateAvatar,
      id,
    )
    const member = db.prepare('SELECT * FROM members WHERE id = ?').get(id)
    res.json({
      success: true,
      data: member,
    })
  } catch (error) {
    res.json({
      success: false,
      error: error instanceof Error ? error.message : '更新成员失败',
    })
  }
})

router.delete('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const existingMember = db.prepare('SELECT * FROM members WHERE id = ?').get(id) as { id: number } | undefined
    if (!existingMember) {
      res.json({
        success: false,
        error: '成员不存在',
      })
      return
    }
    db.prepare('DELETE FROM members WHERE id = ?').run(id)
    res.json({
      success: true,
      data: { id: Number(id) },
    })
  } catch (error) {
    res.json({
      success: false,
      error: error instanceof Error ? error.message : '删除成员失败',
    })
  }
})

export default router
