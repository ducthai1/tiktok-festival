// Ghi log chi tiết câu hỏi & mọi đáp án của người xem vào data/answers/YYYY-MM-DD.log.
// Tự động xoá dần các file log đã cũ trên 2 ngày (keepDays = 2).
import fs from 'node:fs';
import path from 'node:path';

export const KEEP_DAYS = 2;

function pad(n) {
  return String(n).padStart(2, '0');
}

export function dayString(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function timeString(date = new Date()) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${String(date.getMilliseconds()).padStart(3, '0')}`;
}

export function createAnswersLogger(dataDir, { keepDays = KEEP_DAYS, now = () => Date.now(), onEntry: initialOnEntry = null } = {}) {
  let onEntry = initialOnEntry;
  if (!dataDir) {
    return {
      logQuestion: () => {},
      logAnswer: () => {},
      prune: () => 0,
      setOnEntry: () => {},
      getRecentLines: () => []
    };
  }

  const dir = path.join(dataDir, 'answers');
  const mainLink = path.join(dataDir, 'answers.log');

  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {}

  function prune() {
    let deleted = 0;
    try {
      const cutoff = now() - keepDays * 86400000;
      for (const name of fs.readdirSync(dir)) {
        if (!/^\d{4}-\d{2}-\d{2}\.log$/.test(name)) continue;
        const full = path.join(dir, name);
        const [y, m, d] = name.replace('.log', '').split('-').map(Number);
        const fileTime = new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
        let mtime = 0;
        try { mtime = fs.statSync(full).mtimeMs; } catch {}
        if (fileTime < cutoff && (mtime === 0 || mtime < cutoff)) {
          fs.unlinkSync(full);
          deleted += 1;
        }
      }
    } catch {
      // bỏ qua lỗi dọn dẹp
    }
    return deleted;
  }

  // Dọn log cũ hơn 2 ngày lúc khởi tạo
  prune();

  let lastPrune = 0;

  function appendLine(line) {
    const today = dayString(new Date(now()));
    const file = path.join(dir, `${today}.log`);
    try {
      fs.appendFileSync(file, `${line}\n`, 'utf8');
      // Tạo symlink data/answers.log trỏ vào file ngày hôm nay để xem nhanh
      try {
        if (fs.existsSync(mainLink)) {
          const stat = fs.lstatSync(mainLink);
          if (stat.isSymbolicLink()) {
            if (fs.readlinkSync(mainLink) !== file) {
              fs.unlinkSync(mainLink);
              fs.symlinkSync(file, mainLink);
            }
          }
        } else {
          fs.symlinkSync(file, mainLink);
        }
      } catch {
        // bỏ qua nếu symlink không được hỗ trợ
      }
    } catch (err) {
      console.warn('[answers-log] Không ghi được file log:', err.message);
    }

    if (now() - lastPrune > 3600000) {
      lastPrune = now();
      prune();
    }
  }

  return {
    setOnEntry(fn) {
      onEntry = fn;
    },

    logQuestion(qNumber, { category = '', prompt = '', answer = '' } = {}) {
      const t = new Date(now()).toISOString();
      const header = `\n${'='.repeat(78)}\n[${t}] CÂU #${qNumber} | Chủ đề: ${category} | Gợi ý: "${prompt}" | Đáp án: "${answer}"\n${'='.repeat(78)}`;
      appendLine(header);
      try {
        onEntry?.({ kind: 'question', qNumber, category, prompt, answer, time: t, line: header.trim() });
      } catch {}
    },

    logAnswer(qNumber, { user, comment, result, rank = 0, points = 0, note = '' } = {}) {
      const t = timeString(new Date(now()));
      const nick = user?.nickname || 'Người xem';
      const uid = user?.uniqueId ? `@${user.uniqueId}` : (user?.id ? `@${user.id}` : '');
      const userStr = uid ? `${nick} (${uid})` : nick;
      let statusStr = result;
      if (rank > 0 && points > 0) {
        statusStr = `ĐÚNG (Hạng ${rank}, +${points} điểm)`;
      } else if (result === 'CAP_REACHED') {
        statusStr = `ĐÚNG NHƯNG ĐÃ ĐỦ 6 NGƯỜI NHANH NHẤT (Không tính điểm)`;
      } else if (result === 'ALREADY_WON') {
        statusStr = `ĐÃ ĐƯỢC TÍNH ĐIỂM TRƯỚC ĐÓ`;
      } else if (result === 'MAX_TRIES') {
        statusStr = `VƯỢT QUÁ SỐ LẦN ĐOÁN (tối đa 6 lần)`;
      } else if (result === 'WRONG') {
        statusStr = `SAI`;
      }
      if (note) statusStr += ` (${note})`;

      const row = `[${t}] [${userStr}] gõ: "${comment}" -> ${statusStr}`;
      appendLine(row);
      try {
        onEntry?.({
          kind: 'answer',
          qNumber,
          time: t,
          user: { nickname: nick, uniqueId: user?.uniqueId || user?.id || '' },
          comment,
          result,
          rank,
          points,
          statusStr,
          line: row
        });
      } catch {}
    },

    getRecentLines(maxLines = 200, dateStr = null) {
      const targetDate = dateStr || dayString(new Date(now()));
      const file = path.join(dir, `${targetDate}.log`);
      try {
        if (!fs.existsSync(file)) return [];
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n').filter((l) => l.trim().length > 0);
        return lines.slice(-maxLines);
      } catch (err) {
        return [];
      }
    },

    prune,
    dir: () => dir
  };
}
