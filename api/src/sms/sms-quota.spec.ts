import { smsSafeName } from './sms-quota.js';

describe('문자에 넣는 업장 이름', () => {
  it('링크·전화번호 모양은 지우고 20자 이내로', () => {
    expect(smsSafeName('스테이 오르빗 을지로')).toBe('스테이 오르빗 을지로');
    expect(smsSafeName('당첨! http://evil.example/x 호텔')).toBe('당첨! 호텔');
    expect(smsSafeName('무료쿠폰 bit.ly/abc')).toBe('무료쿠폰');
    expect(smsSafeName('문의 010-1234-5678 호텔')).toBe('문의 호텔');
    expect(smsSafeName('가나다라마바사아자차카타파하가나다라마바사아자')).toBe(
      '가나다라마바사아자차카타파하가나다라마바…',
    );
    expect(smsSafeName('https://only.link')).toBe('우주스테이 업장');
  });
});
