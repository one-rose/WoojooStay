import type { HomeContent, Locale } from "@/core";
import {
  AiReviewSection,
  EasyStartSection,
  FinanceSection,
  Hero,
  InquiryDialog,
  LedgerSection,
  OperationsSection,
  PlatformStrip,
  RoadmapSection,
  SiteFooter,
  SiteHeader,
  type SubmitInquiry,
  TrustStats,
  UseCasesSection,
  ValuesSection,
} from "../sections";

/** 홈 화면 = 섹션 조립만. 데이터는 바깥(app)에서 받아 내려준다. */
export function HomeView({
  content,
  locale,
  submitInquiry,
}: {
  content: HomeContent;
  locale: Locale;
  /** 있으면 문의 버튼이 접수 창을 연다 (API 서버 연결 시). 없으면 예전처럼 푸터로 이동 */
  submitInquiry?: SubmitInquiry;
}) {
  return (
    <>
      <SiteHeader content={content.header} locale={locale} />
      <main>
        <Hero content={content.hero} platformNames={content.platformNames} />
        <PlatformStrip content={content.platformStrip} />
        <TrustStats content={content.trustStats} />
        <AiReviewSection content={content.aiReview} />
        <LedgerSection content={content.ledger} />
        <FinanceSection content={content.finance} />
        <OperationsSection content={content.operations} />
        <UseCasesSection content={content.useCases} />
        <RoadmapSection content={content.roadmap} />
        <EasyStartSection content={content.easyStart} />
        <ValuesSection content={content.values} />
      </main>
      <SiteFooter content={content.footer} />
      {submitInquiry && (
        <InquiryDialog content={content.inquiry} submit={submitInquiry} serverMessages={locale === "ko"} />
      )}
    </>
  );
}
