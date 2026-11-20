/**
 * 고치던 답글 임시 저장 — 리뷰마다 이 브라우저에만 (새로고침·화면 이동에도 남게).
 * 게시하거나 초안으로 되돌리면 지운다. 저장소를 못 쓰는 브라우저(사생활 보호 모드 등)는 조용히 넘어간다.
 */
const PREFIX = "uz:reply-draft:";

export function loadReplyDraft(reviewId: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + reviewId);
  } catch {
    return null;
  }
}

/** 초안과 같으면(고친 게 없으면) 지운다 */
export function saveReplyDraft(reviewId: string, text: string, original: string) {
  try {
    if (text === original) window.localStorage.removeItem(PREFIX + reviewId);
    else window.localStorage.setItem(PREFIX + reviewId, text);
  } catch {
    /* 저장 못 해도 화면은 그대로 */
  }
}

export function clearReplyDraft(reviewId: string) {
  try {
    window.localStorage.removeItem(PREFIX + reviewId);
  } catch {
    /* 무시 */
  }
}
