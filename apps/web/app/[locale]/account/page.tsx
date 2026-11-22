import ComingSoon from "@/components/ComingSoon";
import { useTranslations } from "next-intl";

export default function AccountPage() {
  const t = useTranslations("nav");
  return <ComingSoon label={t("account")} />;
}
