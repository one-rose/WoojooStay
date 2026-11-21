import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Errors } from '../common/errors/app-error.js';
import { sha256 } from '../common/utils/crypto.js';
import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { clockQrPayload, clockSettings, distanceM, verifyClockQr, withinRadius } from './clock-presence.js';

/** 직원이 출퇴근을 찍을 때 보내는 확인 값 — 위치(latitude·longitude·accuracy) 또는 QR 내용 */
export interface ClockEvidence {
  latitude?: number;
  longitude?: number;
  /** 위치 정확도 (m) */
  accuracy?: number;
  /** 찍은 출근 QR 문자열 그대로 */
  qr?: string;
}

export interface PresenceCheck {
  method: 'GPS' | 'QR';
  /** 업장까지 거리 (m) — 위치로 확인했을 때만 */
  distanceM: number | null;
  radiusM: number;
  /** 업장 위치가 설정돼 있는지 — false 면 확인 없이 허용했으니 앱이 사장님께 설정 안내 */
  locationSet: boolean;
}

type ClockProperty = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  clockRadiusM: number;
  clockQrKeyVersion: number;
};

/** 출퇴근 위치·QR 확인 + 출근 QR 만들기 */
@Injectable()
export class ClockService {
  private readonly secret: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.secret =
      config.get('CLOCK_QR_SECRET', { infer: true }) ??
      sha256(`uzustay-clock-qr:${config.get('JWT_ACCESS_SECRET', { infer: true })}`);
  }

  property(propertyId: string): Promise<ClockProperty> {
    return this.prisma.property.findUniqueOrThrow({
      where: { id: propertyId },
      select: { id: true, name: true, latitude: true, longitude: true, clockRadiusM: true, clockQrKeyVersion: true },
    });
  }

  /** 앱·화면에 내려주는 출근 확인 설정 */
  static settings(p: Pick<ClockProperty, 'latitude' | 'longitude' | 'clockRadiusM'>) {
    return clockSettings(p);
  }

  private static location(ev: ClockEvidence) {
    const hasLat = ev.latitude !== undefined && ev.latitude !== null;
    const hasLng = ev.longitude !== undefined && ev.longitude !== null;
    if (hasLat !== hasLng) throw Errors.validation('위도와 경도를 함께 보내 주세요.');
    return hasLat ? { lat: ev.latitude!, lng: ev.longitude! } : null;
  }

  /** 요청 위치에서 업장까지 거리 (m) — 업장 위치나 요청 위치가 없으면 null */
  measure(p: ClockProperty, ev: ClockEvidence): number | null {
    const at = ClockService.location(ev);
    if (!at || p.latitude === null || p.longitude === null) return null;
    return Math.round(distanceM(at, { lat: p.latitude, lng: p.longitude }));
  }

  /**
   * 직원 본인이 찍을 때 — QR 이 있으면 QR 로, 위치가 있으면 반경으로 확인.
   * 업장 위치가 없으면 지금처럼 허용 (locationSet false). 업장 위치가 있는데 위치·QR 이 모두 없으면 LOCATION_REQUIRED.
   */
  async verify(propertyId: string, ev: ClockEvidence): Promise<PresenceCheck> {
    const p = await this.property(propertyId);
    const { locationSet, radiusM } = ClockService.settings(p);
    if (ev.qr !== undefined && ev.qr !== null) {
      const r = verifyClockQr(this.secret, ev.qr, propertyId, p.clockQrKeyVersion);
      if (!r.ok) {
        if (r.reason === 'OTHER_PROPERTY') throw Errors.qrOtherProperty();
        if (r.reason === 'OLD_VERSION') throw Errors.qrExpired();
        throw Errors.qrInvalid();
      }
      return { method: 'QR', distanceM: this.measure(p, ev), radiusM, locationSet };
    }
    const at = ClockService.location(ev);
    if (!locationSet) return { method: 'GPS', distanceM: null, radiusM, locationSet };
    if (!at) throw Errors.locationRequired();
    const d = this.measure(p, ev)!;
    const accuracy = ev.accuracy ?? 0;
    if (!withinRadius(d, radiusM, accuracy)) throw Errors.outOfRange(d, radiusM, ev.accuracy ?? null);
    return { method: 'GPS', distanceM: d, radiusM, locationSet };
  }

  /** 출근 QR (인쇄용) — 사장님·매니저 */
  async qr(propertyId: string) {
    const p = await this.property(propertyId);
    return {
      propertyId,
      propertyName: p.name,
      keyVersion: p.clockQrKeyVersion,
      payload: clockQrPayload(this.secret, propertyId, p.clockQrKeyVersion),
    };
  }

  /** QR 새로 만들기 — 키 번호를 올려 예전에 인쇄한 QR 을 막는다 (사장님) */
  async rotateQr(propertyId: string) {
    await this.prisma.property.update({
      where: { id: propertyId },
      data: { clockQrKeyVersion: { increment: 1 } },
    });
    return this.qr(propertyId);
  }

  /** 테스트·시드용 — 이 업장의 지금 QR 내용 */
  payloadFor(propertyId: string, keyVersion: number) {
    return clockQrPayload(this.secret, propertyId, keyVersion);
  }
}
