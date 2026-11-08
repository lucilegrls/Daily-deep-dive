import { describe, expect, it } from "vitest";

import { readerCopy, readerPublication } from "./reader-copy";

// Exact strings currently stored in the catalogue (verification.limitation /
// description). Internal review-process wording must vanish for readers while
// genuine scientific, preprint and access limitations stay untouched.
describe("readerCopy", () => {
  it("removes the study-appraisal/live-link-audit disclaimer (MIT & Stanford videos)", () => {
    expect(
      readerCopy("Relevant page or abstract checked; not a full study appraisal or exhaustive live-link audit."),
    ).toBe("");
  });

  it("removes the disclaimer as a standalone trailing sentence after topical prose", () => {
    expect(
      readerCopy(
        "Lecture on neural-network scaling laws, power-law patterns, critical batch size, and limitations. Not a full study appraisal or exhaustive live-link audit.",
      ),
    ).toBe("Lecture on neural-network scaling laws, power-law patterns, critical batch size, and limitations.");
  });

  it("removes independent-appraisal and replication disclaimers", () => {
    expect(readerCopy("Full underlying study methods not independently appraised.")).toBe("");
    expect(readerCopy("Results not independently replicated.")).toBe("");
    expect(readerCopy("Findings not independently verified.")).toBe("");
  });

  it("keeps genuine scientific scope limitations", () => {
    expect(readerCopy("Adult-female population; do not generalize all findings to all sexes or ages.")).toBe(
      "Adult-female population; do not generalize all findings to all sexes or ages.",
    );
    expect(readerCopy("Rewiring is a metaphor, not wholesale literal replacement of brain connections.")).toBe(
      "Rewiring is a metaphor, not wholesale literal replacement of brain connections.",
    );
    expect(readerCopy("Few studies and bidirectional relationships; stress is a possible exacerbator, not a proven sole cause.")).toBe(
      "Few studies and bidirectional relationships; stress is a possible exacerbator, not a proven sole cause.",
    );
  });

  it("keeps preprint status and access limitations", () => {
    expect(readerCopy("Preprint; not yet peer reviewed.")).toBe("Preprint; not yet peer reviewed.");
    expect(readerCopy("Full text access may vary.")).toBe("Full text access may vary.");
    expect(readerCopy("Abstract only, full text may require access.")).toBe("Abstract only, full text may require access.");
  });

  it("keeps a scientific 'critical appraisal' description of the source itself", () => {
    expect(
      readerCopy("A stage-by-stage critical appraisal of what the glymphatic evidence does and does not support."),
    ).toBe("A stage-by-stage critical appraisal of what the glymphatic evidence does and does not support.");
  });

  it("keeps legal and financial scope limitations", () => {
    expect(readerCopy("General investor education, not personalized financial advice or a product recommendation.")).toBe(
      "General investor education, not personalized financial advice or a product recommendation.",
    );
    expect(readerCopy("Not a complete debt-versus-equity corporate-law comparison; national implementation varies.")).toBe(
      "Not a complete debt-versus-equity corporate-law comparison; national implementation varies.",
    );
  });
});

  it("removes citation/Wikipedia-inspection and provenance-check notes (Creator Insider video)", () => {
    expect(
      readerCopy(
        "Direct discussion by YouTube's senior director of growth/discovery about ranking and user-level recommendations; chapter markers name algorithm, ranking, traffic sources, analytics. Description has no independent research citations; no Wikipedia mention. Original recording date not disclosed; not live.\n\nOwner-approved inclusion — verification incomplete. This resource is visible at the catalogue owner’s request.",
      ),
    ).toBe(
      "Direct discussion by YouTube's senior director of growth/discovery about ranking and user-level recommendations; chapter markers name algorithm, ranking, traffic sources, analytics.",
    );
  });

  it("removes bibliography/Wikipedia-observation and recording-date check variants", () => {
    expect(
      readerCopy(
        "Description explains intron removal/exon joining in pre-mRNA processing; creator social/video links, no scientific bibliography/Wikipedia mention observed. Recording date unstated; not live.",
      ),
    ).toBe("Description explains intron removal/exon joining in pre-mRNA processing.");
    expect(readerCopy("Transcript/recording date not checked.")).toBe("");
    expect(readerCopy("Interruption-resumption specificity requires transcript review.")).toBe("");
    expect(
      readerCopy("Directly addresses the ego-depletion theory and replication failure; short channel explainer, source depth unverified."),
    ).toBe("Directly addresses the ego-depletion theory and replication failure.");
    expect(readerCopy("Description is empty, so source list, claims, Wikipedia use and event/original date cannot be checked; not live.")).toBe("");
  });

  it("keeps supplied recording dates and genuine caveats while dropping the check note", () => {
    expect(
      readerCopy("Strong educational fit, older upload; actual course recording dates Fall 2018. Transcript not independently inspected."),
    ).toBe("Strong educational fit, older upload; actual course recording dates Fall 2018.");
    expect(readerCopy("This is an archived upload, not a 2025 recording.")).toBe(
      "This is an archived upload, not a 2025 recording.",
    );
    expect(readerCopy("No Wikipedia mention; original recording/event date clear.")).toBe(
      "Original recording/event date clear.",
    );
    expect(
      readerCopy("Underlying conference is ARDD2025, but exact recording date not specified; not live."),
    ).toBe("Underlying conference is ARDD2025.");
    expect(
      readerCopy("Jurisdiction is EU/UK data-protection context, details need current-law verification."),
    ).toBe("Jurisdiction is EU/UK data-protection context.");
  });

describe("readerPublication", () => {
  it("keeps plain dates untouched", () => {
    expect(readerPublication("2024")).toBe("2024");
  });
});

describe("remaining snapshot workflow notes", () => {
  it("removes date-window eligibility but retains actual recording dates", () => {
    expect(readerCopy("Direct causal explanation; short, outside date window.")).toBe("Direct causal explanation; short.");
    expect(readerCopy("Strong university lecture on awareness/attention but older than recent window; recording course date Spring 2019.")).toBe("Strong university lecture on awareness/attention; recording course date Spring 2019.");
  });
  it("removes appraisal-only limitations without hiding access restrictions", () => {
    expect(readerCopy("Full article not inspected in this pass.")).toBe("");
    expect(readerCopy("No independent appraisal of every underlying study.")).toBe("");
    expect(readerCopy("No independent replication appraisal; embeds/rights not assessed.")).toBe("");
    expect(readerCopy("Abstract and citation reviewed; full-text access may require subscription.")).toBe("Full-text access may require subscription.");
  });
  it("retains citations and verification when they are the research subject", () => {
    expect(readerCopy("Explains verification of beneficial ownership and authority access.")).toBe("Explains verification of beneficial ownership and authority access.");
    expect(readerCopy("Technical paper explaining two-stage candidate generation and ranking in a large recommendation system.")).toBe("Technical paper explaining two-stage candidate generation and ranking in a large recommendation system.");
    expect(readerCopy("Examines replication failures and publication bias.")).toBe("Examines replication failures and publication bias.");
  });
});
