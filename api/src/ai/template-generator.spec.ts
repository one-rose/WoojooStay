import { joinAnd, TemplateReplyGenerator } from './template-generator.js';

const base = {
  propertyName: '스테이 오르빗',
  channelName: '야놀자',
  roomType: null,
  signature: '오르빗 드림',
  mustInclude: '',
  banned: [],
};

const APOLOGY = /죄송|사과|sorry|apolog/i;
const PROMISE = /점검하겠|확인하겠|줄이도록|다양하게 준비|자세히 드리겠/;

describe('템플릿 답글', () => {
  const gen = new TemplateReplyGenerator();

  it('저평점은 사과로 시작하고 개선 약속을 넣는다', async () => {
    const r = await gen.generate({ ...base, rating: 2, body: '옆방 소음이 심했어요', tone: 'POLITE' });
    expect(r.text.startsWith('편히 쉬셔야 할 시간에')).toBe(true);
    expect(r.text).toContain('방음');
    expect(r.keywords).toEqual(['소음']);
    expect(r.text.endsWith('오르빗 드림')).toBe(true);
    expect(r.generator).toBe('template');
  });

  it('친근한 말투', async () => {
    const r = await gen.generate({ ...base, rating: 5, body: '체크인이 빨랐어요', tone: 'FRIENDLY' });
    expect(r.text).toContain('고마워요');
  });

  it('업장 이름 뒤 조사를 받침에 맞춘다', async () => {
    const r1 = await gen.generate({
      ...base,
      propertyName: '스테이 오르빗',
      rating: 5,
      body: '좋아요',
      tone: 'POLITE',
    });
    expect(r1.text).toContain('스테이 오르빗을 찾아주시고');
    const r2 = await gen.generate({ ...base, propertyName: '우주스테이', rating: 5, body: '좋아요', tone: 'POLITE' });
    expect(r2.text).toContain('우주스테이를 찾아주시고');
    const r3 = await gen.generate({ ...base, rating: 5, body: '체크인 빠르고 직원 친절', tone: 'POLITE' });
    expect(r3.text).toContain('빠른 체크인과 직원 응대를 좋게 봐주셔서');
    expect(joinAnd(['깨끗한 객실', '편리한 위치', '조식'])).toBe('깨끗한 객실, 편리한 위치와 조식');
  });

  it('별점 4점 이상에는 불만이 섞여도 사과·개선 약속을 넣지 않는다', async () => {
    for (const variant of [0, 1, 2]) {
      const r = await gen.generate({
        ...base,
        rating: 4,
        body: '역에서 가깝고 좋았어요. 다만 아침에 엘리베이터 대기가 길었습니다.',
        tone: 'POLITE',
        variant,
      });
      expect(r.text).not.toMatch(APOLOGY);
      expect(r.text).not.toMatch(PROMISE);
      expect(r.text).toContain('편리한 위치');
    }
  });

  it('별점 2점 이하에는 칭찬하지 않는다', async () => {
    for (const tone of ['POLITE', 'FRIENDLY'] as const) {
      const r = await gen.generate({
        ...base,
        rating: 1,
        body: '위치는 좋은데 방이 깨끗하지 않았고 배수가 안 됐어요',
        tone,
      });
      expect(r.text).toMatch(APOLOGY);
      expect(r.text).not.toMatch(/좋게 봐주셔서|마음에 드셨다니|좋아해 주셔서|기쁩니다|기뻐요/);
      expect(r.text).toContain('배수');
    }
  });

  it('한국어가 아닌 리뷰는 짧은 영어 답글', async () => {
    const en = await gen.generate({ ...base, rating: 5, body: 'Great location and very clean room!', tone: 'POLITE' });
    expect(en.text).toMatch(/^Thank you/);
    expect(en.text.split('\n\n')[0]).not.toMatch(/[가-힣]/);
    expect(en.text.endsWith('오르빗 드림')).toBe(true);
    expect(en.keywords).toEqual(['청결', '위치']);
    const zh = await gen.generate({ ...base, rating: 2, body: '房间很吵，早餐不好。', tone: 'POLITE' });
    expect(zh.text).toMatch(/sorry|apolog/i);
  });

  it('다시 만들면 다른 표현이 나온다', async () => {
    const ctx = { ...base, rating: 2, body: '옆방 소음이 심했어요', tone: 'POLITE' as const };
    const texts = await Promise.all([0, 1, 2, 3].map((variant) => gen.generate({ ...ctx, variant })));
    for (let i = 1; i < texts.length; i++) expect(texts[i].text).not.toBe(texts[i - 1].text);
    expect(texts.every((t) => t.text.includes('죄송'))).toBe(true);
    const en = await Promise.all([0, 1].map((variant) => gen.generate({ ...ctx, body: 'noisy room', variant })));
    expect(en[0].text).not.toBe(en[1].text);
  });
});
