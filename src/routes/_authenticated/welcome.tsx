import { createFileRoute } from "@tanstack/react-router";

import { OnboardingWizard } from "@/components/OnboardingWizard";

export const Route = createFileRoute("/_authenticated/welcome")({
  head: () => ({
    meta: [
      { title: "Tune my interests — Curiosity, Sourced" },
      {
        name: "description",
        content:
          "Change the subjects your Curiosity, Sourced feed leans on, how much discovery it mixes in, and the look of your reading room.",
      },
      { property: "og:title", content: "Tune my interests" },
      {
        property: "og:description",
        content:
          "Change your subjects, your feed mix and the look of your reading room.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <OnboardingWizard mode="edit" />,
});
