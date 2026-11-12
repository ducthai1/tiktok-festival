// Thống kê người xem trong phiên live (dùng chung cho cả 3 game và trang điều khiển).
export function createSessionLeaderboard(limit = 5000) {
  const viewers = new Map();
  const totals = { diamonds: 0, likes: 0, chats: 0, gifts: 0, follows: 0, shares: 0 };

  function touch(user, now) {
    let viewer = viewers.get(user.id);
    if (!viewer) {
      viewer = { id: user.id, nickname: user.nickname, avatar: user.avatar, diamonds: 0, likes: 0, chats: 0, lastSeen: now };
      viewers.set(user.id, viewer);
      if (viewers.size > limit) viewers.delete(viewers.keys().next().value);
    }
    viewer.nickname = user.nickname || viewer.nickname;
    viewer.avatar = user.avatar || viewer.avatar;
    viewer.lastSeen = now;
    return viewer;
  }

  return {
    record(event, now = Date.now()) {
      if (event.type === 'member') return;
      const viewer = touch(event.user, now);
      if (event.type === 'gift') {
        viewer.diamonds += event.gift.diamonds;
        totals.diamonds += event.gift.diamonds;
        totals.gifts += event.gift.count;
      } else if (event.type === 'like') {
        viewer.likes += event.likeCount;
        totals.likes += event.likeCount;
      } else if (event.type === 'chat') {
        viewer.chats += 1;
        totals.chats += 1;
      } else if (event.type === 'follow') totals.follows += 1;
      else if (event.type === 'share') totals.shares += 1;
    },
    top(count = 1000) {
      return [...viewers.values()]
        .sort((a, b) => b.diamonds - a.diamonds || b.likes - a.likes || b.chats - a.chats)
        .slice(0, count)
        .map(({ id, nickname, avatar, diamonds, likes, chats }) => ({ id, nickname, avatar, diamonds, likes, chats }));
    },
    totals: () => ({ ...totals, viewers: viewers.size }),
    reset() {
      viewers.clear();
      for (const key of Object.keys(totals)) totals[key] = 0;
    },
    exportState() {
      return {
        totals: { ...totals },
        viewers: [...viewers.values()]
      };
    },
    restore(data) {
      if (!data) return;
      viewers.clear();
      for (const v of data.viewers || []) {
        if (v && v.id) viewers.set(v.id, { ...v, lastSeen: Date.now(), chats: v.chats || 0 });
      }
      if (data.totals) Object.assign(totals, data.totals);
    }
  };
}
