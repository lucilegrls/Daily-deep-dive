import { openInPlace, spaceOpens, TopicGateway } from "@/components/TopicGateway";
import { categoryName } from "@/lib/content-labels";
import { useI18n } from "@/lib/i18n";
import { readerCopy } from "@/lib/reader-copy";

export interface TopicRowTopic {
  id: number;
  slug: string;
  title: string;
  category: string;
  context: string;
}

interface TopicRowProps {
  topic: TopicRowTopic;
  index: number;
  saved: boolean;
  onOpen: (topic: TopicRowTopic) => void;
  onToggleSave: (id: number) => void;
}

export function TopicRow({
  topic,
  index,
  saved,
  onOpen,
  onToggleSave,
}: TopicRowProps) {
  const { lang, t } = useI18n();
  const flipped = index % 2 === 1;


  return (
    <article className="animate-rise relative">
      <div
        className={`topic-row group flex items-center gap-3 sm:gap-10 ${
          flipped ? "sm:flex-row-reverse" : ""
        }`}
      >
        <TopicGateway
          href={`/topic/${topic.slug}`}
          onOpen={() => onOpen(topic)}
        />

        <a
          href={`/topic/${topic.slug}`}
          onClick={(e) => openInPlace(e, () => onOpen(topic))}
          onKeyDown={(e) => spaceOpens(e, () => onOpen(topic))}
          className={`topic-copy block min-w-0 flex-1 cursor-pointer rounded-sm text-left ${
            flipped ? "sm:text-right" : ""
          }`}
        >
          <span className="eyebrow text-muted-foreground">
            {categoryName(lang, topic.category)}
          </span>
          <h2 className="mt-1.5 font-display text-xl leading-snug font-semibold text-balance text-foreground transition-colors group-hover:text-primary sm:text-2xl">
            {topic.title}
          </h2>
          <p
            className={`mt-2 line-clamp-2 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-[0.95rem] ${
              flipped ? "sm:ml-auto" : ""
            }`}
          >
            {readerCopy(topic.context)}
          </p>
        </a>


        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSave(topic.id);
          }}
          aria-pressed={saved}
          aria-label={saved ? t("ts.unsave") : t("ts.save")}
          className={`flex size-11 shrink-0 self-start items-center justify-center rounded-full border transition-colors ${
            saved
              ? "border-primary/30 bg-primary text-primary-foreground"
              : "border-border bg-card/80 text-muted-foreground hover:border-primary/40 hover:text-primary"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            className="size-4"
            fill={saved ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          >
            <path d="M6 3.75h12a.75.75 0 0 1 .75.75v15.4a.4.4 0 0 1-.63.33L12 15.54l-6.12 4.69a.4.4 0 0 1-.63-.33V4.5a.75.75 0 0 1 .75-.75Z" />
          </svg>
        </button>
      </div>
    </article>
  );
}
