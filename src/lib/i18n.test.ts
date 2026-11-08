import { describe, expect, it } from "vitest";
import { detectLanguage, dirFor, isLanguage, LANGUAGE_CODES, resolveLanguagePreference } from "./i18n";
import { DICTIONARIES } from "./translations";

describe("supported reader locales", () => {
  it("supports exactly English and French", () => {
    expect(LANGUAGE_CODES).toEqual(["en", "fr"]);
    expect(Object.keys(DICTIONARIES)).toEqual(["en", "fr"]);
    expect(isLanguage("en")).toBe(true);
    expect(isLanguage("fr")).toBe(true);
  });
  it.each(["es", "zh", "ar", "invalid", ""])("migrates stored %s to the supported browser preference", (stored) => {
    expect(isLanguage(stored)).toBe(false);
    expect(resolveLanguagePreference(stored, ["ar", "fr-FR"])).toEqual({ lang: "fr", chosen: true });
    expect(resolveLanguagePreference(stored, ["zh", "es"])).toEqual({ lang: "en", chosen: true });
  });
  it("retains explicit English/French preferences", () => {
    expect(resolveLanguagePreference("en", ["fr-FR"])).toEqual({ lang: "en", chosen: true });
    expect(resolveLanguagePreference("fr", ["en-US"])).toEqual({ lang: "fr", chosen: true });
  });
  it("preselects first-visit language without inventing a saved choice", () => {
    expect(resolveLanguagePreference(null, ["fr-CA"])).toEqual({ lang: "fr", chosen: false });
    expect(detectLanguage(["ar-SA", "en-GB"])).toBe("en");
  });
  it("never leaves either supported language in RTL", () => {
    expect(dirFor("en")).toBe("ltr");
    expect(dirFor("fr")).toBe("ltr");
  });
});