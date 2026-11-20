import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import { exposeDevSecrets, type Env } from '../config/env.js';
import { Errors } from '../common/errors/app-error.js';
import { safeEqual, sha256, sixDigitCode } from '../common/utils/crypto.js';
import { dateOnly, kstDate } from '../common/utils/dates.js';
import { pilotInfo } from '../common/utils/pilot.js';
import { EventsService } from '../events/events.service.js';
import { VerificationPurpose } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SmsSender } from '../sms/sms-sender.js';
import type { LoginDto, ResetPasswordDto, SignupDto } from './dto/auth.dto.js';
import { TokensService } from './tokens.service.js';

const CODE_TTL_SEC = 180;
const MAX_ATTEMPTS = 5;
/** 같은 번호·같은 목적으로 다시 받기까지 (초) */
export const SMS_COOLDOWN_SEC = 60;
/** 같은 번호·같은 목적으로 하루(한국 날짜)에 받을 수 있는 횟수 */
export const SMS_DAILY_LIMIT = 10;
const PURPOSE = { signup: VerificationPurpose.SIGNUP, reset: VerificationPurpose.RESET_PASSWORD } as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsSender,
    private readonly tokens: TokensService,
    private readonly config: ConfigService<Env, true>,
    private readonly events: EventsService,
  ) {}

  /** F0-01 인증번호 발송 (3분 유효) */
  async sendCode(phone: string, purpose: 'signup' | 'reset') {
    const exists = await this.prisma.user.findUnique({ where: { phone } });
    if (purpose === 'signup' && exists) throw Errors.phoneTaken();
    // 재설정은 가입 여부를 알려주지 않는다 (번호 수집 방지) — 없는 번호면 조용히 끝냄
    const code = sixDigitCode();
    if (purpose === 'signup' || exists) {
      // 문자 폭탄·요금 남용 방지 — 번호·목적별로 1분에 한 번, 하루 10번 (동시에 눌러도 한 번만 통과)
      await this.prisma.withLock(`sms:${phone}:${purpose}`, async () => {
        await this.checkSmsQuota(phone, PURPOSE[purpose]);
        await this.prisma.phoneVerification.create({
          data: {
            phone,
            purpose: PURPOSE[purpose],
            codeHash: sha256(code),
            expiresAt: new Date(Date.now() + CODE_TTL_SEC * 1000),
          },
        });
      });
      await this.sms.send(phone, `[우주스테이] 인증번호 ${code} (3분 안에 입력해 주세요)`);
    }
    const dev = exposeDevSecrets(this.config.get('NODE_ENV', { infer: true }));
    return { expiresIn: CODE_TTL_SEC, ...(dev && (purpose === 'signup' || exists) ? { devCode: code } : {}) };
  }

  private async checkSmsQuota(phone: string, purpose: VerificationPurpose, now = new Date()) {
    const last = await this.prisma.phoneVerification.findFirst({
      where: { phone, purpose },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const since = last ? now.getTime() - last.createdAt.getTime() : Infinity;
    if (since < SMS_COOLDOWN_SEC * 1000) {
      throw Errors.smsCooldown(Math.max(1, Math.ceil((SMS_COOLDOWN_SEC * 1000 - since) / 1000)));
    }
    const dayStart = new Date(`${kstDate(now)}T00:00:00+09:00`);
    const today = await this.prisma.phoneVerification.count({
      where: { phone, purpose, createdAt: { gte: dayStart } },
    });
    if (today >= SMS_DAILY_LIMIT) throw Errors.smsDailyLimit();
  }

  async verifyCode(phone: string, purpose: 'signup' | 'reset', code: string) {
    const row = await this.prisma.phoneVerification.findFirst({
      where: { phone, purpose: PURPOSE[purpose], verifiedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!row) throw Errors.codeInvalid();
    if (row.expiresAt < new Date()) throw Errors.codeExpired();
    if (row.attempts >= MAX_ATTEMPTS) throw Errors.tooManyAttempts();
    if (!safeEqual(row.codeHash, sha256(code))) {
      await this.prisma.phoneVerification.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
      throw Errors.codeInvalid();
    }
    await this.prisma.phoneVerification.update({ where: { id: row.id }, data: { verifiedAt: new Date() } });
    return { verificationToken: await this.tokens.signVerification(phone, purpose) };
  }

  /** F0-01 가입 + F0-17 약관 동의 */
  async signup(dto: SignupDto) {
    const phone = await this.tokens.readVerification(dto.verificationToken, 'signup');
    if (!dto.agreements.terms || !dto.agreements.privacy) throw Errors.termsRequired();
    if (await this.prisma.user.findUnique({ where: { phone } })) throw Errors.phoneTaken();
    const now = new Date();
    const user = await this.prisma.user.create({
      data: {
        phone,
        name: dto.name.trim(),
        email: dto.email,
        passwordHash: await bcrypt.hash(dto.password, 10),
        termsAgreedAt: now,
        privacyAgreedAt: now,
        marketingAgreedAt: dto.agreements.marketing ? now : null,
      },
    });
    await this.linkEmployeeRecords(user);
    await this.tokens.touchLogin(user.id, true);
    return { user: this.publicUser(user), ...(await this.tokens.issue(user)) };
  }

  /**
   * 사장님이 직원 명단에 내 번호를 먼저 넣어 뒀으면 (재직 중 — 퇴사일 없음 또는 오늘 이후)
   * 그 업장 직원(STAFF)으로 넣고 직원 기록과 연결한다. 이미 구성원이면 권한은 그대로 둔다.
   * 이미 연결된 기록은 건드리지 않는다 — 사장님이 업장에서 뺀 계정이 다음 로그인 때 다시 들어오지 않게.
   */
  private async linkEmployeeRecords(user: { id: string; phone: string }) {
    const rows = await this.prisma.employee.findMany({
      where: {
        phone: user.phone,
        OR: [{ resignedAt: null }, { resignedAt: { gte: dateOnly(kstDate()) } }],
        userId: null,
      },
      select: { id: true, propertyId: true },
    });
    if (rows.length === 0) return;
    await this.prisma.$transaction([
      this.prisma.membership.createMany({
        data: [...new Set(rows.map((r) => r.propertyId))].map((propertyId) => ({
          userId: user.id,
          propertyId,
          role: 'STAFF' as const,
        })),
        skipDuplicates: true,
      }),
      this.prisma.employee.updateMany({
        where: { id: { in: rows.map((r) => r.id) }, userId: null },
        data: { userId: user.id },
      }),
    ]);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    // 번호가 없어도 같은 시간이 걸리도록 비교는 항상 한다
    const ok = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv',
    );
    if (!user || !ok) throw Errors.badCredentials();
    await this.linkEmployeeRecords(user);
    await this.tokens.touchLogin(user.id, true);
    return { user: this.publicUser(user), ...(await this.tokens.issue(user)) };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const phone = await this.tokens.readVerification(dto.verificationToken, 'reset');
    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) throw Errors.verificationRequired();
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(dto.password, 10) } }),
      // 비밀번호를 바꾸면 다른 기기 로그인은 모두 끊는다
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { ok: true };
  }

  /**
   * 내 정보 + 업장. 화면 서버가 요청마다 부르므로 '앱 열기' 사용 기록은 여기서 하루 한 번 남긴다 (PO-04).
   * properties[].pilot — 실증 업장이면 묶음·시작일·끝나는 날 (PO-11), features.rates — 요금·재고 메뉴를 보일지.
   * trialDays — 새 업장 무료 체험 일수 (온보딩·구독 문구용, PO-09).
   */
  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { memberships: { include: { property: true }, orderBy: { createdAt: 'asc' } } },
    });
    await this.events.recordDaily('APP_OPEN', { userId });
    const today = kstDate();
    return {
      ...this.publicUser(user),
      trialDays: this.config.get('TRIAL_DAYS', { infer: true }) ?? 30,
      properties: user.memberships.map((m) => {
        const pilot = pilotInfo(m.property, today);
        return {
          id: m.property.id,
          name: m.property.name,
          type: m.property.type,
          rooms: m.property.rooms,
          role: m.role,
          pilot,
          // 실증(1차 파일럿)에는 요금·재고가 없다 — 실증 기간 동안 메뉴를 숨긴다
          features: { rates: !pilot?.active },
        };
      }),
    };
  }

  private publicUser(u: { id: string; phone: string; name: string; email: string | null }) {
    return { id: u.id, phone: u.phone, name: u.name, email: u.email };
  }
}
