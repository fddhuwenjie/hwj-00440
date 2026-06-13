import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../data/accounting.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      avatar TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      remark TEXT,
      date TEXT NOT NULL,
      member_id INTEGER NOT NULL,
      reimbursement_status TEXT DEFAULT 'none' CHECK(reimbursement_status IN ('none', 'pending', 'reimbursed')),
      receipt_image TEXT,
      reimbursed_by INTEGER,
      reimbursed_at TEXT,
      parent_transaction_id INTEGER,
      is_split INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
      FOREIGN KEY (reimbursed_by) REFERENCES members(id) ON DELETE SET NULL,
      FOREIGN KEY (parent_transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT DEFAULT '#3b82f6',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transaction_tags (
      transaction_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (transaction_id, tag_id),
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL,
      total_budget REAL NOT NULL DEFAULT 0,
      category_budgets TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(month)
    );

    CREATE TABLE IF NOT EXISTS aa_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER,
      payer_id INTEGER NOT NULL,
      beneficiary_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      date TEXT NOT NULL,
      settled INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL,
      FOREIGN KEY (payer_id) REFERENCES members(id) ON DELETE CASCADE,
      FOREIGN KEY (beneficiary_id) REFERENCES members(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS recurring_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      remark TEXT,
      member_id INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT,
      frequency TEXT NOT NULL CHECK(frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
      interval INTEGER DEFAULT 1,
      last_generated TEXT,
      next_generation TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_member ON transactions(member_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
    CREATE INDEX IF NOT EXISTS idx_transactions_reimbursement ON transactions(reimbursement_status);
    CREATE INDEX IF NOT EXISTS idx_transactions_parent ON transactions(parent_transaction_id);
    CREATE INDEX IF NOT EXISTS idx_aa_records_payer ON aa_records(payer_id);
    CREATE INDEX IF NOT EXISTS idx_aa_records_beneficiary ON aa_records(beneficiary_id);
    CREATE INDEX IF NOT EXISTS idx_recurring_active ON recurring_transactions(active);

    CREATE TABLE IF NOT EXISTS transaction_splits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_transaction_id INTEGER NOT NULL,
      child_transaction_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
      FOREIGN KEY (child_transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS financial_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      target_amount REAL NOT NULL,
      current_amount REAL DEFAULT 0,
      deadline TEXT,
      description TEXT,
      color TEXT DEFAULT '#3b82f6',
      icon TEXT DEFAULT '🎯',
      auto_track INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'paused')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS goal_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      goal_id INTEGER NOT NULL,
      transaction_id INTEGER,
      amount REAL NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('deposit', 'withdraw', 'auto')),
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (goal_id) REFERENCES financial_goals(id) ON DELETE CASCADE,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_goal_transactions_goal ON goal_transactions(goal_id);
    CREATE INDEX IF NOT EXISTS idx_financial_goals_status ON financial_goals(status);
  `);

  const memberCount = (db.prepare('SELECT COUNT(*) as count FROM members').get() as { count: number }).count;
  if (memberCount === 0) {
    const insertMember = db.prepare(`
      INSERT INTO members (name, avatar) VALUES (?, ?)
    `);

    insertMember.run('张三', '👨');
    insertMember.run('李四', '👩');
    insertMember.run('小明', '👦');

    const insertTag = db.prepare(`
      INSERT OR IGNORE INTO tags (name, color) VALUES (?, ?)
    `);
    insertTag.run('报销', '#10b981');
    insertTag.run('聚餐', '#f59e0b');
    insertTag.run('家庭', '#ef4444');
    insertTag.run('个人', '#8b5cf6');
    insertTag.run('通勤', '#06b6d4');

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const insertBudget = db.prepare(`
      INSERT OR IGNORE INTO budgets (month, total_budget, category_budgets) VALUES (?, ?, ?)
    `);
    const categoryBudgets = JSON.stringify({
      '餐饮': 2000,
      '交通': 800,
      '购物': 1500,
      '医疗': 500,
      '教育': 1000,
      '娱乐': 800,
      '居住': 3000,
      '其他': 400
    });
    insertBudget.run(currentMonth, 10000, categoryBudgets);

    const sampleTransactions = [
      { type: 'expense', amount: 35.5, category: '餐饮', remark: '早餐', date: getDateStr(-25), member_id: 1, tags: ['个人'] },
      { type: 'expense', amount: 128, category: '餐饮', remark: '午餐聚餐', date: getDateStr(-24), member_id: 2, tags: ['聚餐'] },
      { type: 'expense', amount: 15, category: '交通', remark: '地铁', date: getDateStr(-24), member_id: 1, tags: ['通勤'] },
      { type: 'income', amount: 15000, category: '工资', remark: '5月工资', date: getDateStr(-23), member_id: 1, tags: ['家庭'] },
      { type: 'expense', amount: 2500, category: '居住', remark: '房租', date: getDateStr(-22), member_id: 1, tags: ['家庭'] },
      { type: 'expense', amount: 89, category: '购物', remark: '日用品', date: getDateStr(-22), member_id: 3, tags: ['个人'] },
      { type: 'expense', amount: 56, category: '餐饮', remark: '晚餐', date: getDateStr(-21), member_id: 2, tags: ['个人'] },
      { type: 'expense', amount: 200, category: '娱乐', remark: '电影票', date: getDateStr(-20), member_id: 2, tags: ['家庭'] },
      { type: 'expense', amount: 30, category: '交通', remark: '打车', date: getDateStr(-20), member_id: 1, tags: ['通勤'] },
      { type: 'income', amount: 8000, category: '工资', remark: '5月工资', date: getDateStr(-19), member_id: 2, tags: ['家庭'] },
      { type: 'expense', amount: 156, category: '医疗', remark: '感冒药', date: getDateStr(-18), member_id: 3, tags: ['报销'] },
      { type: 'expense', amount: 45, category: '餐饮', remark: '午餐', date: getDateStr(-17), member_id: 1, tags: ['个人'] },
      { type: 'expense', amount: 320, category: '教育', remark: '书籍', date: getDateStr(-16), member_id: 3, tags: ['个人'] },
      { type: 'expense', amount: 68, category: '购物', remark: '水果', date: getDateStr(-15), member_id: 2, tags: ['家庭'] },
      { type: 'expense', amount: 12, category: '交通', remark: '公交', date: getDateStr(-15), member_id: 2, tags: ['通勤'] },
      { type: 'expense', amount: 298, category: '餐饮', remark: '家庭聚餐', date: getDateStr(-14), member_id: 1, tags: ['聚餐', '家庭'] },
      { type: 'expense', amount: 450, category: '娱乐', remark: '游乐园', date: getDateStr(-13), member_id: 1, tags: ['家庭'] },
      { type: 'expense', amount: 78, category: '餐饮', remark: '晚餐外卖', date: getDateStr(-12), member_id: 3, tags: ['个人'] },
      { type: 'income', amount: 500, category: '奖金', remark: '项目奖金', date: getDateStr(-11), member_id: 1, tags: ['个人'] },
      { type: 'expense', amount: 189, category: '购物', remark: '衣服', date: getDateStr(-10), member_id: 2, tags: ['个人'] },
      { type: 'expense', amount: 25, category: '餐饮', remark: '早餐', date: getDateStr(-9), member_id: 1, tags: ['个人'] },
      { type: 'expense', amount: 1200, category: '教育', remark: '培训班', date: getDateStr(-8), member_id: 3, tags: ['家庭'] },
      { type: 'expense', amount: 89, category: '其他', remark: '快递费', date: getDateStr(-7), member_id: 2, tags: ['个人'] },
      { type: 'expense', amount: 56, category: '餐饮', remark: '午餐', date: getDateStr(-6), member_id: 2, tags: ['个人'] },
      { type: 'expense', amount: 150, category: '交通', remark: '加油', date: getDateStr(-5), member_id: 1, tags: ['家庭'] },
      { type: 'income', amount: 2000, category: '兼职', remark: '兼职收入', date: getDateStr(-4), member_id: 2, tags: ['个人'] },
      { type: 'expense', amount: 234, category: '购物', remark: '家电', date: getDateStr(-3), member_id: 1, tags: ['家庭'] },
      { type: 'expense', amount: 67, category: '餐饮', remark: '晚餐', date: getDateStr(-2), member_id: 3, tags: ['个人'] },
      { type: 'expense', amount: 320, category: '医疗', remark: '体检', date: getDateStr(-1), member_id: 1, tags: ['报销', '家庭'] },
      { type: 'expense', amount: 45, category: '其他', remark: '杂费', date: getDateStr(0), member_id: 2, tags: ['个人'] },
    ];

    const insertTransaction = db.prepare(`
      INSERT INTO transactions (type, amount, category, remark, date, member_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertTransactionTag = db.prepare(`
      INSERT OR IGNORE INTO transaction_tags (transaction_id, tag_id)
      VALUES (?, (SELECT id FROM tags WHERE name = ?))
    `);

    const insertAARecord = db.prepare(`
      INSERT INTO aa_records (payer_id, beneficiary_id, amount, description, date)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const tx of sampleTransactions) {
      const result = insertTransaction.run(tx.type, tx.amount, tx.category, tx.remark, tx.date, tx.member_id);
      const txId = result.lastInsertRowid;
      for (const tagName of tx.tags) {
        insertTransactionTag.run(txId, tagName);
      }
    }

    insertAARecord.run(1, 2, 298, '张三替李四垫付聚餐费', getDateStr(-14));
    insertAARecord.run(1, 3, 298, '张三替小明垫付聚餐费', getDateStr(-14));
    insertAARecord.run(2, 1, 150, '李四替张三垫付加油费', getDateStr(-5));

    const insertRecurring = db.prepare(`
      INSERT INTO recurring_transactions (type, amount, category, remark, member_id, start_date, frequency, next_generation)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertRecurring.run('expense', 2500, '居住', '每月房租', 1, getDateStr(-22), 'monthly', getNextMonthStr(1));
    insertRecurring.run('income', 15000, '工资', '月工资', 1, getDateStr(-23), 'monthly', getNextMonthStr(1));
    insertRecurring.run('income', 8000, '工资', '月工资', 2, getDateStr(-19), 'monthly', getNextMonthStr(1));
    insertRecurring.run('expense', 39, '娱乐', '视频会员', 1, getDateStr(-10), 'monthly', getNextMonthStr(1));
  }
}

function getDateStr(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAgo);
  return date.toISOString().split('T')[0];
}

function getNextMonthStr(monthsLater: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() + monthsLater);
  date.setDate(1);
  return date.toISOString().split('T')[0];
}

export { db, initDatabase };
