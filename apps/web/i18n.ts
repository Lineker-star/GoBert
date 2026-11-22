import { getRequestConfig } from "next-intl/server";

const locales = ["fr", "en"] as const;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = locales.includes(requested as any) ? requested : "fr";
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
