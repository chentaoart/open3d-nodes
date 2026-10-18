export async function extractFrames(file: File, count = 6, maxSize = 640): Promise<string[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.src = url;
  video.muted = true;
  video.playsInline = true;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('视频加载失败'));
    video.load();
  });

  const duration = video.duration;
  if (!isFinite(duration) || duration <= 0) {
    URL.revokeObjectURL(url);
    throw new Error('无法获取视频时长');
  }

  const frames: string[] = [];
  const canvas = document.createElement('canvas');

  for (let i = 0; i < count; i++) {
    const t = (duration * (i + 0.5)) / count;
    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error('跳帧失败'));
      video.currentTime = t;
    });

    const ratio = Math.min(1, maxSize / Math.max(video.videoWidth, video.videoHeight));
    const w = Math.round(video.videoWidth * ratio);
    const h = Math.round(video.videoHeight * ratio);
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    ctx.drawImage(video, 0, 0, w, h);
    frames.push(canvas.toDataURL('image/jpeg', 0.8));
  }

  URL.revokeObjectURL(url);
  return frames;
}