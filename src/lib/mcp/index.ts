import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchTopics from "./tools/search-topics";
import getTopic from "./tools/get-topic";
import listSavedTopics from "./tools/list-saved-topics";

// Vite inlines the stable ref; the published SUPABASE_URL may be a proxy.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "daily-deep-dive",
  title: "Daily Deep Dive",
  version: "0.1.0",
  instructions: "Read the Curiosity, Sourced library: search published topics, read a topic with its approved sources, and list your saved topics.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchTopics, getTopic, listSavedTopics],
});
