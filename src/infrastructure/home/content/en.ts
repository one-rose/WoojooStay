import type { HomeContent } from "@/core";

/** 홈 화면 문구·숫자 (en) — 문구 수정은 이 파일에서 */
export const homeContentEn: HomeContent = {
  meta: {
    title: "WOOJOO STAY | Hospitality Business OS",
    description:
      "Start easily with AI auto-replies to reviews, build up booking and sales data, and connect early payouts, future revenue, part-timers and expenses — an operating platform for hospitality.",
    ogTitle: "WOOJOO STAY",
    ogDescription: "Start with guest reviews, bring every part of hotel management into one orbit.",
  },
  platformNames: {
    yanolja: "Yanolja",
    yeogi: "Yeogi Eottae",
    agoda: "Agoda",
    naver: "Naver",
    trip: "Trip.com",
    hotels: "Hotels.com",
    onda: "ONDA",
    kkul: "Kkulstay",
    ddnayo: "Ddnayo.com",
  },
  header: {
    navLabel: "Main menu",
    nav: [
      { label: "Services", href: "#service" },
      { label: "Core values", href: "#value" },
      { label: "Partners", href: "#partner" },
    ],
    cta: { label: "Contact us", href: "#partner" },
  },
  hero: {
    badge: "HOSPITALITY BUSINESS OS",
    title: ["Start with guest reviews,", "bring every part of hotel management", "into one orbit."],
    lead: [
      "Start easily with AI auto-replies to reviews, build up booking and sales data,",
      "and connect early payouts, future revenue, part-timers and expenses — an operating platform for hospitality.",
    ],
    orbitLabel: "WOOJOO STAY services",
    orbit: [
      { illustration: "chat", title: "AI REVIEW", caption: "Auto review replies" },
      { illustration: "ledger", title: "Sales Ledger", caption: "Real-time sales & bookings" },
      { illustration: "wallet", title: "Early Payout", caption: "Fast settlement" },
      { illustration: "people", title: "Part-timer Management", caption: "Attendance · payroll · contracts" },
      { illustration: "receipt", title: "Expense Management", caption: "Taxes & spend at a glance" },
    ],
    primaryCta: { label: "Start for free", href: "#service" },
    secondaryCta: { label: "See services", href: "#service" },
    dashboard: {
      brand: "WOOJOO STAY",
      liveLabel: "LIVE DATA",
      kpis: [
        { label: "Today's bookings", value: { amount: 4820000 }, note: "+12.4% vs. yesterday", noteTone: "strong" },
        { label: "Unanswered reviews", value: { count: 8, unit: "" }, note: "AI replies ready", noteTone: "strong" },
        { label: "Upcoming payout", value: { amount: 12640000 }, note: "Within 7 days", noteTone: "soft" },
      ],
      channelChart: {
        title: "Bookings by channel",
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
        quote: ["The room was spotless", "and the staff were kind"],
        replyLabel: "AI reply",
        reply: ["Thank you for your kind review.", "We're delighted you enjoyed", "a comfortable stay."],
        action: "Post reply",
      },
      currentStep: { label: "STEP 01", text: "Connect with guests via AI reviews" },
      nextStep: { label: "NEXT", text: "Sales data builds up" },
    },
  },
  platformStrip: {
    lead: { before: "Expanding to reviews from ", emphasis: "all lodging booking platforms", after: "" },
    platforms: [
      { platform: "yanolja", label: "Yanolja" },
      { platform: "yeogi", label: "Yeogi Eottae" },
      { platform: "agoda", label: "Agoda" },
      { platform: "naver", label: "Naver Booking" },
      { platform: "trip", label: "Trip.com" },
      { platform: "hotels", label: "Hotels.com" },
      { platform: "onda", label: "ONDA" },
      { platform: "kkul", label: "Kkulstay" },
      { platform: "ddnayo", label: "Ddnayo.com" },
    ],
  },
  trustStats: {
    label: "Partner properties using WOOJOO STAY",
    items: [
      {
        value: 125,
        unit: "+",
        label: "Partner properties using WOOJOO STAY",
        description: "Lodging businesses nationwide are on board",
      },
      {
        value: 9,
        unit: "",
        label: "Connected booking channels",
        description: "Yanolja · Yeogi Eottae · Agoda · Naver · Trip.com · Hotels.com · ONDA · Kkulstay · Ddnayo.com",
      },
      {
        value: 5,
        unit: "",
        label: "Services connected as one",
        description: "Reviews · sales & bookings · finance · part-timers · expenses",
      },
      {
        value: 24,
        unit: "h",
        label: "AI review replies",
        description: "Replies ready for new reviews around the clock",
      },
    ],
    note: "* Partner count as of October 2026",
  },
  aiReview: {
    eyebrow: "SERVICE 01",
    title: "WOOJOO STAY AI Auto Review Replies",
    description: [
      "AI handles repetitive review replies so your team works more efficiently.",
      "Reviews from every lodging booking platform are gathered on one screen, so replies are generated and managed quickly.",
    ],
    features: [
      { title: "Unified booking-platform management", description: "See reviews from every channel on one screen" },
      {
        title: "Learns your hotel's tone & manner",
        description: "Set each property's reply style and answer consistently",
      },
      {
        title: "Subscription entry service",
        description: "Start without pressure and naturally move on to sales-data services",
      },
    ],
    panel: {
      title: "WOOJOO STAY AI Review Manager",
      status: "AI ON",
      tabs: [
        { label: "All 84", active: true },
        { label: "Unanswered 8" },
        { label: "Positive 61" },
        { label: "Needs work 15" },
      ],
      ratingLabel: "Rating",
      photoAlt: "review photo",
      reviews: [
        {
          platform: "yanolja",
          tag: "Yanolja",
          rating: 4,
          text: "Check-in was quick and the staff were friendly.",
          aiNote: "Reflected the keywords “fast check-in · friendly service.”",
          photos: ["lobby", "hall"],
          morePhotos: 2,
        },
        {
          platform: "yeogi",
          tag: "Yeogi Eottae",
          rating: 5,
          text: "Breakfast was delicious and the pool was well kept.",
          aiNote: "Wrote a thank-you reply highlighting “breakfast · facilities.”",
          photos: ["breakfast", "room"],
          morePhotos: 3,
        },
        {
          platform: "naver",
          tag: "Naver",
          rating: 5,
          text: "The room was tidy and the bedding was comfortable.",
          aiNote: "Wrote a thank-you reply focused on “clean · comfortable.”",
          photos: ["room", "cityroom"],
          morePhotos: 2,
        },
        {
          platform: "agoda",
          tag: "Agoda",
          rating: 5,
          text: "Stayed on a business trip — the location is excellent.",
          aiNote: "Suggested a return-visit line for business guests.",
          photos: ["cityroom", "lobby"],
          morePhotos: 1,
        },
      ],
    },
    callout: {
      eyebrow: "Customer acquisition point",
      flow: [
        "“We cut the time you spend on reviews, operations and admin”",
        "Guest marketing that drives room bookings",
      ],
      robot: "robot-notext",
      robotAlt: "AI replies to reviews for you",
    },
  },
  ledger: {
    intro: {
      eyebrow: "SERVICE 02",
      title: ["WOOJOO STAY Digital Sales Ledger"],
      description: [
        "Manage sales and bookings in real time, and set up booking data with external channels' price exposure and competition in mind to raise occupancy.",
        "We analyze booking data to build customer datasets you can use as a marketing channel.",
      ],
      illustration: "mock-ledger-notext",
    },
    dashboard: {
      title: "September dashboard",
      period: "2026.09",
      kpis: [
        { label: "Total bookings", amount: 68420000, note: "+8.4%" },
        { label: "Ad spend", amount: 5760000, note: "8.4% of sales" },
        { label: "Platform fees", amount: 6310000, note: "Avg. 9.2%" },
        { label: "Upcoming payout", amount: 32840000, note: "Within 14 days" },
      ],
      trend: {
        title: "Booking sales trend",
        axis: ["25.11", "25.12", "26.01", "26.02", "26.03", "26.04", "26.05", "26.06", "26.07", "26.08"],
      },
      settlement: { label: "Payout calendar", amount: 12640000, note: "Deposit within 7 days" },
      adEfficiency: { label: "Ad efficiency", caption: "Bookings per ad spend", ratio: 11.9 },
    },
    bridge: "Once the data builds up, WOOJOO STAY can connect financing.",
  },
  finance: {
    intro: {
      eyebrow: "SERVICE 03",
      title: ["Turn the time spent waiting for revenue", "into usable cash flow."],
      description: [
        "A fintech service that smoothly connects sales status, deposits and funding.",
        "Future receivables let you quickly turn revenue still to come into liquidity.",
      ],
      illustration: "mock-finance-notext",
    },
    brandPrefix: "WOOJOO STAY",
    products: [
      {
        name: "Early Payout",
        description: [
          "Based on the expected payout of bookings and stays already made,",
          "designed to secure working capital without waiting for settlement day.",
        ],
        metricLabel: "Upcoming payout",
        amount: 32840000,
      },
      {
        name: "Future Revenue Advance",
        description: [
          "Values future receivables from booking flow and sales patterns,",
          "designed to turn them into the working capital you need, fast.",
        ],
        metricLabel: "Expected future revenue",
        amount: 74200000,
      },
    ],
    flowCaption: "Booking & sales data",
    flow: ["DATA", "FINANCE", "CASH"],
    orbitBand: {
      label: "WOOJOO ORBIT",
      flow: ["Reviews", "Sales data", "Settlement", "Cash flow"],
      tagline: "Hospitality cash flow in one orbit",
    },
  },
  operations: {
    intro: {
      eyebrow: "SERVICE 04",
      title: ["Beyond sales — people and costs, too."],
      description: [
        "We connect the staff and expenses that make up a property's real operations.",
        "WOOJOO STAY grows beyond a “sales app” into an operating OS for the whole hospitality business.",
      ],
      illustration: "mock-ops-notext",
    },
    brandPrefix: "WOOJOO STAY",
    staffing: {
      name: "Part-timer Management",
      description: [
        "Supports labor admin for part-timers and staff: attendance · payroll · contracts",
        "See each employee's hours and labor cost alongside sales data",
      ],
      panelTitle: "Staff this month",
      staff: [
        { initial: "J", name: "Jiyeon Kim", role: "Front desk", hours: 176, pay: 2740000 },
        { initial: "S", name: "Seonwoo Park", role: "Housekeeping", hours: 164, pay: 2310000 },
        { initial: "M", name: "Minji Lee", role: "Night shift", hours: 152, pay: 2580000 },
      ],
    },
    expenses: {
      name: "Expense Management",
      description: [
        "Taxes · expense items · purchase orders, unified in one place",
        "See settlement data for sales and expenses at a glance",
      ],
      panelTitle: "Top expenses in September",
      items: [
        { label: "Amenities", amount: 3120000 },
        { label: "Power · Gas", amount: 2480000 },
        { label: "Laundry · Linen", amount: 1860000 },
        { label: "Taxes · Other", amount: 1140000 },
      ],
    },
  },
  useCases: {
    eyebrow: "USE CASE",
    title: "How each type of property uses it",
    description: "Start with the services that fit your property's size and way of operating.",
    recommendLabel: "Recommended",
    cases: [
      {
        type: "hotel",
        label: "Hotel",
        headline: "Multi-channel bookings and price competition on one screen",
        points: [
          "Compare price exposure and booking data by channel in real time",
          "Automate front desk and housekeeping shifts and payroll",
          "Answer high review volumes consistently in your hotel's tone",
        ],
        services: ["Digital Sales Ledger", "Part-timer Management", "AI Auto Review Replies"],
      },
      {
        type: "motel",
        label: "Motel",
        headline: "High-turnover rooms, fast sales and settlement",
        points: [
          "Track day-use and overnight sales in real time",
          "Turn revenue awaiting settlement into working capital with early payouts",
          "Simple attendance and pay for night-shift part-timers",
        ],
        services: ["Digital Sales Ledger", "Early Payout", "Part-timer Management"],
      },
      {
        type: "pension",
        label: "Pension",
        headline: "Small operation? Start light with reviews and expenses",
        points: [
          "Automatic review replies, even for a one-person operation",
          "Forecast future revenue from peak and off-season booking flows",
          "Taxes, utilities and supplies at a glance",
        ],
        services: ["AI Auto Review Replies", "Future Revenue Advance", "Expense Management"],
      },
      {
        type: "guesthouse",
        label: "Guesthouse",
        headline: "Reply quickly — even to international guests",
        points: [
          "Manage reviews from global booking platforms on one screen",
          "Return-guest marketing from booking data",
          "Schedules and attendance for a small team",
        ],
        services: ["AI Auto Review Replies", "Digital Sales Ledger", "Part-timer Management"],
      },
    ],
  },
  roadmap: {
    eyebrow: "WOOJOOSTAY\u00a0 ROADMAP",
    title: "Our services grow step by step",
    description: [
      "Rather than selling every feature at once, we start with “the tasks you do most”",
      "and expand into finance and management as data and trust grow.",
    ],
    brandPrefix: "WOOJOO STAY",
    steps: [
      { badge: "NOW", name: "AI Auto Review Replies", tags: ["Subscription", "Acquisition"], icon: "brand" },
      { badge: "NEXT", name: "Digital Sales Ledger", tags: ["Subscription", "Data"], icon: "book" },
      { name: "Early Payout", tags: ["Finance", "Cash flow"], icon: "wallet" },
      { name: "Future Revenue Advance", tags: ["Finance", "Forecast"], icon: "wallet" },
      { name: "Part-timer Management", tags: ["Operations", "Labor cost"], icon: "people" },
      { name: "Expense Management", tags: ["Operations", "Costs"], icon: "receipt" },
    ],
    growth: {
      label: "GROWTH LOGIC",
      flow: ["Sign up via reviews", "Build sales data", "Connect finance", "Expand operations"],
      nodes: [
        { illustration: "join", label: "Sign-up" },
        { illustration: "data", label: "Data" },
        { illustration: "finance", label: "Finance" },
        { illustration: "ops", label: "Operations" },
        { illustration: "revisit", label: "Return" },
      ],
    },
  },
  easyStart: {
    eyebrow: "EASY START",
    title: "Easy to adopt, instant results",
    steps: [
      { title: "Keep your booking channels", description: "Connect the booking-platform accounts you already use." },
      {
        title: "Start without installation",
        description: "Use it right away on web and mobile — no extra equipment needed.",
      },
      { title: "Easy subscription", description: "Pick only the services you need and start with a monthly plan." },
      { title: "1:1 onboarding", description: "A dedicated manager helps from sign-up to channel setup." },
    ],
    primaryCta: { label: "Free consultation", href: "#partner" },
    secondaryCta: { label: "Get the brochure", href: "#partner" },
  },
  values: {
    eyebrow: "WOOJOO STAY",
    title: ["Make a hotelier's day", "lighter with data."],
    description: [
      "WOOJOO STAY isn't about cramming in features —",
      "it's about connecting the real workflow of hospitality without breaks.",
    ],
    items: [
      {
        title: "Easy to start",
        description: ["Solve a clear problem first: review replies", "A subscription lowers the barrier to entry."],
      },
      {
        title: "Data builds up",
        description: ["Connect booking, sales, ad and payout data", "Creates the benchmarks decisions need."],
      },
      {
        title: "Expand across operations",
        description: ["Connect cash flow, part-timers and expenses", "Grow into a hospitality operating OS."],
      },
    ],
    band: {
      eyebrow: "WOOJOO STAY",
      message:
        "From guest reviews to sales, payouts, part-timers and expenses — every flow of hospitality in one orbit.",
    },
  },
  footer: {
    descriptor: "Hospitality Business OS",
    cta: { label: "Partner inquiry", href: "#partner" },
    slogan: "Start with guest reviews, bring every part of hotel management into one orbit.",
    keywords: "AI · DATA · FINANCE · OPERATION",
    copyright: "WOOJOO STAY. All rights reserved.",
  },
};
