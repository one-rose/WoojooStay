import type { StaticImageData } from "next/image";
import { localePath, type Locale } from "@/core";
import { cx } from "@/shared";
import enFlag from "@/assets/flags/en.svg";
import jaFlag from "@/assets/flags/ja.svg";
import koFlag from "@/assets/flags/ko.svg";
import zhFlag from "@/assets/flags/zh.svg";
import { Img } from "../../media";

/** 언어 버튼 — 표기는 언어와 무관하게 고정 */
const LANGUAGES: readonly { locale: Locale; code: string; name: string; flag: StaticImageData }[] = [
  { locale: "ko", code: "KO", name: "한국어", flag: koFlag },
  { locale: "en", code: "EN", name: "English", flag: enFlag },
  { locale: "ja", code: "JP", name: "日本語", flag: jaFlag },
  { locale: "zh", code: "CN", name: "中文", flag: zhFlag },
];

/** 언어 전환: 언어마다 별도 주소(/, /en, /ja, /zh)로 이동 */
export function LanguageSwitcher({ current }: { current: Locale }) {
  return (
    <div className="lang" role="group" aria-label="Language">
      {LANGUAGES.map(({ locale, code, name, flag }) => (
        <a
          key={locale}
          href={localePath(locale)}
          hrefLang={locale}
          lang={locale}
          title={name}
          className={cx("lang__btn", locale === current && "is-on")}
          aria-current={locale === current ? "page" : undefined}
        >
          <Img src={flag} alt="" />
          <span>{code}</span>
        </a>
      ))}
    </div>
  );
}
