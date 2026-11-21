/**
 * 모바일 앱 예시 데이터 — 업장 출근 위치(위도·경도·반경)와 기다리는 출퇴근 요청 몇 건.
 * 정현(010-0000-0000) 10곳은 서울, 한소영(010-2000-0000) 10곳은 대전·충청 실제 동네 근처 좌표.
 * 여러 번 돌려도 된다 — 위치는 덮어쓰고, 요청은 업장에 기다리는 요청이 없을 때만 만든다.
 * seed-extra 가 마지막에 부르고, 지금 DB 에만 넣으려면: pnpm build && pnpm db:seed:mobile
 */
import { addDaysIso, dateOnly, kstDate } from './common/utils/dates.js';
import type { PrismaService } from './prisma/prisma.service.js';
import { distanceM } from './staff/clock-presence.js';

/** 업장 이름 → [위도, 경도, 반경 m] */
const LOCATIONS: Record<string, Record<string, [number, number, number?]>> = {
  '01000000000': {
    '스테이 오르빗 을지로': [37.566, 126.991],
    '스테이 오르빗 명동': [37.5636, 126.9826],
    '스테이 오르빗 종로': [37.5689, 126.986],
    '스테이 오르빗 성수': [37.5446, 127.0557],
    '스테이 오르빗 강남역': [37.4979, 127.0276, 120],
    '스테이 오르빗 홍대': [37.5563, 126.9236],
    '오르빗 모텔 신림': [37.4841, 126.9297],
    '스테이 오르빗 여의도': [37.5216, 126.9242, 200],
    '오르빗 게스트하우스 이태원': [37.5345, 126.9946, 100],
    '오르빗 한옥스테이 북촌': [37.5826, 126.985, 100],
  },
  '01020000000': {
    'RAINBOW HOTEL': [36.3518, 127.3786],
    '저스트슬립호텔 대전유성온천점': [36.3556, 127.346],
    '루오 호텔 대흥점': [36.326, 127.421],
    '브라운도트 호텔 대덕점': [36.357, 127.417],
    'N7 호텔': [36.3323, 127.4346],
    '호텔 온새미 천안': [36.8105, 127.1066, 200],
    '스테이 한밭 둔산': [36.3466, 127.3893],
    '청주 무심천 호텔': [36.6335, 127.4854],
    '세종 호수공원 스테이': [36.4985, 127.2717, 250],
    '공주 금강 한옥펜션': [36.4652, 127.1183, 300],
  },
};

/** 기다리는 요청 — [업장 이름, 사유, 몇 분 전, 업장에서 북쪽으로 몇 m (없으면 위치 없음)] */
const REQUESTS: [owner: string, property: string, reason: string, minutesAgo: number, offsetM: number | null][] = [
  ['01000000000', '스테이 오르빗 을지로', '휴대폰 위치가 안 잡혀요. 프런트 QR도 비닐이 반사돼서 안 찍혀요', 25, 640],
  ['01000000000', '스테이 오르빗 을지로', '배터리가 5%라 위치를 끄고 왔어요', 12, null],
  ['01000000000', '스테이 오르빗 명동', '지하 주차장 입구 쪽이라 위치가 멀게 나와요', 40, 310],
  ['01020000000', 'RAINBOW HOTEL', '새 휴대폰이라 앱 위치 권한을 아직 못 켰어요', 18, null],
  ['01020000000', 'N7 호텔', '건물 안에서 위치가 400m 밖으로 나와요', 35, 420],
];

export async function seedMobile(prisma: PrismaService): Promise<{ located: number; requests: number }> {
  let located = 0;
  for (const [phone, list] of Object.entries(LOCATIONS)) {
    const owner = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
    if (!owner) continue;
    for (const [name, [latitude, longitude, radius]] of Object.entries(list)) {
      const r = await prisma.property.updateMany({
        where: { name, memberships: { some: { userId: owner.id, role: 'OWNER' } } },
        data: { latitude, longitude, clockRadiusM: radius ?? 150 },
      });
      located += r.count;
    }
  }

  const today = kstDate();
  const now = Date.now();
  let requests = 0;
  const used = new Set<string>();
  for (const [phone, name, reason, minutesAgo, offsetM] of REQUESTS) {
    const p = await prisma.property.findFirst({
      where: { name, memberships: { some: { user: { phone }, role: 'OWNER' } } },
      select: { id: true, latitude: true, longitude: true },
    });
    if (!p) continue;
    if (!used.has(p.id) && (await prisma.clockRequest.count({ where: { propertyId: p.id, status: 'PENDING' } })) > 0)
      continue; // 이미 있으면 다시 만들지 않는다
    used.add(p.id);
    // 오늘 출근 기록이 없고, 기다리는 요청도 없는 재직 직원 (매니저 직무는 빼고)
    const candidates = await prisma.employee.findMany({
      where: {
        propertyId: p.id,
        jobRole: { not: 'MANAGER' },
        OR: [{ resignedAt: null }, { resignedAt: { gte: dateOnly(today) } }],
        hiredDate: { lte: dateOnly(addDaysIso(today, -1)) },
        attendances: { none: { workDate: dateOnly(today) } },
        clockRequests: { none: { status: 'PENDING' } },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    const e = candidates[0];
    if (!e) continue;
    const at =
      offsetM !== null && p.latitude !== null && p.longitude !== null
        ? { latitude: p.latitude + offsetM / 111_195, longitude: p.longitude }
        : null;
    await prisma.clockRequest.create({
      data: {
        propertyId: p.id,
        employeeId: e.id,
        type: 'IN',
        requestedAt: new Date(now - minutesAgo * 60_000),
        reason,
        latitude: at?.latitude ?? null,
        longitude: at?.longitude ?? null,
        accuracyM: at ? 35 : null,
        distanceM:
          at && p.latitude !== null && p.longitude !== null
            ? Math.round(distanceM({ lat: at.latitude, lng: at.longitude }, { lat: p.latitude, lng: p.longitude }))
            : null,
        createdAt: new Date(now - minutesAgo * 60_000),
      },
    });
    requests += 1;
  }
  return { located, requests };
}
