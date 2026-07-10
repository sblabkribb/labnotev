// Injectable helpers that draw a "click here" highlight overlay on top of the
// VS Code / Cursor workbench DOM before a screenshot is taken. Because CDP
// input does not move the real OS cursor, this overlay is what makes the
// captured screenshots read as a guided tutorial.
//
// These functions are passed to Playwright's page.evaluate(), so they must be
// self-contained (no imports, no outer-scope references).

/**
 * Returns the source of a browser-side function that installs the overlay API
 * on window.__labnoteHighlight. Call once per page.
 */
export function overlayInstallerSource() {
  return function installLabnoteHighlight() {
    if (window.__labnoteHighlight) return;

    const styleId = "labnote-highlight-style";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        .labnote-hl-ring {
          position: fixed;
          z-index: 2147483646;
          border: 3px solid #ff5c5c;
          border-radius: 8px;
          box-shadow: 0 0 0 3px rgba(255,92,92,0.25), 0 6px 20px rgba(0,0,0,0.35);
          pointer-events: none;
          transition: all 120ms ease-out;
        }
        .labnote-hl-badge {
          position: fixed;
          z-index: 2147483647;
          min-width: 26px;
          height: 26px;
          padding: 0 6px;
          background: #ff5c5c;
          color: #fff;
          font: 700 14px/26px -apple-system, "Segoe UI", sans-serif;
          text-align: center;
          border-radius: 13px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          pointer-events: none;
        }
      `;
      document.documentElement.appendChild(style);
    }

    function clear() {
      document
        .querySelectorAll(".labnote-hl-ring, .labnote-hl-badge")
        .forEach((el) => el.remove());
    }

    function ringRect(rect, label) {
      clear();
      const pad = 4;
      const ring = document.createElement("div");
      ring.className = "labnote-hl-ring";
      ring.style.left = rect.x - pad + "px";
      ring.style.top = rect.y - pad + "px";
      ring.style.width = rect.width + pad * 2 + "px";
      ring.style.height = rect.height + pad * 2 + "px";
      document.documentElement.appendChild(ring);

      if (label != null && label !== "") {
        const badge = document.createElement("div");
        badge.className = "labnote-hl-badge";
        badge.textContent = String(label);
        badge.style.left = rect.x - pad - 13 + "px";
        badge.style.top = rect.y - pad - 13 + "px";
        document.documentElement.appendChild(badge);
      }
    }

    window.__labnoteHighlight = {
      clear,
      /** Highlight by a bounding rect {x,y,width,height}. */
      rect: ringRect,
      /** Highlight the first element matching a CSS selector. */
      selector(sel, label) {
        const el = document.querySelector(sel);
        if (!el) return false;
        const r = el.getBoundingClientRect();
        ringRect(
          { x: r.left, y: r.top, width: r.width, height: r.height },
          label
        );
        return true;
      },
    };
  };
}
