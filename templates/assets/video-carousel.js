/**
 * Responsive video carousel – grid → scrollable
 * Shows 3 cards on desktop, becomes horizontal scroll on small screens.
 * Nudge to next item when pressing play/pause.
 */

document.addEventListener("DOMContentLoaded", () => {
  const section = document.querySelector('[id^="behind-brands-"]');
  if (!section) return;

  const grid = section.querySelector(".bb-grid");
  const cards = Array.from(section.querySelectorAll(".bb-card"));
  if (!grid || !cards.length) return;

  const isMobile = () => window.innerWidth <= 768;
  const isTablet = () => window.innerWidth > 768 && window.innerWidth <= 1024;

  /** Apply responsive layout */
  function applyLayout() {
    if (isMobile() || isTablet()) {
      grid.style.display = "flex";
      grid.style.overflowX = "auto";
      grid.style.scrollSnapType = "x mandatory";
      grid.style.scrollBehavior = "smooth";
      grid.style.gap = "14px";
      cards.forEach(card => {
        card.style.flex = "0 0 85%"; // גודל קצת קטן כדי לראות רמז לשקופית הבאה
        card.style.scrollSnapAlign = "center";
      });
    } else {
      grid.style.display = "grid";
      grid.style.gridTemplateColumns = "repeat(3, 1fr)";
      grid.style.overflowX = "visible";
      cards.forEach(card => {
        card.style.flex = "initial";
      });
    }
  }

  /** Nudge right when play/pause pressed */
  function wirePlayPause() {
    section.addEventListener("click", e => {
      const btn = e.target.closest(".bbv-btn--play");
      if (!btn) return;

      const card = btn.closest(".bb-card");
      const video = card?.querySelector("video");
      if (!video) return;

      if (video.paused) video.play();
      else video.pause();

      if (isMobile() || isTablet()) {
        const shift = grid.clientWidth * 0.25; // בערך רבע נגיעה ימינה
        grid.scrollBy({ left: shift, behavior: "smooth" });
      }
    });
  }

  applyLayout();
  wirePlayPause();

  window.addEventListener("resize", applyLayout);
});
