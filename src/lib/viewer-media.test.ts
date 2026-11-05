import { describe, expect, it } from "vitest";

import { canHostFullContent, mediaUrl, playerFor, resolveMode, resolveSource, youtubeId } from "./viewer-media";

describe("viewer media rules", () => {
  const imported = { embedType: "link_only", embeddingStatus: "needs_review", rightsStatus: "unknown", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" };
  it.each(["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ?t=3", "https://youtube.com/shorts/dQw4w9WgXcQ", "https://m.youtube.com/watch?v=dQw4w9WgXcQ", "https://vimeo.com/123456789"])("infers imported official videos: %s", (url) => {
    expect(resolveMode({ ...imported, url })).toBe("video");
    expect(imported.rightsStatus).toBe("unknown");
  });
  it.each(["http://youtube.com/watch?v=dQw4w9WgXcQ", "https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ", "https://evil.test/youtube.com/watch?v=dQw4w9WgXcQ", "https://youtube.com@evil.test/watch?v=dQw4w9WgXcQ", "https://youtube.com./watch?v=dQw4w9WgXcQ", "javascript:alert(1)", "https://youtube.com/watch?v=short", "https://youtube.com/watch?v=dQw4w9WgXcQ&v=aaaaaaaaaaa", "https://youtu.be/dQw4w9WgXcQ/extra", "https://youtube.com:444/watch?v=dQw4w9WgXcQ", "https://youtube.com\\@evil.test/watch?v=dQw4w9WgXcQ"])("rejects malformed or malicious player addresses: %s", (url) => {
    expect(playerFor(url)).toBeNull();
    expect(resolveMode({ ...imported, url })).toBe("link_only");
  });
  it.each(["blocked", "broken"])("preserves explicit %s", (embeddingStatus) => {
    expect(resolveMode({ ...imported, embeddingStatus })).toBe("link_only");
  });
  it("preserves explicit rights restrictions for videos and remote files", () => {
    expect(resolveMode({ ...imported, rightsStatus: "link_only" })).toBe("link_only");
    expect(resolveMode({ ...imported, url: "https://publisher.org/book.pdf", rightsStatus: "link_only" })).toBe("link_only");
  });
  it("distinguishes publisher-hosted PDF display from hosting copyrighted text", () => {
    expect(resolveSource({ ...imported, url: "https://publisher.org/paper.pdf?download=1" })).toEqual({ mode: "remote_pdf", url: "https://publisher.org/paper.pdf?download=1" });
    expect(resolveMode({ ...imported, embedType: "internal_reader", hasBody: true })).toBe("link_only");
    expect(resolveMode({ ...imported, embedType: "pdf", url: "https://publisher.org/book", contentUrl: "https://publisher.org/book.pdf" })).toBe("link_only");
  });
  it("maps only actual arxiv identifiers", () => {
    expect(resolveSource({ ...imported, kind: "papers", url: "https://arxiv.org/abs/2301.12345v2" })).toEqual({ mode: "remote_pdf", url: "https://arxiv.org/pdf/2301.12345v2" });
    expect(resolveMode({ ...imported, url: "https://arxiv.org/abs/not-a-paper" })).toBe("link_only");
    expect(resolveMode({ ...imported, url: "https://arxiv.org.evil.test/abs/2301.12345" })).toBe("link_only");
  });
  it("supports official previews without blanket framing unknown providers", () => {
    expect(resolveMode({ ...imported, kind: "books", url: "https://books.google.com/books?id=AbCdEfGh" })).toBe("provider");
    expect(resolveMode({ ...imported, kind: "podcasts", url: "https://open.spotify.com/episode/1234567890123456789012" })).toBe("provider");
    expect(resolveSource({ ...imported, url: "https://publisher.org/article" }).reason).toBeTruthy();
    expect(resolveMode({ ...imported, url: "https://unsupported.org/video" })).toBe("link_only");
  });
  it("classifies direct originals and in-app sources without promoting imported restrictions", () => {
    const article = { ...imported, kind: "articles", url: "https://publisher.org/article" };
    expect(resolveSource(article).mode).toBe("link_only");
    expect(resolveSource({ ...article, url: "https://arxiv.org/abs/2001.08361", kind: "papers" }).mode).toBe("remote_pdf");
    expect(resolveSource(imported).mode).toBe("video");
    expect(resolveSource({ ...imported, embeddingStatus: "blocked" }).mode).toBe("link_only");
    expect(resolveSource({ ...imported, embeddingStatus: "broken" }).mode).toBe("link_only");
    expect(resolveSource({ ...imported, rightsStatus: "link_only" }).mode).toBe("link_only");
  });
  it.each(["https://localhost/a.pdf", "https://127.0.0.1/a.pdf", "https://[::1]/a.pdf", "https://user:password@publisher.org/a.pdf", "https://en.wikipedia.org/a.pdf"])("does not frame unsafe files: %s", (url) => {
    expect(mediaUrl(url)).toBeNull();
    expect(resolveMode({ ...imported, url })).toBe("link_only");
  });
  it("parses YouTube ids and uses the privacy-enhanced player", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://youtu.be/dQw4w9WgXcQ?t=3")).toBe("dQw4w9WgXcQ");
    expect(playerFor("https://youtu.be/dQw4w9WgXcQ")?.src).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\//);
    expect(playerFor("https://vimeo.com/123456789")?.src).toMatch(/^https:\/\/player\.vimeo\.com\/video\/123456789/);
    expect(playerFor("https://example.com/video")).toBeNull();
  });

  it("only hosts full content with owned, licensed or public-domain rights", () => {
    expect(canHostFullContent("owned")).toBe(true);
    expect(canHostFullContent("public_domain")).toBe(true);
    expect(canHostFullContent("embed_only")).toBe(false);
    expect(canHostFullContent("unknown")).toBe(false);
    const base = { url: "https://ex.org/a", embeddingStatus: "needs_review" };
    expect(resolveMode({ ...base, embedType: "internal_reader", rightsStatus: "unknown", hasBody: true })).toBe("link_only");
    expect(resolveMode({ ...base, embedType: "internal_reader", rightsStatus: "licensed", hasBody: true })).toBe("internal_reader");
    expect(resolveMode({ ...base, embedType: "pdf", rightsStatus: "embed_only", contentUrl: "https://ex.org/a.pdf" })).toBe("link_only");
  });

  it("falls back to a link when an embed is unchecked, blocked or broken", () => {
    const base = { url: "https://ex.org/a", rightsStatus: "embed_only" };
    expect(resolveMode({ ...base, embedType: "embedded_external", embeddingStatus: "needs_review" })).toBe("link_only");
    expect(resolveMode({ ...base, embedType: "embedded_external", embeddingStatus: "approved" })).toBe("embedded_external");
    expect(resolveMode({ ...base, url: "https://youtu.be/dQw4w9WgXcQ", embedType: "video", embeddingStatus: "broken" })).toBe("link_only");
  });
});
