/**
 * Branded launch overlay. Mounted once in the root component, so client-side
 * navigation never re-renders it. Dismissal is pure CSS (animation ends with
 * visibility hidden + no pointer events), so failed hydration cannot block the UI.
 */
import waxSeal from "@/assets/brand-wax-seal-fountain.png";
import paperGrain from "@/assets/brand-paper-grain.jpg.asset.json";

export function LaunchOverlay() {
  return (
    <div className="launch-overlay" role="status" aria-label="Opening the archive" aria-live="polite">
      <img src={paperGrain.url} alt="" aria-hidden="true" className="launch-paper" />
      <div className="launch-inner">
        <img src={waxSeal} alt="" aria-hidden="true" className="launch-mark" width={160} height={160} />
        <p className="launch-wordmark" aria-hidden="true">
          Curiosity,
          <br />
          Sourced
        </p>
        <p className="launch-status">Opening the archive…</p>
        <div className="launch-trail" aria-hidden="true">
          <span className="launch-diamond" />
        </div>
        <p className="launch-tagline">Understand the mechanism. Follow the evidence.</p>
      </div>
    </div>
  );
}
