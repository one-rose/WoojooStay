import type { HomeContent } from "@/core";

/** 홈 화면 문구·숫자 (ja) — 문구 수정은 이 파일에서 */
export const homeContentJa: HomeContent = {
  meta: {
    title: "WOOJOO STAY | Hospitality Business OS",
    description:
      "AIレビュー自動返信で手軽に始め、予約・売上データを蓄積し 先払い精算・将来売上・アルバイト・支出までつなぐ宿泊業運営プラットフォーム",
    ogTitle: "WOOJOO STAY",
    ogDescription: "お客様のレビューから始め、宿泊業のすべての経営をひとつの軌道に。",
  },
  platformNames: {
    yanolja: "ヤノルジャ",
    yeogi: "ヨギオッテ",
    agoda: "アゴダ",
    naver: "NAVER",
    trip: "Trip.com",
    hotels: "Hotels.com",
    onda: "ONDA",
    kkul: "クルステイ",
    ddnayo: "トナヨ.com",
  },
  header: {
    navLabel: "メインメニュー",
    nav: [
      { label: "サービス", href: "#service" },
      { label: "コアバリュー", href: "#value" },
      { label: "パートナー", href: "#partner" },
    ],
    cta: { label: "導入のお問い合わせ", href: "#partner" },
  },
  hero: {
    badge: "HOSPITALITY BUSINESS OS",
    title: ["お客様のレビューから始め、", "宿泊業のすべての経営を", "ひとつの軌道に。"],
    lead: [
      "AIレビュー自動返信で手軽に始め、予約・売上データを蓄積し",
      "先払い精算・将来売上・アルバイト・支出までつなぐ宿泊業運営プラットフォーム",
    ],
    orbitLabel: "WOOJOO STAY サービス構成",
    orbit: [
      { illustration: "chat", title: "AI REVIEW", caption: "レビュー自動返信" },
      { illustration: "ledger", title: "売上台帳", caption: "リアルタイム売上・予約" },
      { illustration: "wallet", title: "先払い精算", caption: "スピード精算" },
      { illustration: "people", title: "アルバイト管理", caption: "勤怠・給与・契約" },
      { illustration: "receipt", title: "支出管理", caption: "税金・支出をひと目で" },
    ],
    primaryCta: { label: "無料ではじめる", href: "#service" },
    secondaryCta: { label: "サービスを見る", href: "#service" },
    dashboard: {
      brand: "WOOJOO STAY",
      liveLabel: "LIVE DATA",
      kpis: [
        { label: "本日の予約売上", value: { amount: 4820000 }, note: "前日比 +12.4%", noteTone: "strong" },
        { label: "未返信レビュー", value: { count: 8, unit: "件" }, note: "AI返信を作成可能", noteTone: "strong" },
        { label: "精算予定", value: { amount: 12640000 }, note: "7日以内", noteTone: "soft" },
      ],
      channelChart: {
        title: "チャネル別予約売上",
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
        quote: ["客室がきれいで", "スタッフも親切でした"],
        replyLabel: "AI返信",
        reply: ["温かいレビューをありがとうございます。", "快適にお過ごしいただけて", "私たちも嬉しいです。"],
        action: "返信を投稿",
      },
      currentStep: { label: "STEP 01", text: "AIレビューでお客様とつながる" },
      nextStep: { label: "NEXT", text: "売上データが蓄積されます" },
    },
  },
  platformStrip: {
    lead: { before: "", emphasis: "すべての宿泊予約プラットフォームのレビュー", after: "へ拡大中" },
    platforms: [
      { platform: "yanolja", label: "ヤノルジャ" },
      { platform: "yeogi", label: "ヨギオッテ" },
      { platform: "agoda", label: "アゴダ" },
      { platform: "naver", label: "NAVER予約" },
      { platform: "trip", label: "Trip.com" },
      { platform: "hotels", label: "Hotels.com" },
      { platform: "onda", label: "ONDA" },
      { platform: "kkul", label: "クルステイ" },
      { platform: "ddnayo", label: "トナヨ.com" },
    ],
  },
  trustStats: {
    label: "WOOJOO STAY 導入加盟店",
    items: [
      { value: 125, unit: "店舗", label: "WOOJOO STAY 導入加盟店", description: "全国の宿泊施設が利用しています" },
      {
        value: 9,
        unit: "",
        label: "連携予約チャネル",
        description: "ヤノルジャ・ヨギオッテ・アゴダ・NAVER・Trip.com・Hotels.com・ONDA・クルステイ・トナヨ.com",
      },
      {
        value: 5,
        unit: "つ",
        label: "ひとつにつながるサービス",
        description: "レビュー・売上予約・金融・アルバイト・支出",
      },
      { value: 24, unit: "時間", label: "AIレビュー対応", description: "新着レビューに休まず返信を準備" },
    ],
    note: "※ 加盟店数は2026年10月時点",
  },
  aiReview: {
    eyebrow: "SERVICE 01",
    title: "WOOJOO STAY AIレビュー自動返信",
    description: [
      "繰り返しのレビュー対応をAIが代行し、業務効率を高めます。",
      "宿泊予約プラットフォームのレビューを1画面に集め、素早く返信を作成・管理します。",
    ],
    features: [
      { title: "宿泊予約プラットフォームを一元管理", description: "複数チャネルのレビューを1画面に集約" },
      { title: "ホテルのトーン&マナーを学習", description: "施設ごとの応対文体を設定し、一貫して返信" },
      { title: "サブスク型エントリーサービス", description: "気軽に始めて、自然に売上データサービスへ" },
    ],
    panel: {
      title: "WOOJOO STAY AIレビュー管理",
      status: "AI ON",
      tabs: [
        { label: "すべて 84", active: true },
        { label: "未返信 8" },
        { label: "ポジティブ 61" },
        { label: "改善要望 15" },
      ],
      ratingLabel: "評価",
      photoAlt: "レビュー添付写真",
      reviews: [
        {
          platform: "yanolja",
          tag: "ヤノルジャ",
          rating: 4,
          text: "チェックインが早く、スタッフも親切でした。",
          aiNote: "「スピーディーなチェックイン・親切な対応」を反映しました。",
          photos: ["lobby", "hall"],
          morePhotos: 2,
        },
        {
          platform: "yeogi",
          tag: "ヨギオッテ",
          rating: 5,
          text: "朝食がおいしく、プールの管理も行き届いていました。",
          aiNote: "「朝食・付帯施設」の満足ポイントに触れてお礼の返信を作成しました。",
          photos: ["breakfast", "room"],
          morePhotos: 3,
        },
        {
          platform: "naver",
          tag: "NAVER",
          rating: 5,
          text: "部屋が清潔で、寝具も快適でした。",
          aiNote: "「清潔さ・快適さ」を中心にお礼の返信を作成しました。",
          photos: ["room", "cityroom"],
          morePhotos: 2,
        },
        {
          platform: "agoda",
          tag: "アゴダ",
          rating: 5,
          text: "出張で利用しましたが、立地が本当に良いです。",
          aiNote: "ビジネス客目線でリピートを促す文を提案しました。",
          photos: ["cityroom", "lobby"],
          morePhotos: 1,
        },
      ],
    },
    callout: {
      eyebrow: "顧客獲得ポイント",
      flow: ["「レビュー対応・運営・業務時間を削減します」", "顧客マーケティングで客室予約を活性化"],
      robot: "robot-notext",
      robotAlt: "AIがレビューに自動で返信",
    },
  },
  ledger: {
    intro: {
      eyebrow: "SERVICE 02",
      title: ["WOOJOO STAY デジタル売上台帳"],
      description: [
        "リアルタイムで売上・予約を管理し、外部宿泊チャネルでの価格露出と競争力を踏まえて予約データを設定し、客室の予約率を高めます。",
        "予約データを分析して顧客データセットを構築し、マーケティングチャネルとして活用できるよう提供します。",
      ],
      illustration: "mock-ledger-notext",
    },
    dashboard: {
      title: "9月 経営ダッシュボード",
      period: "2026.09",
      kpis: [
        { label: "予約売上合計", amount: 68420000, note: "+8.4%" },
        { label: "広告費", amount: 5760000, note: "売上の8.4%" },
        { label: "プラットフォーム費用", amount: 6310000, note: "平均 9.2%" },
        { label: "精算予定", amount: 32840000, note: "14日以内" },
      ],
      trend: {
        title: "予約売上の推移",
        axis: ["25.11", "25.12", "26.01", "26.02", "26.03", "26.04", "26.05", "26.06", "26.07", "26.08"],
      },
      settlement: { label: "精算カレンダー", amount: 12640000, note: "7日以内に入金予定" },
      adEfficiency: { label: "広告効率", caption: "広告費あたり予約売上", ratio: 11.9 },
    },
    bridge: "データが蓄積されれば、WOOJOO STAYの金融につなげられます。",
  },
  finance: {
    intro: {
      eyebrow: "SERVICE 03",
      title: ["売上を待つ時間を、", "運用できるキャッシュフローへ。"],
      description: [
        "売上状況・入金・資金調達をスムーズにつなぐ金融フィンテックサービスです。",
        "将来売上債権を通じて、これから発生する売上を素早く資金化できるよう支援します。",
      ],
      illustration: "mock-finance-notext",
    },
    brandPrefix: "WOOJOO STAY",
    products: [
      {
        name: "売上先払い精算",
        description: [
          "すでに発生した予約・宿泊売上の精算予定額をもとに、",
          "精算日を待たずに運転資金を確保できるよう設計します。",
        ],
        metricLabel: "精算予定額",
        amount: 32840000,
      },
      {
        name: "将来売上の先払い",
        description: [
          "予約の流れと売上パターンをもとに将来売上債権を算定し、",
          "必要な運転資金を素早く資金化できるよう設計します。",
        ],
        metricLabel: "予想将来売上",
        amount: 74200000,
      },
    ],
    flowCaption: "予約・売上データ",
    flow: ["DATA", "FINANCE", "CASH"],
    orbitBand: {
      label: "WOOJOO ORBIT",
      flow: ["レビュー", "売上データ", "精算", "キャッシュフロー"],
      tagline: "宿泊業のキャッシュフローをひとつの軌道に",
    },
  },
  operations: {
    intro: {
      eyebrow: "SERVICE 04",
      title: ["売上を超えて、人とコストまで。"],
      description: [
        "宿泊施設の実際の運営を構成するスタッフと支出までつなぎます。",
        "WOOJOO STAYは「売上管理アプリ」ではなく、宿泊業経営全体を見る運営OSへと広がります。",
      ],
      illustration: "mock-ops-notext",
    },
    brandPrefix: "WOOJOO STAY",
    staffing: {
      name: "アルバイト管理",
      description: [
        "アルバイト・従業員の勤怠・給与・労働契約などの労務業務を支援",
        "スタッフ別の勤務状況と人件費を売上データと一緒に確認",
      ],
      panelTitle: "今月のスタッフ運営",
      staff: [
        { initial: "キ", name: "キム・ジヨン", role: "フロント", hours: 176, pay: 2740000 },
        { initial: "パ", name: "パク・ソヌ", role: "ハウスキーピング", hours: 164, pay: 2310000 },
        { initial: "イ", name: "イ・ミンジ", role: "夜間", hours: 152, pay: 2580000 },
      ],
    },
    expenses: {
      name: "支出管理",
      description: ["各種税金・支出項目・発注業務をひとつに統合", "売上と支出の精算データをひと目で把握"],
      panelTitle: "9月の主な支出",
      items: [
        { label: "客室用品", amount: 3120000 },
        { label: "電気・ガス", amount: 2480000 },
        { label: "洗濯・リネン", amount: 1860000 },
        { label: "税金・その他", amount: 1140000 },
      ],
    },
  },
  useCases: {
    eyebrow: "USE CASE",
    title: "宿泊タイプ別の活用法",
    description: "施設の規模や運営スタイルに合わせて、必要なサービスから始めましょう。",
    recommendLabel: "おすすめサービス",
    cases: [
      {
        type: "hotel",
        label: "ホテル",
        headline: "マルチチャネル予約と価格競争を1画面で",
        points: [
          "チャネル別の価格露出と予約データをリアルタイムで比較",
          "フロント・ハウスキーピングのシフトと給与精算を自動化",
          "多くのレビューにもホテルのトーンで一貫して返信",
        ],
        services: ["デジタル売上台帳", "アルバイト管理", "AIレビュー自動返信"],
      },
      {
        type: "motel",
        label: "モーテル",
        headline: "回転率の高い客室、売上と精算をスピーディーに",
        points: [
          "デイユース・宿泊の売上をリアルタイムで集計",
          "精算待ちの売上を先払い精算で運転資金に",
          "夜間アルバイトの勤怠と給与をかんたん管理",
        ],
        services: ["デジタル売上台帳", "売上先払い精算", "アルバイト管理"],
      },
      {
        type: "pension",
        label: "ペンション",
        headline: "小規模運営は、レビューと支出から気軽に",
        points: [
          "オーナーおひとりでもレビュー返信を自動化",
          "繁忙期・閑散期の予約動向から将来売上を予測",
          "税金・公共料金・消耗品の支出をひと目で",
        ],
        services: ["AIレビュー自動返信", "将来売上の先払い", "支出管理"],
      },
      {
        type: "guesthouse",
        label: "ゲストハウス",
        headline: "海外ゲストのレビューにもスピーディーに",
        points: [
          "海外予約プラットフォームのレビューも1画面で管理",
          "予約データでリピーター向けマーケティング",
          "少人数スタッフのシフトと勤怠管理",
        ],
        services: ["AIレビュー自動返信", "デジタル売上台帳", "アルバイト管理"],
      },
    ],
  },
  roadmap: {
    eyebrow: "WOOJOOSTAY ROADMAP",
    title: "サービスは順番に広がります",
    description: [
      "すべての機能を一度に売るのではなく、「よく使う業務」から始め、",
      "データと信頼が積み重なるほど、金融と経営管理へ広げます。",
    ],
    brandPrefix: "WOOJOO STAY",
    steps: [
      { badge: "NOW", name: "AIレビュー自動返信", tags: ["サブスク", "顧客獲得"], icon: "brand" },
      { badge: "NEXT", name: "デジタル売上台帳", tags: ["サブスク", "データ"], icon: "book" },
      { name: "売上先払い精算", tags: ["金融", "キャッシュフロー"], icon: "wallet" },
      { name: "将来売上の先払い", tags: ["金融", "予測"], icon: "wallet" },
      { name: "アルバイト管理", tags: ["運営", "人件費"], icon: "people" },
      { name: "支出管理", tags: ["運営", "コスト"], icon: "receipt" },
    ],
    growth: {
      label: "GROWTH LOGIC",
      flow: ["レビューで加入", "売上データ蓄積", "金融連携", "運営管理へ拡張"],
      nodes: [
        { illustration: "join", label: "加入" },
        { illustration: "data", label: "データ" },
        { illustration: "finance", label: "金融" },
        { illustration: "ops", label: "運営" },
        { illustration: "revisit", label: "再訪" },
      ],
    },
  },
  easyStart: {
    eyebrow: "EASY START",
    title: "導入は気軽に、効果はすぐに",
    steps: [
      {
        title: "今の予約チャネルそのまま",
        description: "いま使っている宿泊予約プラットフォームのアカウントをそのまま連携します。",
      },
      { title: "インストール不要ですぐ開始", description: "Webとモバイルですぐ使え、専用機器は不要です。" },
      { title: "気軽なサブスク", description: "必要なサービスだけを選んで月額サブスクで始められます。" },
      { title: "1:1 導入サポート", description: "加入からチャネル連携まで担当マネージャーがサポートします。" },
    ],
    primaryCta: { label: "無料導入相談", href: "#partner" },
    secondaryCta: { label: "サービス資料を受け取る", href: "#partner" },
  },
  values: {
    eyebrow: "WOOJOO STAY",
    title: ["宿泊業オーナーの一日を", "データでもっと軽やかに。"],
    description: [
      "WOOJOO STAYの核心は機能を詰め込むことではなく、",
      "宿泊業の実際の業務フローを途切れなくつなぐことです。",
    ],
    items: [
      {
        title: "手軽に始める",
        description: ["レビュー返信という明確な課題から解決", "サブスクで導入のハードルを下げます。"],
      },
      {
        title: "データが蓄積",
        description: ["予約・売上・広告費・精算データを連携", "経営判断に必要な基準をつくります。"],
      },
      {
        title: "運営全体へ拡張",
        description: ["キャッシュフロー・アルバイト・支出までつなぐ", "宿泊業の運営OSへと成長します。"],
      },
    ],
    band: {
      eyebrow: "WOOJOO STAY",
      message: "お客様のレビューから売上・精算・アルバイト・支出まで、宿泊業のすべての流れをひとつの軌道に。",
    },
  },
  footer: {
    descriptor: "Hospitality Business OS",
    cta: { label: "パートナー導入のお問い合わせ", href: "#partner" },
    slogan: "お客様のレビューから始め、宿泊業のすべての経営をひとつの軌道に。",
    keywords: "AI · DATA · FINANCE · OPERATION",
    copyright: "WOOJOO STAY. All rights reserved.",
  },
};
