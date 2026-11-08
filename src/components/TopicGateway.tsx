import type React from "react";
import { useAccount } from "@/lib/account";
import { gatewayFor } from "@/lib/themes";
import { useI18n } from "@/lib/i18n";

interface TopicGatewayProps {
  title: string;
  href: string;
  onOpen: () => void;
  className?: string;
}

/**
 * The single object a reader taps to open a topic's library.
 * Which object appears depends on the chosen look; the interaction,
 * accessible name and motion behaviour stay identical everywhere.
 */
export function TopicGateway({ title, href, onOpen, className }: TopicGatewayProps) {
  const { theme } = useAccount();
  const { lang } = useI18n();
  const gateway = gatewayFor(theme);

  return (
    <a
      href={href}
      onClick={(e) => openInPlace(e, onOpen)}
      onKeyDown={(e) => spaceOpens(e, onOpen)}
      aria-label={`${lang === "fr" ? "Ouvrir le sujet" : "Open topic"}: ${title}`}
      className={`flex w-32 shrink-0 cursor-pointer items-center justify-center transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-1.5 group-hover:-rotate-[1.2deg] focus:outline-none motion-reduce:transition-none motion-reduce:group-hover:translate-y-0 motion-reduce:group-hover:rotate-0 sm:w-44 ${className ?? ""}`}
    >
      <img
        key={gateway.src}
        src={gateway.src}
        alt=""
        loading="lazy"
        className={`stationery aspect-square w-full object-contain transition-[filter] duration-500 group-hover:drop-shadow-[0_18px_22px_oklch(0.5_0.06_30/0.25)] ${
          gateway.blend
            ? "mix-blend-multiply dark:mix-blend-normal dark:rounded-2xl"
            : ""
        }`}
      />
    </a>
  );
}

/**
 * Cards are real links so a tap made before the page finishes starting still
 * goes somewhere (the topic's own page). Once running, a plain click opens the
 * letter in place; modified clicks (new tab) keep normal link behaviour.
 */
export function openInPlace(e: React.MouseEvent, onOpen: () => void) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  onOpen();
}

/** Links ignore Space by default; the card controls accept it like buttons. */
export function spaceOpens(e: React.KeyboardEvent, onOpen: () => void) {
  if (e.key !== " ") return;
  e.preventDefault();
  onOpen();
}
