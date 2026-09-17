# Source audit — 17 September 2026

All **169 original resource entries across 64 topics** were assessed. The collection now has **100 direct resource entries pointing to 87 distinct sources**, with no search placeholders or Wikipedia links.

The entry ledger records 46 retained links, 29 searches replaced with a matching direct work, and 94 original entries omitted. Omitted entries include generic searches, broad homepages, shallow handout landing pages, inaccessible content and materials superseded by more focused guides. Replacement guides are listed beside each original entry; these figures describe original-entry decisions, not a resource quota.

## Source-format policy

Resource quality is judged by **credibility, substance and teaching value rather than format**. A high-quality video, lecture, expert interview, documentary, podcast or long-form explainer can be a substantive source in its own right, just like a book, paper, article, course or official document.

The app should actively look for strong audiovisual sources when they are particularly good at building intuition or explaining a difficult mechanism. They are not automatically downgraded to "framing resources." Conversely, a paper or institutional webpage is not automatically strong merely because it looks authoritative.

The detailed selection criteria are in [SOURCE_POLICY.md](SOURCE_POLICY.md). User-supplied educational videos may be retained as genuine sources when they are substantive and relevant, with additional research used to expand, contextualize or challenge them rather than to demote them by default.

## What verification means

- **64 distinct sources:** readable text and relevant sections checked for identity, credibility, substance and alignment with the card. This is not a claim of cover-to-cover reading or independent replication.
- **21 distinct papers:** bibliographic identity and abstract checked. The full paper was not reviewed; access may be restricted. Their titles, authors, methods and scoped conclusions are checked, but this audit does not certify every statement in those papers.
- **Audiovisual sources:** when used substantively, check the creator/speaker, topic fit, level of detail, evidence basis, precision of claims and important conflicts of interest or limitations. A useful expert synthesis does not need to reproduce an academic paper to deserve inclusion.
- **One official GDPR record:** identity checked; the relevant provisions were cross-checked against the readable EDPB final guidelines.
- **One UNCITRAL record:** official convention summary and linked-document identity checked. Full convention and guide downloads were blocked or timed out. This remains an explicit full-text verification gap.

Every resource carries a dated `verification` field. [The complete ledger](source-audit.json) maps every original entry to a decision and lists the final sources, review levels and limits. Automated status checks are supplementary: an HTTP 200, search result or publisher synopsis is not proof of a substantive content review. NIH pages readable through the web retrieval were retained even where the automated client was blocked; bot-challenge pages were not mistaken for articles.

## Material corrections

- Corrected the Doomscrolling Scale citation from Sharma to **Satici, Gocet Tekin, Deniz and Satici**, distinguishing online publication in 2022 from the 2023 journal volume.
- Removed the outdated Vietnam data-law comparison from the focused GDPR card; used EU legal material and the EDPB right-of-access guidelines.
- Rewrote the first 12 cards to distinguish observation from causation, animal experiments from human evidence, and specific protocols from universal prescriptions. Removed unsupported habit advice and blanket health claims.
- Replaced the six short learning-strategy landing pages with the full Weinstein, Madan and Sumeracki review, which explicitly covers all six strategies. Removed the repeated Dunlosky citation where its coverage or inaccessible full text made it a weaker choice here.
- Added liver, kidney reabsorption and innate-immunity chapters where the original chapters did not cover the entire card. Added finance textbook treatments of bond characteristics and valuation.
- Replaced WIPO and International IDEA publication landing pages with detailed guides or direct handbook PDFs. Older guides support foundational concepts, not an assertion that every jurisdiction’s current law was checked.
- Removed unresolved book/video searches. Retained direct primary Stoic texts without recommending a translation different from the linked edition.
- Updated the editorial policy so strong videos, lectures, interviews, documentaries and podcasts can be substantive sources rather than being treated as second-class material.

## Daily growth requirement

The existing daily research task now requires **at least 10 distinct, sourced and verified new topics per run**, with no cap on the collection. There is no quota for resource types or resource count. It must preserve stable IDs, rotate disciplines, check overlap, record verification evidence and report a shortfall if access or execution prevents the minimum. Abstract-only verification must be identified honestly; current legal, medical, financial and geopolitical claims require current authoritative evidence and dates.

The daily research process should deliberately consider **high-quality videos and audio resources** alongside text sources when they improve understanding. The goal is not to make every card look academic; it is to give the reader the strongest learning path available.

The task appends reviewed content to `topics.json` and publishes repository updates. The static app displays the available collection; this change does not supply a live content-generation backend. Scheduled execution is subject to the task’s access and runtime, so a requirement of ten is not a guarantee that every future run will succeed.
