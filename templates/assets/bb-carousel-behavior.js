/**
 * Behind-the-brands – Responsive behavior
 * - Desktop (>=1025px): 3 בעמודה. מנגן אוטומטית את הכרטיס האמצעי; לחיצה על Play מפסיקה אחרים ומנגנת את הנוכחי.
 * - Tablet/Mobile (<=1024px): הופך לקרוסלה אופקית. השקופית המרכזית מנגנת אוטומטית; Play גם מנגן וגם עובר לשקופית הבאה.
 */

document.addEventListener("DOMContentLoaded", () => {
  // תופס את הסקשן שלך (id מתחיל ב-behind-brands-)
  const section = document.querySelector('[id^="behind-brands-"]');
  if (!section) return;

  const grid   = section.querySelector(".bb-grid");
  if (!grid) return;

  const getCards = () => Array.from(section.querySelectorAll(".bb-card"));
  const getVideo = (card) => card?.querySelector(".bb-video-el");

  const isDesktop = () => window.innerWidth >= 1025;
  const isTouch   = () => window.innerWidth <= 1024;

  // מכין את הווידאוים לאוטופליי (מותר במובייל רק כשהם מושתקים)
  function primeVideos() {
    getCards().forEach(card => {
      const v = getVideo(card);
      if (!v) return;
      v.setAttribute("playsinline", "");
      v.setAttribute("muted", "");
      v.muted = true;
      v.removeAttribute("controls");
      if (v.preload !== "metadata") v.preload = "metadata";
    });
  }

  // עוצר את כולם חוץ מאחד (או את כולם אם except = null)
  function pauseOthers(except) {
    getCards().forEach(card => {
      const v = getVideo(card);
      if (!v) return;
      if (except && v === except) return;
      if (!v.paused) v.pause();
    });
  }

  async function safePlay(v) {
    if (!v) return;
    try {
      v.muted = true;
      v.setAttribute("muted", "");
      await v.play();
    } catch (e) { /* נחסם – נשתוק */ }
  }

  // מנגן את הכרטיס הנתון ומפסיק אחרים
  function playCard(card) {
    const v = getVideo(card);
    if (!v) return;
    pauseOthers(v);
    safePlay(v);
  }

  // --- דסקטופ: מנגן את האמצעי כברירת מחדל
  function playCenterDesktop() {
    if (!isDesktop()) return;
    const cards = getCards();
    if (!cards.length) return;
    const centerIdx = Math.floor(cards.length / 2);
    playCard(cards[centerIdx]);
  }

  // --- מובייל: מזהה את השקופית "במרכז" ומנגן אותה
  function visibleCardByCenter() {
    const cards = getCards();
    if (!cards.length) return null;
    const midX = grid.scrollLeft + grid.clientWidth / 2;
    let best = null, bestDist = Infinity;
    cards.forEach(card => {
      const rect = card.getBoundingClientRect();
      // חשב מרכז כרטיס יחסית לגריד
      const cardMid = rect.left + rect.width / 2 + grid.scrollLeft;
      const dist = Math.abs(cardMid - midX);
      if (dist < bestDist) { bestDist = dist; best = card; }
    });
    return best;
  }

  function autoPlayVisibleMobile() {
    if (!isTouch()) return;
    const center = visibleCardByCenter();
    if (center) playCard(center);
  }

  // --- “נשיכה” לשקופית הבאה (מובייל/טאבלט) אחרי Play
  function nudgeToNext() {
    if (!isTouch()) return;
    const cards = getCards();
    const current = visibleCardByCenter();
    if (!current) return;
    const idx = cards.indexOf(current);
    const next = cards[Math.min(idx + 1, cards.length - 1)];
    if (!next) return;
    next.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }

  // --- האזנה ללחיצות Play (overlay שלך)
  function wirePlayClicks() {
    section.addEventListener("click", (e) => {
      const btn = e.target.closest(".bbv-btn--play");
      if (!btn) return;

      const card = btn.closest(".bb-card");
      const v = getVideo(card);
      if (!v) return;

      if (v.paused) {
        playCard(card);
      } else {
        v.pause();
      }

      if (isTouch()) {
        // במובייל: אחרי Play – זזים לשקופית הבאה
        nudgeToNext();
      }
    }, { passive: true });
  }

  // --- עוצר הכל כשעוזבים טאב; כשחוזרים – מפעיל את הנכון (דסקטופ: אמצעי, מובייל: מרכז)
  function wireVisibility() {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") {
        pauseOthers(null);
      } else {
        isDesktop() ? playCenterDesktop() : autoPlayVisibleMobile();
      }
    });
  }

  // --- גלילה/שינוי גודל: במובייל מנגן את המרכז
  function wireScrollAndResize() {
    const onChange = () => {
      if (isTouch()) {
        autoPlayVisibleMobile();
      } else {
        playCenterDesktop();
      }
    };
    grid.addEventListener("scroll", onChange, { passive: true });
    window.addEventListener("resize", onChange);
  }

  // === INIT ===
  primeVideos();
  // דסקטופ: מיד האמצעי. מובייל: אחרי tick קצר כדי לחשב גדלים
  if (isDesktop()) {
    playCenterDesktop();
  } else {
    setTimeout(autoPlayVisibleMobile, 50);
  }
  wirePlayClicks();
  wireVisibility();
  wireScrollAndResize();
});
