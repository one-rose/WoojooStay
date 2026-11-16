import { isValidBizNo } from './biz-no.js';

describe('사업자등록번호 검증번호', () => {
  it('맞는 번호', () => {
    expect(isValidBizNo('123-45-67891')).toBe(true);
  });
  it('끝자리가 틀리면 거절', () => {
    expect(isValidBizNo('1234567890')).toBe(false);
  });
  it('자릿수가 다르면 거절', () => {
    expect(isValidBizNo('12345')).toBe(false);
  });
});
