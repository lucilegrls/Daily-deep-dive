# Ask about this dive — in-app AI companion (design only, not built)

_19 September 2026. Documentation only._

**Status: not implemented, not connected, not authorised.** No model is called,
no reader message or source excerpt leaves the app, no conversation storage
exists, no AI-related permission has been changed, and no provider billing has
been started. The automatic approval review refused activation because reader
conversations and source excerpts would be sent to an unnamed external service.
This file records the design so Lucile can decide.

## The idea (Lucile, 18 September)

An AI inside the app so a reader can ask questions about the topic they are
reading — not a general chatbot bolted on the side.

## Proposed experience

A discreet line inside an opened topic, in the existing theme: *Ask about this
dive*. Opening it reveals a small panel below the takeaways, in the same paper
and gold styling as the bibliography, with four suggested prompts:

- Explain this simply
- Go deeper
- Give me an example
- What is still uncertain?

plus a free-text question box. Answers appear as short paragraphs in the body
type, each claim followed by the actual source it came from, linked to the same
bibliography entry already on the page.

Rules the panel must honour:

- Grounded in this topic's own text and the excerpts genuinely available from
  its curated sources. Nothing else.
- Every factual claim carries a real citation to a source already listed on the
  topic. No invented citations, no invented sources.
- Inference is labelled as inference; uncertainty is stated.
- When the available sources do not answer the question, it says so instead of
  guessing.
- A title and a URL do not mean the full text was read. The panel never implies
  full-source access it does not have.
- Nothing produced here is ever published as app content.

## Proposed data flow

```text
reader question
   → app server (server function, authenticated)
   → payload assembled server-side:
        topic title, context, takeaways
        excerpts from curated sources ONLY where the app legitimately holds them
        the reader's question and the last few turns of this one conversation
   → named model provider (to be decided and approved)
   → answer + citations returned
   → rendered in the panel; not stored unless the reader keeps the thread
```

The browser never talks to a model directly. No reader identity, email, reading
history, notes, saves or streak data is included in the payload.

## Minimal payload

| Included | Excluded |
| --- | --- |
| Topic title, context, takeaways | Reader name, email, account id |
| Source titles and the excerpts held | Reading history, streak, ranking |
| The current question and this thread | Private notes, saved topics |
| Topic id (for citation matching) | Anything from other topics |

## Privacy controls to build alongside it

- Off by default until the provider is named and approved.
- A plain statement in the panel naming the provider and what is sent, before
  the first question.
- Conversations private to their reader, row-level secured, deletable by the
  reader, and not used for any ranking, profiling or training.
- Per-account rate limits and a visible cost ceiling.
- Honest error states: unavailable, rate-limited, or "the sources here do not
  answer that".

## Decisions Lucile must make before any build

1. **Which provider**, named explicitly (for example the Lovable AI gateway, or
   another), and approval to send topic text and source excerpts to it.
2. **Whether conversations are stored at all**, and for how long.
3. **Whether excerpts may be sent**, or only the app's own topic text.
4. **Spending ceiling** per day or month.

## Related proposals (not approved, not designed in detail)

Diagrams, quizzes, definitions on selected text, remembered learning level,
temporary private dives, and AI-suggested related topics. All remain ideas.
