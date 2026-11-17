// Thống kê người xem trong phiên live (dùng chung cho cả 3 game và trang điều khiển).
export function createSessionLeaderboard(limit = 5000, donationsLimit = 2000) {
  const viewers = new Map();
  const donations = [];
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
        const diamonds = Number(event.gift?.diamonds) || 0;
        const count = Number(event.gift?.count) || 1;
        viewer.diamonds += diamonds;
        totals.diamonds += diamonds;
        totals.gifts += count;
        donations.unshift({
          id: event.id || `gift-${now}-${Math.random().toString(36).slice(2, 7)}`,
          at: now,
          user: {
            id: String(event.user?.id || ''),
            nickname: String(event.user?.nickname || 'Người xem'),
            avatar: String(event.user?.avatar || '')
          },
          gift: {
            id: String(event.gift?.id || ''),
            name: String(event.gift?.name || 'Quà'),
            pictureUrl: String(event.gift?.pictureUrl || ''),
            diamondsEach: Number(event.gift?.diamondsEach) || 0,
            count,
            diamonds
          },
          simulated: Boolean(event.simulated)
        });
        if (donations.length > donationsLimit) donations.pop();
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
    donations(count = 300) {
      return donations.slice(0, count);
    },
    reset() {
      viewers.clear();
      donations.length = 0;
      for (const key of Object.keys(totals)) totals[key] = 0;
    },
    exportState() {
      return {
        totals: { ...totals },
        viewers: [...viewers.values()],
        donations: donations.slice(0, 1000)
      };
    },
    restore(data) {
      if (!data) return;
      viewers.clear();
      donations.length = 0;
      for (const v of data.viewers || []) {
        if (v && v.id) viewers.set(v.id, { ...v, lastSeen: Date.now(), chats: v.chats || 0 });
      }
      if (Array.isArray(data.donations)) {
        for (const d of data.donations) {
          if (d && d.user && d.gift) donations.push(d);
        }
      }
      if (data.totals) Object.assign(totals, data.totals);
    }
  };
}
