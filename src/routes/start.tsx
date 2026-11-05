import { createFileRoute } from "@tanstack/react-router";

import { OnboardingWizard } from "@/components/OnboardingWizard";

export const Route = createFileRoute("/start")({
  head: () => ({
    meta: [
      { title: "Build my feed — Daily Deep Dive" },
      {
        name: "description",
        content:
          "Answer three short questions — your subjects, how adventurous your feed should be, and the look of your reading room — and Daily Deep Dive shapes the library around you.",
      },
      { property: "og:title", content: "Build my feed — Daily Deep Dive" },
      {
        property: "og:description",
        content:
          "Three short questions and your deep-dive feed is shaped around what you are curious about.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <OnboardingWizard mode="signup" />,
});
