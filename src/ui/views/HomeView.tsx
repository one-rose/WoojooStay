import type { HomeContent } from "@/core";
import {
  AiReviewSection,
  FinanceSection,
  Hero,
  LedgerSection,
  OperationsSection,
  PlatformStrip,
  RoadmapSection,
  SiteFooter,
  SiteHeader,
  ValuesSection,
} from "../sections";

/** 홈 화면 = 섹션 조립만. 데이터는 바깥(app)에서 받아 내려준다. */
export function HomeView({ content }: { content: HomeContent }) {
  return (
    <>
      <SiteHeader content={content.header} />
      <main>
        <Hero content={content.hero} />
        <PlatformStrip content={content.platformStrip} />
        <AiReviewSection content={content.aiReview} />
        <LedgerSection content={content.ledger} />
        <FinanceSection content={content.finance} />
        <OperationsSection content={content.operations} />
        <RoadmapSection content={content.roadmap} />
        <ValuesSection content={content.values} />
      </main>
      <SiteFooter content={content.footer} />
    </>
  );
}
