/**
 * 토스페이먼츠 카드 등록 창 (자동결제 · SDK v2)
 * 카드 번호는 토스 창에만 입력되고, 성공하면 successUrl 로 authKey · customerKey 가 돌아온다.
 * https://docs.tosspayments.com/guides/v2/billing
 */
const SDK = "https://js.tosspayments.com/v2/standard";

interface TossSdk {
  payment(o: { customerKey: string }): {
    requestBillingAuth(o: {
      method: "CARD";
      successUrl: string;
      failUrl: string;
      customerName?: string;
    }): Promise<void>;
  };
}

declare global {
  interface Window {
    TossPayments?: (clientKey: string) => TossSdk;
  }
}

function loadSdk(): Promise<NonNullable<Window["TossPayments"]>> {
  if (window.TossPayments) return Promise.resolve(window.TossPayments);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SDK;
    s.async = true;
    s.onload = () =>
      window.TossPayments ? resolve(window.TossPayments) : reject(new Error("결제창을 불러오지 못했어요."));
    s.onerror = () => reject(new Error("결제창을 불러오지 못했어요."));
    document.head.appendChild(s);
  });
}

export async function openTossCardAuth(clientKey: string, customerKey: string, customerName?: string) {
  const TossPayments = await loadSdk();
  const origin = window.location.origin;
  await TossPayments(clientKey)
    .payment({ customerKey })
    .requestBillingAuth({
      method: "CARD",
      successUrl: `${origin}/app/billing/card`,
      failUrl: `${origin}/app/billing/card?fail=1`,
      customerName,
    });
}
