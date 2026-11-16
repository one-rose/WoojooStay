/**
 * 사람이 확인해야 하는 리뷰인지 — 실명·연락처·욕설 (F1-03 예외, F1-08 자동 게시 제외)
 * 단순 규칙. 정확도가 부족하면 AI 판별로 바꾼다 (기능정의서 '감지 기준' 결정 필요).
 */
const PATTERNS = [
  /01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/, // 휴대폰 번호
  /[가-힣][A-Z○◯OＯ]{1,2}\s?(씨|님|직원|매니저)/, // 김OO 씨
  /[가-힣]{2,4}\s?(씨|직원|매니저)\s?(태도|때문)/, // 실명 + 직원 언급
  /씨발|시발|개새|병신|좆|fuck/i,
];

export function needsHumanReview(body: string): boolean {
  return PATTERNS.some((p) => p.test(body));
}

/** 별점으로 1차 분류 — AI 감성 분석은 추후 (F1-02 '분류 기준' 결정 필요) */
export function sentimentOf(rating: number): 'POSITIVE' | 'IMPROVE' {
  return rating >= 4 ? 'POSITIVE' : 'IMPROVE';
}
