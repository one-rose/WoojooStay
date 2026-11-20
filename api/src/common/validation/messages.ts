import type { ValidationError } from 'class-validator';
import { josa } from '../utils/korean.js';

const HANGUL = /\p{Script=Hangul}/u;

/** 자주 쓰는 입력 칸 이름 — 영어 필드명 대신 화면에 보여 줄 말. 없으면 '입력한 값' */
const LABELS: Record<string, string> = {
  phone: '휴대폰 번호',
  password: '비밀번호',
  name: '이름',
  email: '이메일',
  code: '인증번호',
  purpose: '요청 종류',
  agreements: '약관 동의',
  address: '주소',
  rooms: '객실 수',
  type: '종류',
  role: '권한',
  bizNo: '사업자등록번호',
  ownerName: '대표자 이름',
  amount: '금액',
  payAmount: '급여',
  payType: '급여 방식',
  jobRole: '담당 업무',
  date: '날짜',
  workDate: '근무일',
  hiredDate: '입사일',
  resignedDate: '퇴사일',
  month: '월',
  week: '주',
  vendor: '거래처',
  category: '분류',
  memo: '메모',
  text: '내용',
  body: '내용',
  channel: '채널',
  status: '상태',
  token: '링크',
  propertyId: '업장',
  propertyIds: '업장',
  employeeId: '직원',
  assignments: '권한 목록',
  shiftType: '근무 종류',
  clockIn: '출근 시각',
  clockOut: '퇴근 시각',
  qty: '수량',
  unit: '단위',
  item: '품목',
};

/** 맨 먼저 걸린 칸(중첩 포함)과 그 칸의 이름 */
function firstLeaf(errors: ValidationError[], parent?: string): { error: ValidationError; field: string } | null {
  for (const e of errors) {
    // 배열 칸(0, 1, …)은 부모 이름으로 부른다
    const field = /^\d+$/.test(e.property) && parent ? parent : e.property;
    if (e.constraints && Object.keys(e.constraints).length) return { error: e, field };
    const child = firstLeaf(e.children ?? [], field);
    if (child) return child;
  }
  return null;
}

/**
 * class-validator 오류 → 한국어 한 줄.
 * 직접 쓴 한국어 메시지는 그대로, 영어 기본 메시지는 '○○이(가) 올바르지 않아요' 로 (enum 목록·필드명은 보여 주지 않는다).
 */
export function validationMessage(errors: ValidationError[]): string {
  const leaf = firstLeaf(errors);
  if (!leaf) return '보낸 값이 올바르지 않아요. 다시 확인해 주세요.';
  const constraints = leaf.error.constraints ?? {};
  if ('whitelistValidation' in constraints) return '보낼 수 없는 값이 들어 있어요. 화면을 새로고침해 주세요.';
  const korean = Object.values(constraints).find((m) => HANGUL.test(m));
  if (korean) return korean;
  const label = LABELS[leaf.field] ?? '입력한 값';
  if ('isDefined' in constraints || 'isNotEmpty' in constraints) return `${josa(label, '을/를')} 입력해 주세요.`;
  return `${josa(label, '이/가')} 올바르지 않아요. 다시 확인해 주세요.`;
}
