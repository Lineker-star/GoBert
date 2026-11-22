import ComingSoon from "@/components/ComingSoon";
import { useTranslations } from "next-intl";

export default function AssistantPage() {
  const t = useTranslations("nav");
  return <ComingSoon label={t("assistant")} />;
}
