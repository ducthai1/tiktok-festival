// Mức vẽ của màn game. Mặc định là đẹp nhất: máy có card rời, OBS lấy đủ 1080×1920.
// Máy yếu (Mac 8 GB, điện thoại) mở /stage?lite=1: vẽ ít điểm ảnh hơn rồi phóng lên khung, bỏ khử
// răng cưa, bóng đổ mềm, hậu kỳ phát sáng và lớp kính mờ của bảng; tối đa 30 khung/giây vì TikTok LIVE
// chỉ phát 30 khung, vẽ 60 là bỏ phí nửa sức máy. Tách riêng (không kèm three) để test chạy bằng node.

/** 720×1280 = đúng cỡ 720p mà TikTok phát cho đa số người xem. */
export const LITE_PIXEL_RATIO = 2 / 3;
export const LITE_MAX_FPS = 30;

/** @param {string} search chuỗi `location.search` của trang, vd "?lite=1&fps=1" */
export function stageQuality(search = '') {
  const value = new URLSearchParams(search).get('lite');
  const lite = value !== null && value !== '0' && value !== 'false';
  return {
    lite,
    antialias: !lite,
    shadows: !lite,
    bloom: !lite,
    glass: !lite,
    maxPixelRatio: lite ? LITE_PIXEL_RATIO : 1,
    maxFps: lite ? LITE_MAX_FPS : 0
  };
}

/**
 * Bỏ bớt khung để không vẽ quá `maxFps` (0 = vẽ mọi khung). Màn 60 Hz vẽ 1 khung bỏ 1, màn 120 Hz vẽ 1 bỏ 3.
 * Chừa 4 ms vì nhịp màn hình không đều tuyệt đối: khung đến sớm một chút vẫn được vẽ, không rơi xuống 20 fps.
 */
export function createFrameLimiter(maxFps) {
  if (!maxFps) return () => true;
  const minGap = 1000 / maxFps - 4;
  let lastDrawn = -Infinity;
  return (now) => {
    if (now - lastDrawn < minGap) return false;
    lastDrawn = now;
    return true;
  };
}
