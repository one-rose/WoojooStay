import type { HomeContent } from "@/core";

/**
 * 홈 화면 한국어 콘텐츠.
 * 문구·숫자 수정은 이 파일에서만 한다. (화면 구조는 src/ui 에 있음)
 * 대시보드·리뷰 등의 숫자는 모두 예시 데이터다.
 */
export const homeContentKo: HomeContent = {
  meta: {
    title: "우주스테이 | 우주 핀테크 플랫폼",
    description:
      "AI 리뷰 자동댓글로 쉽게 시작하고, 예약·매출 데이터를 쌓아 선정산·미래매출·알바·지출까지 연결하는 숙박업 운영 플랫폼",
  },

  header: {
    nav: [
      { label: "서비스", href: "#service" },
      { label: "핵심 가치", href: "#value" },
      { label: "파트너", href: "#partner" },
    ],
    cta: { label: "도입 문의하기", href: "#partner" },
  },

  hero: {
    badge: "HOSPITALITY BUSINESS OS",
    title: ["리뷰에서 시작해,", "숙박업의 모든 경영을", "한 궤도에."],
    lead: [
      "AI 리뷰 자동댓글로 쉽게 시작하고, 예약·매출 데이터를 쌓아",
      "선정산·미래매출·알바·지출까지 연결하는 숙박업 운영 플랫폼",
    ],
    primaryCta: { label: "무료로 시작하기", href: "#service" },
    secondaryCta: { label: "서비스 보기", href: "#service" },
    orbit: [
      { illustration: "chat", title: "AI REVIEW", caption: "리뷰자동답변" },
      { illustration: "ledger", title: "매출장부", caption: "실시간 매출관리" },
      { illustration: "wallet", title: "선정산", caption: "빠른 정산 지원" },
      { illustration: "people", title: "알바관리", caption: "스케줄근태관리" },
      { illustration: "receipt", title: "지출관리", caption: "비용을 한 눈에" },
    ],
    dashboard: {
      brand: "WOOJOO STAY",
      liveLabel: "LIVE DATA",
      kpis: [
        { label: "오늘 예약매출", value: { amount: 4_820_000 }, note: "어제 대비 +12.4%", noteTone: "strong" },
        { label: "리뷰 미답변", value: { count: 8, unit: "건" }, note: "AI 답글 생성 가능", noteTone: "strong" },
        { label: "정산 예정", value: { amount: 12_640_000 }, note: "7일 이내", noteTone: "soft" },
      ],
      channelChart: {
        title: "채널별 예약매출",
        channels: [
          { channel: "yanolja", value: 55 },
          { channel: "yeogi", value: 87 },
          { channel: "naver", value: 67 },
          { channel: "agoda", value: 113 },
          { channel: "kkulstay", value: 81 },
          { channel: "bear", value: 123 },
          { channel: "other", value: 97 },
          { channel: "airbnb", value: 135 },
        ],
      },
      aiReview: {
        title: "AI REVIEW",
        quote: ["객실이 깨끗하고", "직원분들이 친절해요"],
        replyLabel: "AI 답글",
        reply: ["소중한 후기 감사합니다.", "편안한 투숙이 되셨다니", "저희도 기쁩니다."],
        action: "답글 게시하기",
      },
      currentStep: { eyebrow: "STEP 01", title: "AI 리뷰로 고객을 연결" },
      nextStep: { eyebrow: "NEXT", title: "매출 데이터가 쌓입니다" },
    },
  },

  platformStrip: {
    lead: { before: "4대 ", emphasis: "예약 플랫폼 리뷰", after: "부터 시작" },
    platforms: ["yanolja", "yeogi", "agoda", "naver"],
  },

  aiReview: {
    intro: {
      eyebrow: "SERVICE 01",
      title: ["우주스테이 AI 자동리뷰댓글"],
      description: [
        "가장 자주 반복되는 운영업무부터 AI가 대신합니다.",
        "야놀자를 중심으로 4대 플랫폼 리뷰를 모아 빠르게 답글을 생성하고 관리합니다.",
      ],
    },
    features: [
      { title: "4대 플랫폼 통합", description: "여러 채널의 리뷰를 한 화면에 모아 확인" },
      { title: "호텔 톤앤매너 학습", description: "숙박업소별 응대 문체를 설정해 일관되게 답변" },
      { title: "구독형 진입 서비스", description: "부담 없이 시작해 자연스럽게 매출 데이터 서비스로 연결" },
    ],
    panel: {
      title: "우주스테이 AI자동 리뷰 관리",
      status: "AI ON",
      tabs: [
        { label: "전체", count: 84, active: true },
        { label: "미답변", count: 8 },
        { label: "긍정", count: 61 },
        { label: "개선요청", count: 15 },
      ],
      reviews: [
        {
          platform: "yanolja",
          rating: 4,
          text: "체크인이 빨랐고 직원분이 친절했습니다.",
          aiNote: "“빠른 체크인·친절 응대” 키워드를 반영했습니다.",
        },
        {
          platform: "yeogi",
          rating: 5,
          text: "조식이 맛있고 수영장 관리가 잘 되어 있었어요.",
          aiNote: "“조식·부대시설” 만족 포인트를 짚어 감사 답글을 작성했습니다.",
        },
        {
          platform: "naver",
          rating: 5,
          text: "방이 깔끔하고 침구가 편안했어요.",
          aiNote: "“깨끗함·편안함” 중심으로 감사 답글을 작성했습니다.",
        },
        {
          platform: "agoda",
          rating: 5,
          text: "출장으로 이용했는데 위치가 정말 좋습니다.",
          aiNote: "비즈니스 고객 관점의 재방문 유도 문장을 제안했습니다.",
        },
      ],
    },
    callout: {
      eyebrow: "고객 획득 포인트",
      flow: ["“리뷰 업무를 줄여드립니다”로 가입", "이후 매출 데이터 서비스 확장"],
      mascotAlt: "AI가 알아서 리뷰에 답변해요",
    },
  },

  ledger: {
    intro: {
      eyebrow: "SERVICE 02",
      title: ["우주스테이 디지털매출장부"],
      description: [
        "예약·매출·광고비·정산 예정액을 한 화면에서 연결합니다.",
        "리뷰로 들어온 고객이 실제 매출 흐름까지 관리할 수 있도록 두 번째 구독 서비스를 제공합니다.",
      ],
      illustration: "mock-ledger",
    },
    dashboard: {
      title: "9월 경영 대시보드",
      period: "2026.10",
      kpis: [
        { label: "총 예약매출", amount: 68_420_000, note: "+8.4%" },
        { label: "광고비", amount: 5_760_000, note: "매출의 8.4%" },
        { label: "플랫폼 비용", amount: 6_310_000, note: "평균 9.2%" },
        { label: "정산 예정", amount: 32_840_000, note: "14일 이내" },
      ],
      trendTitle: "예약매출 추이",
      settlement: { label: "정산 캘린더", amount: 12_640_000, note: "7일 이내 입금 예정" },
      adEfficiency: { label: "광고 효율", caption: "광고비 대비 예약매출", ratio: 11.9 },
    },
    bridge: "모든 데이터가 쌓이면, 우주스테이의 금융을 연결할 수 있습니다.",
  },

  finance: {
    intro: {
      eyebrow: "SERVICE 03",
      title: ["매출을 기다리는 시간을,", "운영 가능한 현금흐름으로."],
      description: [
        "정산을 기다리는 매출과 앞으로 발생할 매출을 자금 흐름으로 연결합니다.",
        "금융은 첫 서비스가 아니라, 운영 데이터가 충분히 쌓인 뒤 확장되는 세 번째 축입니다.",
      ],
      illustration: "mock-finance",
    },
    brandPrefix: "우주스테이",
    products: [
      {
        name: "매출선정산",
        description: [
          "이미 발생한 예약·숙박 매출의 정산 예정액을 기반으로",
          "정산일까지 기다리지 않고 운영자금을 확보하도록 설계합니다.",
        ],
        metricLabel: "정산 예정액",
        amount: 32_840_000,
      },
      {
        name: "미래매출선지급",
        description: [
          "예약 흐름과 매출 패턴을 기반으로 미래 현금흐름을 예측하고",
          "운영계획에 필요한 자금을 선제적으로 확보하도록 설계합니다.",
        ],
        metricLabel: "예상 미래매출",
        amount: 74_200_000,
      },
    ],
    flowCaption: "예약·매출 데이터",
    flow: ["DATA", "FINANCE", "CASH"],
    orbitBand: {
      label: "WOOJOO ORBIT",
      flow: ["리뷰", "매출 데이터", "정산", "현금흐름"],
      tagline: "숙박업의 현금흐름을 하나의 궤도로",
    },
  },

  operations: {
    intro: {
      eyebrow: "SERVICE 04",
      title: ["매출을 넘어, 사람과 비용까지."],
      description: [
        "숙박업소의 실제 운영을 구성하는 직원과 지출까지 연결합니다.",
        "우주스테이는 결국 “매출관리 앱”이 아니라 숙박업 경영 전체를 보는 운영 OS로 확장됩니다.",
      ],
      illustration: "mock-ops",
    },
    brandPrefix: "우주스테이",
    staffing: {
      name: "알바관리",
      description: [
        "근로계약 · 근태관리 · 급여내역을 한 곳에서 연결",
        "직원별 근무 흐름과 인건비를 매출 데이터와 함께 확인",
      ],
      panelTitle: "이번 달 직원 운영",
      staff: [
        { name: "김지연", role: "프런트", hours: 176, pay: 2_740_000 },
        { name: "박선우", role: "하우스키핑", hours: 164, pay: 2_310_000 },
        { name: "이민지", role: "야간", hours: 152, pay: 2_580_000 },
      ],
    },
    expenses: {
      name: "지출관리",
      description: ["물품·자재비·전기료·수도요금 등 고정·변동비 관리", "매출과 비용을 함께 보고 실제 수익구조를 이해"],
      panelTitle: "9월 주요 지출",
      items: [
        { label: "객실용품", amount: 3_120_000 },
        { label: "전기·가스", amount: 2_480_000 },
        { label: "세탁·린넨", amount: 1_860_000 },
        { label: "수도·기타", amount: 1_140_000 },
      ],
    },
  },

  roadmap: {
    eyebrow: "WOOJOOSTAY\u00a0 ROADMAP",
    title: "서비스는 순서대로 커집니다",
    description: [
      "한 번에 모든 기능을 파는 것이 아니라, “자주 쓰는 업무”에서 시작해",
      "데이터와 신뢰가 쌓일수록 금융과 경영관리로 확장합니다.",
    ],
    brandPrefix: "우주스테이",
    steps: [
      { badge: "NOW", name: "AI 자동리뷰댓글", tags: ["구독", "고객획득"], icon: "brand" },
      { badge: "NEXT", name: "디지털매출장부", tags: ["구독", "데이터"], icon: "book" },
      { name: "매출선정산", tags: ["금융", "현금흐름"], icon: "wallet" },
      { name: "미래매출선지급", tags: ["금융", "예측"], icon: "wallet" },
      { name: "알바관리", tags: ["운영", "인건비"], icon: "people" },
      { name: "지출관리", tags: ["운영", "비용"], icon: "receipt" },
    ],
    growth: {
      label: "GROWTH LOGIC",
      flow: ["리뷰로 가입", "매출 데이터 축적", "금융 연결", "운영관리 확장"],
      nodes: [
        { illustration: "join", label: "가입" },
        { illustration: "data", label: "데이터" },
        { illustration: "finance", label: "금융" },
        { illustration: "ops", label: "운영" },
        { illustration: "revisit", label: "재방문" },
      ],
    },
  },

  values: {
    eyebrow: "WOOJOO STAY",
    title: ["숙박업 사장님의 하루를", "데이터로 더 가볍게."],
    description: [
      "우주스테이의 핵심은 기능을 많이 넣는 것이 아니라,",
      "숙박업의 실제 업무 흐름을 끊기지 않게 연결하는 것입니다.",
    ],
    items: [
      { title: "쉽게 시작", description: ["리뷰 답글이라는 명확한 문제부터 해결", "구독으로 진입 장벽을 낮춥니다."] },
      {
        title: "데이터가 쌓임",
        description: ["예약·매출·광고비·정산 데이터를 연결", "경영 판단에 필요한 기준을 만듭니다."],
      },
      { title: "운영 전체로 확장", description: ["현금흐름·알바·지출까지 연결", "숙박업 운영 OS로 성장합니다."] },
    ],
    band: {
      eyebrow: "WOOJOO STAY",
      message: "리뷰부터 매출·정산·알바·지출까지, 숙박업의 모든 흐름을 한 궤도에.",
    },
  },

  footer: {
    descriptor: "Hospitality Business OS",
    cta: { label: "파트너 도입 문의", href: "#partner" },
    slogan: "리뷰에서 시작해, 숙박업의 모든 경영을 한 궤도에.",
    keywords: ["AI", "DATA", "FINANCE", "OPERATION"],
    copyright: "WOOJOO STAY. All rights reserved.",
  },
};
