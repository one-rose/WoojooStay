import type { HomeContent } from "@/core";

/** 홈 화면 문구·숫자 (ko) — 문구 수정은 이 파일에서 */
export const homeContentKo: HomeContent = {
  meta: {
    title: "우주스테이 WOOJOO STAY | Hospitality Business OS",
    description:
      "고객 리뷰에서 시작해 숙박업의 모든 경영을 한 궤도에. AI 고객 리뷰 자동답변, 디지털매출장부, 매출선정산, 알바관리, 지출관리까지 연결하는 숙박업 운영 플랫폼.",
    ogTitle: "우주스테이 WOOJOO STAY",
    ogDescription: "고객 리뷰에서 시작해, 숙박업의 모든 경영을 한 궤도에.",
  },
  platformNames: {
    yanolja: "야놀자",
    yeogi: "여기어때",
    agoda: "아고다",
    naver: "네이버",
    trip: "트립닷컴",
    hotels: "호텔스닷컴",
    onda: "온다",
    kkul: "꿀스테이",
    ddnayo: "떠나요닷컴",
  },
  header: {
    navLabel: "주요 메뉴",
    nav: [
      { label: "서비스", href: "#service" },
      { label: "핵심 가치", href: "#value" },
      { label: "파트너", href: "#partner" },
    ],
    cta: { label: "도입 문의하기", href: "#partner" },
  },
  hero: {
    badge: "HOSPITALITY BUSINESS OS",
    title: ["고객 리뷰에서 시작해,", "숙박업의 모든 경영을", "한 궤도에."],
    lead: [
      "AI 고객 리뷰 자동답변으로 쉽게 시작하고, 예약·매출 데이터를 쌓아",
      "선정산·미래매출·알바·지출까지 연결하는 숙박업 운영 플랫폼",
    ],
    orbitLabel: "우주스테이 서비스 구성",
    orbit: [
      { illustration: "chat", title: "AI REVIEW", caption: "고객 리뷰 자동답변" },
      { illustration: "ledger", title: "매출장부", caption: "실시간 매출·예약" },
      { illustration: "wallet", title: "선정산", caption: "빠른 정산 지원" },
      { illustration: "people", title: "알바관리", caption: "근태·급여·계약" },
      { illustration: "receipt", title: "지출관리", caption: "세금·지출 한눈에" },
    ],
    primaryCta: { label: "무료로 시작하기", href: "#service" },
    secondaryCta: { label: "서비스 보기", href: "#service" },
    dashboard: {
      brand: "WOOJOO STAY",
      liveLabel: "LIVE DATA",
      kpis: [
        { label: "오늘 예약매출", value: { amount: 4820000 }, note: "어제 대비 +12.4%", noteTone: "strong" },
        { label: "고객 리뷰 미답변", value: { count: 8, unit: "건" }, note: "AI 답글 생성 가능", noteTone: "strong" },
        { label: "정산 예정", value: { amount: 12640000 }, note: "7일 이내", noteTone: "soft" },
      ],
      channelChart: {
        title: "채널별 예약매출",
        channels: [
          { platform: "yanolja", value: 104 },
          { platform: "yeogi", value: 94 },
          { platform: "agoda", value: 85 },
          { platform: "naver", value: 77 },
          { platform: "trip", value: 69 },
          { platform: "hotels", value: 61 },
          { platform: "onda", value: 54 },
          { platform: "kkul", value: 47 },
          { platform: "ddnayo", value: 40 },
        ],
      },
      aiReview: {
        title: "AI REVIEW",
        quote: ["객실이 깨끗하고", "직원분들이 친절해요"],
        replyLabel: "AI 답글",
        reply: ["소중한 후기 감사합니다.", "편안한 투숙이 되셨다니", "저희도 기쁩니다."],
        action: "답글 게시하기",
      },
      currentStep: { label: "STEP 01", text: "AI 고객 리뷰 답변으로 고객과 연결" },
      nextStep: { label: "NEXT", text: "매출 데이터가 쌓입니다" },
    },
  },
  platformStrip: {
    lead: { before: "전체 숙박 ", emphasis: "예약 플랫폼 고객 리뷰", after: "로 확대 중" },
    platforms: [
      { platform: "yanolja", label: "야놀자" },
      { platform: "yeogi", label: "여기어때" },
      { platform: "agoda", label: "아고다" },
      { platform: "naver", label: "네이버예약" },
      { platform: "trip", label: "트립닷컴" },
      { platform: "hotels", label: "호텔스닷컴" },
      { platform: "onda", label: "온다" },
      { platform: "kkul", label: "꿀스테이" },
      { platform: "ddnayo", label: "떠나요닷컴" },
    ],
  },
  trustStats: {
    label: "우주스테이 이용 가맹점",
    items: [
      { value: 125, unit: "곳", label: "우주스테이 이용 가맹점", description: "전국 숙박업소가 함께하고 있어요" },
      {
        value: 9,
        unit: "개",
        label: "연동 숙박 예약 채널",
        description: "야놀자 · 여기어때 · 아고다 · 네이버 · 트립닷컴 · 호텔스닷컴 · 온다 · 꿀스테이 · 떠나요닷컴",
      },
      {
        value: 5,
        unit: "개",
        label: "하나로 연결되는 서비스",
        description: "고객 리뷰 · 매출예약 · 금융 · 알바 · 지출",
      },
      { value: 24, unit: "시간", label: "AI 고객 리뷰 응대", description: "새 고객 리뷰에 쉬지 않고 답변 준비" },
    ],
    note: "※ 가맹점 수 2026년 10월 기준",
  },
  aiReview: {
    eyebrow: "SERVICE 01",
    title: "우주스테이 AI 고객 리뷰 자동답변",
    description: [
      "반복되는 고객 리뷰 응대 업무를 AI가 대신해 업무 효율을 높입니다.",
      "숙박 예약 플랫폼의 고객 리뷰를 한 화면에 모아 빠르게 답글을 생성하고 관리합니다.",
    ],
    features: [
      { title: "숙박 예약 플랫폼 통합 관리", description: "여러 채널의 고객 리뷰를 한 화면에 모아 확인" },
      { title: "호텔 톤앤매너 학습", description: "숙박업소별 응대 문체를 설정해 일관되게 답변" },
      { title: "구독형 진입 서비스", description: "부담 없이 시작해 자연스럽게 매출 데이터 서비스로 연결" },
    ],
    panel: {
      title: "우주스테이 AI 고객 리뷰 관리",
      status: "AI ON",
      tabs: [{ label: "전체 84", active: true }, { label: "미답변 8" }, { label: "긍정 61" }, { label: "개선요청 15" }],
      ratingLabel: "별점",
      photoAlt: "고객 리뷰 첨부 사진",
      reviews: [
        {
          platform: "yanolja",
          tag: "야놀자",
          rating: 4,
          text: "체크인이 빨랐고 직원분이 친절했습니다.",
          aiNote: "“빠른 체크인·친절 응대” 키워드를 반영했습니다.",
          photos: ["lobby", "hall"],
          morePhotos: 2,
        },
        {
          platform: "yeogi",
          tag: "여기어때",
          rating: 5,
          text: "조식이 맛있고 수영장 관리가 잘 되어 있었어요.",
          aiNote: "“조식·부대시설” 만족 포인트를 짚어 감사 답글을 작성했습니다.",
          photos: ["breakfast", "room"],
          morePhotos: 3,
        },
        {
          platform: "naver",
          tag: "네이버",
          rating: 5,
          text: "방이 깔끔하고 침구가 편안했어요.",
          aiNote: "“깨끗함·편안함” 중심으로 감사 답글을 작성했습니다.",
          photos: ["room", "cityroom"],
          morePhotos: 2,
        },
        {
          platform: "agoda",
          tag: "아고다",
          rating: 5,
          text: "출장으로 이용했는데 위치가 정말 좋습니다.",
          aiNote: "비즈니스 고객 관점의 재방문 유도 문장을 제안했습니다.",
          photos: ["cityroom", "lobby"],
          morePhotos: 1,
        },
      ],
    },
    callout: {
      eyebrow: "고객 획득 포인트",
      flow: ["“고객 리뷰 업무, 운영, 업무 시간을 줄여드립니다”", "고객 마케팅으로 객실 예약 활성화 연결"],
      robot: "robot",
      robotAlt: "AI가 알아서 고객 리뷰에 답변해요",
    },
  },
  ledger: {
    intro: {
      eyebrow: "SERVICE 02",
      title: ["우주스테이 디지털매출장부"],
      description: [
        "실시간 매출·예약을 관리하고, 외부 숙박 채널의 가격 노출과 경쟁력을 고려해 예약 데이터를 세팅하여 객실 예약률을 높입니다.",
        "예약 데이터를 분석해 고객 데이터셋을 구축하고, 마케팅 채널로 활용할 수 있도록 제공합니다.",
      ],
      illustration: "mock-ledger",
    },
    dashboard: {
      title: "9월 경영 대시보드",
      period: "2026.09",
      kpis: [
        { label: "총 예약매출", amount: 68420000, note: "+8.4%" },
        { label: "광고비", amount: 5760000, note: "매출의 8.4%" },
        { label: "플랫폼 비용", amount: 6310000, note: "평균 9.2%" },
        { label: "정산 예정", amount: 32840000, note: "14일 이내" },
      ],
      trend: {
        title: "예약매출 추이",
        axis: ["25.11", "25.12", "26.01", "26.02", "26.03", "26.04", "26.05", "26.06", "26.07", "26.08"],
      },
      settlement: { label: "정산 캘린더", amount: 12640000, note: "7일 이내 입금 예정" },
      adEfficiency: { label: "광고 효율", caption: "광고비 대비 예약매출", ratio: 11.9 },
    },
    bridge: "모든 데이터가 쌓이면, 우주스테이의 금융을 연결할 수 있습니다.",
  },
  finance: {
    intro: {
      eyebrow: "SERVICE 03",
      title: ["매출을 기다리는 시간을,", "운영 가능한 현금흐름으로."],
      description: [
        "매출 현황과 입금, 자금 조달을 원활하게 연결하는 금융 핀테크 서비스입니다.",
        "미래매출채권을 통해 앞으로 발생할 매출을 빠르게 유동화하도록 지원합니다.",
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
        amount: 32840000,
      },
      {
        name: "미래매출선지급",
        description: [
          "예약 흐름과 매출 패턴을 기반으로 미래매출채권을 산정하고",
          "필요한 운영자금을 빠르게 유동화하도록 설계합니다.",
        ],
        metricLabel: "예상 미래매출",
        amount: 74200000,
      },
    ],
    flowCaption: "예약·매출 데이터",
    flow: ["DATA", "FINANCE", "CASH"],
    orbitBand: {
      label: "WOOJOO ORBIT",
      flow: ["고객 리뷰", "매출 데이터", "정산", "현금흐름"],
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
        "알바·임직원의 근태 · 급여 · 근로계약 등 노무 업무를 지원",
        "직원별 근무 흐름과 인건비를 매출 데이터와 함께 확인",
      ],
      panelTitle: "이번 달 직원 운영",
      staff: [
        { initial: "김", name: "김지연", role: "프런트", hours: 176, pay: 2740000 },
        { initial: "박", name: "박선우", role: "하우스키핑", hours: 164, pay: 2310000 },
        { initial: "이", name: "이민지", role: "야간", hours: 152, pay: 2580000 },
      ],
    },
    expenses: {
      name: "지출관리",
      description: ["각종 세금 · 지출 항목 · 발주 업무를 하나로 통합", "매출과 지출의 정산 데이터를 한눈에 파악"],
      panelTitle: "9월 주요 지출",
      items: [
        { label: "객실용품", amount: 3120000 },
        { label: "전기·가스", amount: 2480000 },
        { label: "세탁·린넨", amount: 1860000 },
        { label: "세금·기타", amount: 1140000 },
      ],
    },
  },
  useCases: {
    eyebrow: "USE CASE",
    title: "숙박 유형별로 이렇게 씁니다",
    description: "업장 규모와 운영 방식에 맞춰 필요한 서비스부터 시작하세요.",
    recommendLabel: "추천 서비스",
    cases: [
      {
        type: "hotel",
        label: "호텔",
        headline: "다채널 예약과 가격 경쟁을 한 화면에서",
        points: [
          "채널별 가격 노출과 예약 데이터를 실시간으로 비교",
          "프런트 · 하우스키핑 교대 근무와 급여 정산 자동화",
          "많은 고객 리뷰도 호텔 톤앤매너로 일관되게 답변",
        ],
        services: ["디지털매출장부", "알바관리", "AI 고객 리뷰 자동답변"],
      },
      {
        type: "motel",
        label: "모텔",
        headline: "회전율 높은 객실, 매출과 정산을 빠르게",
        points: [
          "대실 · 숙박 매출을 실시간으로 집계",
          "정산 대기 매출을 선정산으로 운영자금화",
          "야간 알바 근태와 급여를 간편하게",
        ],
        services: ["디지털매출장부", "매출선정산", "알바관리"],
      },
      {
        type: "pension",
        label: "펜션",
        headline: "소규모 운영, 고객 리뷰와 지출부터 가볍게",
        points: [
          "사장님 혼자서도 고객 리뷰 답글을 자동으로",
          "성수기 · 비수기 예약 흐름으로 미래매출 예측",
          "세금 · 공과금 · 소모품 지출을 한눈에",
        ],
        services: ["AI 고객 리뷰 자동답변", "미래매출선지급", "지출관리"],
      },
      {
        type: "guesthouse",
        label: "게스트하우스",
        headline: "해외 고객 리뷰까지 빠르게",
        points: [
          "해외 예약 플랫폼 고객 리뷰도 한 화면에서 관리",
          "예약 데이터로 재방문 고객 마케팅",
          "소수 스태프의 스케줄과 근태 관리",
        ],
        services: ["AI 고객 리뷰 자동답변", "디지털매출장부", "알바관리"],
      },
    ],
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
      { badge: "NOW", name: "AI 고객 리뷰 자동답변", tags: ["구독", "고객획득"], icon: "brand" },
      { badge: "NEXT", name: "디지털매출장부", tags: ["구독", "데이터"], icon: "book" },
      { name: "매출선정산", tags: ["금융", "현금흐름"], icon: "wallet" },
      { name: "미래매출선지급", tags: ["금융", "예측"], icon: "wallet" },
      { name: "알바관리", tags: ["운영", "인건비"], icon: "people" },
      { name: "지출관리", tags: ["운영", "비용"], icon: "receipt" },
    ],
    growth: {
      label: "GROWTH LOGIC",
      flow: ["고객 리뷰로 가입", "매출 데이터 축적", "금융 연결", "운영관리 확장"],
      nodes: [
        { illustration: "join", label: "가입" },
        { illustration: "data", label: "데이터" },
        { illustration: "finance", label: "금융" },
        { illustration: "ops", label: "운영" },
        { illustration: "revisit", label: "재방문" },
      ],
    },
  },
  easyStart: {
    eyebrow: "EASY START",
    title: "도입은 가볍게, 효과는 바로",
    steps: [
      { title: "기존 예약 채널 그대로", description: "지금 쓰는 숙박 예약 플랫폼 계정을 그대로 연동합니다." },
      { title: "설치 없이 바로 시작", description: "웹과 모바일에서 바로 사용, 별도 장비가 필요 없습니다." },
      { title: "부담 없는 구독", description: "필요한 서비스만 골라 월 구독으로 시작합니다." },
      { title: "1:1 도입 지원", description: "가입부터 채널 연동까지 담당 매니저가 함께합니다." },
    ],
    primaryCta: { label: "무료 도입 상담", href: "#partner" },
    secondaryCta: { label: "서비스 소개서 받기", href: "#partner" },
  },
  values: {
    eyebrow: "WOOJOO STAY",
    title: ["숙박업 사장님의 하루를", "데이터로 더 가볍게."],
    description: [
      "우주스테이의 핵심은 기능을 많이 넣는 것이 아니라,",
      "숙박업의 실제 업무 흐름을 끊기지 않게 연결하는 것입니다.",
    ],
    items: [
      {
        title: "쉽게 시작",
        description: ["고객 리뷰 답글이라는 명확한 문제부터 해결", "구독으로 진입 장벽을 낮춥니다."],
      },
      {
        title: "데이터가 쌓임",
        description: ["예약·매출·광고비·정산 데이터를 연결", "경영 판단에 필요한 기준을 만듭니다."],
      },
      { title: "운영 전체로 확장", description: ["현금흐름·알바·지출까지 연결", "숙박업 운영 OS로 성장합니다."] },
    ],
    band: { eyebrow: "WOOJOO STAY", message: "고객 리뷰부터 매출·정산·알바·지출까지, 숙박업의 모든 흐름을 한 궤도에." },
  },
  footer: {
    descriptor: "Hospitality Business OS",
    cta: { label: "파트너 도입 문의", href: "#partner" },
    slogan: "고객 리뷰에서 시작해, 숙박업의 모든 경영을 한 궤도에.",
    keywords: "AI · DATA · FINANCE · OPERATION",
    copyright: "WOOJOO STAY. All rights reserved.",
  },
};
