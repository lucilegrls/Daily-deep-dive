# Persistent broken-link review candidates — 2026-11-03

These nine records returned HTTP 404 in repeated technical checks. Candidate
links are authoritative publisher destinations, but changing a source is an
editorial decision: confirm identity, relevance, coverage and limitations before
approving a replacement. A technical check alone is not an editorial review.

| Resource | Topic | Existing URL | Recommended action | Confidence |
| --- | ---: | --- | --- | --- |
| `270a85fd-1005-4c2f-8680-4f246352e645` — Bringing Dark Patterns to Light | 83 | https://www.ftc.gov/reports/bringing-dark-patterns-light | Keep pending manual browser confirmation. The FTC page and its official PDF are discoverable and current, so the checker result appears to be an edge/CDN false negative. PDF: https://www.ftc.gov/system/files/ftc_gov/pdf/P214800%20Dark%20Patterns%20Report%209.14.2022%20-%20FINAL.pdf | High |
| `4e9e5bbc-ee20-5a87-9745-c45f3ff35ba5` — The structure of liquid water and ice | 243 | https://www.nature.com/articles/35098033 | Do not auto-replace. The supplied Nature identifier could not be matched reliably to the title; a subject-adjacent paper is not an identity-preserving replacement. | Low |
| `59bf5753-2fde-5000-9c6f-dd0d97767dd7` — Principles of Marketing, Chapter 5 | 41 | https://openstax.org/books/principles-marketing/pages/5-introduction | Replace with the current chapter section/index after confirming the intended section. Current publisher entry: https://openstax.org/books/principles-marketing/pages/5-6-product-positioning | Medium |
| `9bc164f8-6d13-5120-8262-5cede6e3c4ee` — Advertising and Marketing | 46 | https://www.ftc.gov/business-guidance/advertising-marketing | Keep. The exact FTC destination is currently indexed and available; treat the automated 404 as a publisher edge/CDN discrepancy. | High |
| `aac27de3-f5c1-5807-81a6-df8d894fc0e3` — Cayman Islands Private Funds Act (2025 Revision) | 277 | https://www.cima.ky/upimages/lawsregulations/PrivateFundsAct2025Revision_1756133628.pdf | Replace with CIMA's current official file: https://www.cima.ky/upimages/lawsregulations/PrivateFundsAct2025Revision_1739307005.pdf | High |
| `c5d740d6-c0e4-5989-b8b6-6aaa77a910f5` — Mechanism of popcorn popping | 247 | https://doi.org/10.1016/0733-5210(81)90038-1 | Correct the malformed DOI to https://doi.org/10.1016/S0733-5210(83)80007-1 | High |
| `c64d03a0-03de-5f8f-b61e-4d9f0c64973e` — Cayman Islands DITC — Legislation | 279 | https://www.ditc.ky/legislation | Replace with the current official listing: https://www.ditc.ky/category/legislation-resources/ | High |
| `f2926133-7770-5f43-a7cf-c49d62dae68b` — UN Convention on Conditions for Registration of Ships | 278 | https://unctad.org/topic/transport-and-trade-logistics/transport-laws/registration-of-ships | Replace with UNCTAD's official convention PDF: https://unctad.org/system/files/official-document/tdrsconf23_en.pdf (context page: https://unctad.org/topic/transport-and-trade-logistics/policy-and-legislation/international-maritime-transport-law/maritime-conventions) | High |
| `f7ebe220-7e95-5248-ba48-122c61244ab7` — UNICEF Policy on Safeguarding (March 2024) | 312 | https://www.unicef.org/media/159656/file/UNICEF_Policy_on_Safeguarding_March%202024.pdf.pdf | Replace the fragile media path with UNICEF's stable document page: https://www.unicef.org/documents/safeguarding-policy | High |

## Decision summary

- Five high-confidence stale/malformed destinations are ready for human approval.
- Two valid FTC pages should be retained and marked as technical false positives.
- The OpenStax record needs a quick section-identity check.
- The Nature record needs bibliographic identification; no substitute should be
  introduced merely because it discusses the same subject.
