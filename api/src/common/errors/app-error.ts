import { HttpException, HttpStatus } from '@nestjs/common';
import { josa } from '../utils/korean.js';

/**
 * 화면에서 분기할 수 있도록 errorCode 를 함께 내려준다.
 * 응답: { statusCode, message, errorCode }
 */
export class AppError extends HttpException {
  constructor(status: HttpStatus, errorCode: string, message: string) {
    super({ statusCode: status, message, errorCode }, status);
  }
}

export const Errors = {
  phoneTaken: () => new AppError(HttpStatus.CONFLICT, 'PHONE_TAKEN', '이미 가입된 휴대폰 번호예요. 로그인해 주세요.'),
  codeInvalid: () => new AppError(HttpStatus.BAD_REQUEST, 'CODE_INVALID', '인증번호가 맞지 않아요.'),
  codeExpired: () => new AppError(HttpStatus.BAD_REQUEST, 'CODE_EXPIRED', '인증 시간이 지났어요. 다시 받아 주세요.'),
  tooManyAttempts: () =>
    new AppError(HttpStatus.TOO_MANY_REQUESTS, 'TOO_MANY_ATTEMPTS', '인증번호를 5번 틀렸어요. 다시 받아 주세요.'),
  smsCooldown: (sec: number) =>
    new AppError(
      HttpStatus.TOO_MANY_REQUESTS,
      'SMS_COOLDOWN',
      `인증번호를 방금 보냈어요. ${sec}초 뒤에 다시 받아 주세요.`,
    ),
  smsDailyLimit: () =>
    new AppError(
      HttpStatus.TOO_MANY_REQUESTS,
      'SMS_DAILY_LIMIT',
      '오늘은 인증번호를 더 받을 수 없어요. 내일 다시 시도해 주세요.',
    ),
  verificationRequired: () =>
    new AppError(HttpStatus.UNAUTHORIZED, 'VERIFICATION_REQUIRED', '휴대폰 인증을 먼저 해 주세요.'),
  termsRequired: () => new AppError(HttpStatus.BAD_REQUEST, 'TERMS_REQUIRED', '필수 약관에 동의해 주세요.'),
  badCredentials: () =>
    new AppError(HttpStatus.UNAUTHORIZED, 'BAD_CREDENTIALS', '휴대폰 번호 또는 비밀번호가 맞지 않아요.'),
  tokenInvalid: () => new AppError(HttpStatus.UNAUTHORIZED, 'TOKEN_INVALID', '다시 로그인해 주세요.'),
  forbidden: () => new AppError(HttpStatus.FORBIDDEN, 'FORBIDDEN', '이 업장에서 할 수 없는 작업이에요.'),
  notFound: (what: string) => new AppError(HttpStatus.NOT_FOUND, 'NOT_FOUND', `${josa(what, '을/를')} 찾을 수 없어요.`),
  bizNoInvalid: () =>
    new AppError(HttpStatus.BAD_REQUEST, 'BIZ_NO_INVALID', '사업자등록번호가 올바르지 않아요. 다시 확인해 주세요.'),
  bizClosed: () => new AppError(HttpStatus.BAD_REQUEST, 'BIZ_CLOSED', '휴업 또는 폐업한 사업자예요.'),
  consentRequired: () =>
    new AppError(HttpStatus.BAD_REQUEST, 'CONSENT_REQUIRED', '채널 계정 정보 위탁·수집에 동의해 주세요.'),
  channelAuthFailed: (name: string) =>
    new AppError(
      HttpStatus.BAD_REQUEST,
      'CHANNEL_AUTH_FAILED',
      `${name} 로그인에 실패했어요. 아이디와 비밀번호를 확인해 주세요.`,
    ),
  channelNotConnected: () => new AppError(HttpStatus.BAD_REQUEST, 'CHANNEL_NOT_CONNECTED', '연결되지 않은 채널이에요.'),
  alreadyAnswered: () => new AppError(HttpStatus.CONFLICT, 'ALREADY_ANSWERED', '이미 답글이 달린 리뷰예요.'),
  replyEmpty: () => new AppError(HttpStatus.BAD_REQUEST, 'REPLY_EMPTY', '답글 내용을 입력해 주세요.'),
  invitationInvalid: () =>
    new AppError(HttpStatus.BAD_REQUEST, 'INVITATION_INVALID', '초대 링크가 만료됐거나 이미 사용됐어요.'),
  invitationPhoneMismatch: () =>
    new AppError(HttpStatus.FORBIDDEN, 'INVITATION_PHONE_MISMATCH', '초대받은 휴대폰 번호로 로그인해 주세요.'),
  adminBadCredentials: () =>
    new AppError(HttpStatus.UNAUTHORIZED, 'BAD_CREDENTIALS', '이메일 또는 비밀번호가 맞지 않아요.'),
  adminForbidden: () => new AppError(HttpStatus.FORBIDDEN, 'ADMIN_FORBIDDEN', '최고 관리자만 할 수 있는 작업이에요.'),
  emailTaken: () => new AppError(HttpStatus.CONFLICT, 'EMAIL_TAKEN', '이미 등록된 이메일이에요.'),
  contractInvalid: () =>
    new AppError(HttpStatus.NOT_FOUND, 'CONTRACT_INVALID', '계약서 링크가 만료됐어요. 사장님께 다시 요청해 주세요.'),
  contractNameMismatch: () =>
    new AppError(HttpStatus.BAD_REQUEST, 'CONTRACT_NAME_MISMATCH', '계약서에 적힌 이름과 같게 입력해 주세요.'),
  alreadyClockedIn: () => new AppError(HttpStatus.CONFLICT, 'ALREADY_CLOCKED_IN', '오늘은 이미 출근을 기록했어요.'),
  notClockedIn: () => new AppError(HttpStatus.BAD_REQUEST, 'NOT_CLOCKED_IN', '출근 기록이 없어요.'),
  undoExpired: () =>
    new AppError(
      HttpStatus.CONFLICT,
      'UNDO_EXPIRED',
      '퇴근한 지 5분이 지나 되돌릴 수 없어요. 사장님이나 매니저에게 고쳐 달라고 해 주세요.',
    ),
  nothingToRetry: () =>
    new AppError(HttpStatus.CONFLICT, 'NO_FAILED_PAYMENT', '다시 결제할 구독료가 없어요. 새로고침해 주세요.'),
  pilotBillingHeld: () => new AppError(HttpStatus.BAD_REQUEST, 'PILOT_BILLING_HELD', '실증 기간에는 결제하지 않아요.'),
  payrollNotConfirmed: () =>
    new AppError(HttpStatus.BAD_REQUEST, 'PAYROLL_NOT_CONFIRMED', '급여를 먼저 확정해 주세요.'),
  badMonth: () => new AppError(HttpStatus.BAD_REQUEST, 'BAD_MONTH', '월은 YYYY-MM 형식이에요.'),
  fileRequired: () => new AppError(HttpStatus.BAD_REQUEST, 'FILE_REQUIRED', '영수증 사진을 올려 주세요.'),
  fileType: () => new AppError(HttpStatus.BAD_REQUEST, 'FILE_TYPE', '사진(JPG·PNG·HEIC) 또는 PDF만 올릴 수 있어요.'),
  fileTooLarge: () => new AppError(HttpStatus.BAD_REQUEST, 'FILE_TOO_LARGE', '10MB 이하 파일만 올릴 수 있어요.'),
  receiptRegistered: () => new AppError(HttpStatus.CONFLICT, 'RECEIPT_REGISTERED', '이미 지출로 등록한 영수증이에요.'),
  orderClosed: () => new AppError(HttpStatus.CONFLICT, 'ORDER_CLOSED', '이미 입고되었거나 취소된 발주예요.'),
  planUnavailable: () => new AppError(HttpStatus.BAD_REQUEST, 'PLAN_UNAVAILABLE', '아직 준비 중인 서비스예요.'),
  paymentFailed: (reason: string) =>
    new AppError(HttpStatus.PAYMENT_REQUIRED, 'PAYMENT_FAILED', `결제에 실패했어요. ${reason}`),
  cardFailed: () =>
    new AppError(HttpStatus.BAD_REQUEST, 'CARD_FAILED', '카드를 등록하지 못했어요. 다시 시도해 주세요.'),
  notLinkedEmployee: () =>
    new AppError(
      HttpStatus.NOT_FOUND,
      'NOT_LINKED_EMPLOYEE',
      '직원 명단에 내 번호가 없어요. 사장님께 직원 등록을 요청해 주세요.',
    ),
  alreadyMember: () => new AppError(HttpStatus.CONFLICT, 'ALREADY_MEMBER', '이미 이 업장의 직원으로 등록된 번호예요.'),
  lastOwner: () => new AppError(HttpStatus.BAD_REQUEST, 'LAST_OWNER', '사장님 권한은 최소 1명이 있어야 해요.'),
  roomNoTaken: (no: string) => new AppError(HttpStatus.CONFLICT, 'ROOM_NO_TAKEN', `${no}호는 이미 등록돼 있어요.`),
  roomStatusConflict: () =>
    new AppError(HttpStatus.CONFLICT, 'ROOM_STATUS_CONFLICT', '다른 사람이 먼저 바꿨어요. 새로고침해 주세요.'),
  belowMinimumWage: (minimum: number) =>
    new AppError(
      HttpStatus.BAD_REQUEST,
      'BELOW_MINIMUM_WAGE',
      `최저시급(${minimum.toLocaleString('ko-KR')}원)보다 적은 급여가 있어요. 급여를 고친 뒤 다시 해 주세요.`,
    ),
  monthNotEnded: () =>
    new AppError(HttpStatus.BAD_REQUEST, 'MONTH_NOT_ENDED', '아직 끝나지 않은 달의 급여는 확정할 수 없어요.'),
  payrollSent: () => new AppError(HttpStatus.CONFLICT, 'PAYROLL_SENT', '이미 명세를 보낸 급여는 확정을 풀 수 없어요.'),
  payOwnerOnly: () =>
    new AppError(HttpStatus.FORBIDDEN, 'PAY_OWNER_ONLY', '급여(시급·월급)는 사장님만 정하거나 바꿀 수 있어요.'),
  payRequired: () => new AppError(HttpStatus.BAD_REQUEST, 'VALIDATION', '급여 기준(시급·월급)을 넣어 주세요.'),
  selfEditForbidden: () =>
    new AppError(HttpStatus.FORBIDDEN, 'SELF_EDIT_FORBIDDEN', '내 급여와 출퇴근 기록은 사장님만 고칠 수 있어요.'),
  adminSelf: () =>
    new AppError(HttpStatus.FORBIDDEN, 'ADMIN_SELF', '내 계정의 사용 여부는 다른 최고 관리자가 바꿔야 해요.'),
  conflict: () => new AppError(HttpStatus.CONFLICT, 'CONFLICT', '이미 처리된 요청이에요. 새로고침해 주세요.'),
  badInput: () => new AppError(HttpStatus.BAD_REQUEST, 'BAD_INPUT', '보낸 값이 올바르지 않아요. 다시 확인해 주세요.'),
  payrollLocked: () =>
    new AppError(HttpStatus.CONFLICT, 'PAYROLL_LOCKED', '이 달 급여가 확정됐어요. 급여 확정을 풀고 고쳐 주세요.'),
  missingClockOut: (count: number) =>
    new AppError(
      HttpStatus.BAD_REQUEST,
      'MISSING_CLOCK_OUT',
      `퇴근 기록이 빠진 근무가 ${count}건 있어요. 출퇴근 기록을 고친 뒤 확정해 주세요.`,
    ),
  futureMonth: () => new AppError(HttpStatus.BAD_REQUEST, 'FUTURE_MONTH', '아직 오지 않은 달은 볼 수 없어요.'),
  workDateFuture: () => new AppError(HttpStatus.BAD_REQUEST, 'WORK_DATE_FUTURE', '근무일은 오늘까지만 넣을 수 있어요.'),
  workDateBeforeHired: () =>
    new AppError(HttpStatus.BAD_REQUEST, 'WORK_DATE_BEFORE_HIRED', '입사일보다 앞선 날에는 근무를 넣을 수 없어요.'),
  clockSame: () => new AppError(HttpStatus.BAD_REQUEST, 'CLOCK_SAME', '출근과 퇴근 시각이 같아요. 다시 확인해 주세요.'),
  shiftTooLong: (hours: number) =>
    new AppError(HttpStatus.BAD_REQUEST, 'SHIFT_TOO_LONG', `한 번 근무는 ${hours}시간을 넘길 수 없어요.`),
  channelPostFailed: (name: string) =>
    new AppError(
      HttpStatus.BAD_GATEWAY,
      'CHANNEL_POST_FAILED',
      `${name}에 답글을 올리지 못했어요. 잠시 뒤 다시 시도해 주세요.`,
    ),
  inviteSmsDailyLimit: () =>
    new AppError(HttpStatus.TOO_MANY_REQUESTS, 'INVITE_SMS_DAILY_LIMIT', '오늘 보낼 수 있는 초대 문자를 다 썼어요.'),
  bizNoTaken: () =>
    new AppError(
      HttpStatus.CONFLICT,
      'BIZ_NO_TAKEN',
      '이미 다른 계정에 등록된 사업자등록번호예요. 운영팀에 문의해 주세요.',
    ),
  duplicateProperty: () =>
    new AppError(HttpStatus.BAD_REQUEST, 'DUPLICATE_PROPERTY', '같은 업장이 두 번 들어 있어요. 다시 확인해 주세요.'),
  validation: (message: string) => new AppError(HttpStatus.BAD_REQUEST, 'VALIDATION', message),
  badJson: () => new AppError(HttpStatus.BAD_REQUEST, 'BAD_JSON', '보낸 내용을 읽지 못했어요. 다시 시도해 주세요.'),
  roomLocked: () =>
    new AppError(HttpStatus.FORBIDDEN, 'ROOM_LOCKED', '판매 중지 객실은 사장님·매니저만 상태를 바꿀 수 있어요.'),
};
