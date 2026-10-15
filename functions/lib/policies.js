export const isMember = (profile) =>
  Boolean(profile && ['user', 'admin'].includes(profile.role));
export const isAdmin = (profile) => profile?.role === 'admin';
export function validateNickname(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 30)
    throw new Error('닉네임은 1~30자로 입력해 주세요.');
  return value.trim();
}
export function normalizeEmail(value) {
  if (
    typeof value !== 'string' ||
    value.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  )
    throw new Error('올바른 이메일 주소를 입력해 주세요.');
  return value.trim().toLowerCase();
}
export function validateImage(file) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('JPG, PNG, WebP 이미지를 선택해 주세요.');
  if (file.size <= 0 || file.size > 5 * 1024 * 1024)
    throw new Error('이미지는 5 MB 이하여야 합니다.');
}
export function validateChat(data) {
  if (
    typeof data?.message !== 'string' ||
    !data.message.trim() ||
    data.message.length > 4000
  )
    throw new Error('메시지는 1~4,000자로 입력해 주세요.');
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(data.requestId || ''))
    throw new Error('메시지 식별자가 올바르지 않습니다.');
  if (
    data.driverId != null &&
    (typeof data.driverId !== 'string' || data.driverId.length > 128)
  )
    throw new Error('사용자 필터가 올바르지 않습니다.');
  return {
    message: data.message.trim(),
    requestId: data.requestId,
    driverId: data.driverId || '',
  };
}
