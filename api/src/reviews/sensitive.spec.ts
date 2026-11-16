import { needsHumanReview, sentimentOf } from './sensitive.js';

describe('사람 확인이 필요한 리뷰', () => {
  it.each([
    '010-1234-5678 로 연락 주세요',
    '직원 김OO 씨 태도가 불쾌했어요',
    '박민수 직원 태도 때문에 기분이 상했어요',
  ])('%s', (body) => expect(needsHumanReview(body)).toBe(true));

  it('평범한 리뷰는 통과', () => {
    expect(needsHumanReview('직원분들이 친절하고 방이 깨끗했어요')).toBe(false);
  });

  it('별점 4점 이상은 긍정', () => {
    expect(sentimentOf(4)).toBe('POSITIVE');
    expect(sentimentOf(3)).toBe('IMPROVE');
  });
});
