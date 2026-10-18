export type Intent = 'chat' | 'create' | 'modify' | 'delete';

const DELETE_RE = /删|去掉|移除|清除|不要|取消|清空/;
const MODIFY_RE = /改|换|变|调整|再|更|加高|加宽|变大|变小|高一点|矮一点|粗一点|细一点|大一点|小一点|颜色|移到|挪|旋转|放大|缩小|涂|染/;
const ACTION_RE = /做|建|造|加|放|来|生成|画|给我|帮我|创建|添加|摆|搭|设置|设为|变成|换成|改成|复制|镜像|阵列/;
const COLOR_RE = /红|橙|黄|绿|青|蓝|紫|粉|白|黑|灰|棕|金|银|色/;
/** 这些一定是在问问题，即使句子里带"做"字（如"你能做什么"）。 */
const STRONG_CHAT_RE = /你是谁|能做什么|会做什么|会什么|怎么用|什么是|是什么|为什么|有什么功能/;
const CHAT_RE = /^(你好|您好|hi|hello|嗨|哈喽|谢谢|感谢|再见|辛苦)|怎么样|好不好|如何|[?？]\s*$/i;

/**
 * 判断意图。原则：宁可当作指令（模型不确定时仍会回文字），
 * 也不要把"加一盏灯""放个沙发"这类指令误判成闲聊。
 */
export function detectIntent(text: string): Intent {
  const t = text.trim();
  if (!t) return 'chat';

  if (STRONG_CHAT_RE.test(t)) return 'chat';

  const hasAction = ACTION_RE.test(t) || MODIFY_RE.test(t) || DELETE_RE.test(t);
  if (!hasAction && CHAT_RE.test(t)) return 'chat';

  if (DELETE_RE.test(t)) return 'delete';
  if (MODIFY_RE.test(t) || (COLOR_RE.test(t) && t.length < 12)) return 'modify';
  return 'create';
}
