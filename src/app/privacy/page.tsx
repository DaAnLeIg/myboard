import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Политика конфиденциальности — MyBoard",
  description:
    "Политика конфиденциальности веб-приложения MyBoard для пользователей и магазинов приложений.",
};

export default function PrivacyPage() {
  return (
    <main
      lang="ru"
      className="mx-auto min-h-screen max-w-2xl px-4 py-10 text-zinc-800 sm:px-6 sm:py-14"
    >
      <p className="mb-6 text-sm text-zinc-500">
        <Link href="/" className="text-zinc-700 underline-offset-2 hover:underline">
          ← На доску
        </Link>
      </p>
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
        Политика конфиденциальности
      </h1>
      <p className="mt-2 text-sm text-zinc-500">Приложение MyBoard (myboard.vercel.app)</p>

      <div className="mt-10 space-y-6 text-[15px] leading-relaxed text-zinc-700">
        <section>
          <h2 className="mb-2 text-base font-semibold text-zinc-900">1. Общие положения</h2>
          <p>
            Настоящий документ описывает подход сервиса MyBoard к обработке информации при
            использовании веб-приложения, размещённого по адресу{" "}
            <span className="font-mono text-sm">myboard.vercel.app</span>. Используя сервис, вы
            соглашаетесь с условиями настоящей политики.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-zinc-900">
            2. Сбор персональных данных
          </h2>
          <p>
            MyBoard <strong>не собирает</strong> персональные данные пользователей в целях
            маркетинга, аналитики, персонализированной рекламы или последующей передачи таких
            данных третьим лицам в коммерческих целях. Мы <strong>не продаём</strong> и{" "}
            <strong>не сдаём в аренду</strong> ваши персональные данные.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-zinc-900">
            3. Техническая работа сервиса
          </h2>
          <p>
            Для предоставления функций доски (сохранение черновика, совместная работа, загрузка
            изображений при необходимости) могут использоваться стандартные технические механизмы
            браузера и инфраструктура хостинга/облачного провайдера (например, передача данных по
            HTTPS, хранение технических записей на стороне используемых сервисов в объёме,
            необходимом для работы приложения). Это не означает целенаправленный сбор персональных
            данных в маркетинговых целях, описанных в разделе 2.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-zinc-900">4. Файлы cookie</h2>
          <p>
            Приложение не использует файлы cookie для отслеживания пользователей между сайтами в
            рекламных целях. Могут применяться технические механизмы, необходимые для работы
            веб-платформы и браузера.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-zinc-900">5. Изменения</h2>
          <p>
            Мы можем время от времени обновлять текст настоящей политики. Актуальная версия всегда
            доступна на странице <span className="font-mono text-sm">/privacy</span>.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-zinc-900">6. Контакты</h2>
          <p>
            По вопросам, связанным с настоящей политикой, вы можете обратиться к владельцу проекта
            MyBoard через каналы, указанные в репозитории или карточке приложения в магазине.
          </p>
        </section>
      </div>
    </main>
  );
}
