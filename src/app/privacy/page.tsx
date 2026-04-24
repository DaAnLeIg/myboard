import type { Metadata } from "next";
import { PrivacyView } from "../../../components/PrivacyView";

export const metadata: Metadata = {
  title: "Политика конфиденциальности — MyBoard",
  description:
    "Политика конфиденциальности веб-приложения MyBoard для пользователей и магазинов приложений.",
};

export default function PrivacyPage() {
  return <PrivacyView />;
}
