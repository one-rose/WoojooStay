import type { ValidationError } from 'class-validator';
import { validationMessage } from './messages.js';

const err = (property: string, constraints: Record<string, string>, children: ValidationError[] = []) =>
  ({ property, constraints, children }) as ValidationError;

describe('검증 오류 문구', () => {
  it('직접 쓴 한국어는 그대로, 영어 기본 문구는 칸 이름 + 일반 문구', () => {
    expect(validationMessage([err('phone', { matches: '휴대폰 번호 형식이 아니에요.' })])).toBe(
      '휴대폰 번호 형식이 아니에요.',
    );
    expect(validationMessage([err('type', { isEnum: 'type must be one of the following values: HOTEL, MOTEL' })])).toBe(
      '종류가 올바르지 않아요. 다시 확인해 주세요.',
    );
    expect(validationMessage([err('zzz', { whitelistValidation: 'property zzz should not exist' })])).not.toMatch(
      /zzz/,
    );
    expect(validationMessage([err('secretField', { isInt: 'secretField must be an integer number' })])).toBe(
      '입력한 값이 올바르지 않아요. 다시 확인해 주세요.',
    );
    // 배열 안 칸은 부모 이름으로
    const nested = err('assignments', {}, [err('0', {}, [err('role', { isIn: 'role must be one of ...' })])]);
    expect(validationMessage([nested])).toBe('권한이 올바르지 않아요. 다시 확인해 주세요.');
  });
});
