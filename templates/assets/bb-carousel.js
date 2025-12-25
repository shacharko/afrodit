/* assets/bb-carousel.js — unified desktop+mobile behavior */
(function () {
  "use strict";

  const DESKTOP_BP = 1024;   // Desktop from this width
  const SINGLE_BP  = 450;    // Up to this width -> single card "peek" carousel

  const SELECTORS = {
    section: "[data-bb-section]",
    track:   "[data-bb-track]",
    card:    "[data-bb-card]",
    video:   ".bb-video",
    play:    "[data-bb-play]",
    mute:    "[data-bb-mute]"
  };

  /* ---------- utils ---------- */
  const onReady = (fn) => {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  };
  const qs  = (el, s) => el.querySelector(s);
  const qsa = (el, s) => Array.from(el.querySelectorAll(s));
  const isDesktop = () => window.matchMedia(`(min-width:${DESKTOP_BP}px)`).matches;
  const isSingle  = () => window.innerWidth <= SINGLE_BP;

  // how many cards should be visible now
  function perView() { return isSingle() ? 1 : 3; }

  const getGap = (track) => parseFloat(getComputedStyle(track).gap || "0") || 0;
  const stepWidth = (track, cards) => (cards[0]?.offsetWidth || 0) + getGap(track);

  const firstVisibleIndex = (track, cards) => {
    const step = stepWidth(track, cards) || 1;
    return Math.max(0, Math.round(track.scrollLeft / step));
  };
  const visibleRange = (track, cards, count) => {
    const first = firstVisibleIndex(track, cards);
    const last  = Math.min(cards.length - 1, first + (count - 1));
    return { first, last };
  };

  const setPressed = (btn, on) => btn && btn.setAttribute("aria-pressed", on ? "true" : "false");

  // ⬇️ שינוי יחיד: גלילה אופקית בלבד בתוך ה-track, עם ניסיון למרכז את הכרטיס, בלי להזיז את כל הדף
  const scrollToCard = (track, card, behavior = "smooth") => {
    if (!track || !card) return;

    const cardLeftInTrack = card.offsetLeft - track.offsetLeft;
    const centerOffset = (track.clientWidth - card.offsetWidth) / 2;
    let targetLeft = cardLeftInTrack - Math.max(0, centerOffset);

    const maxScroll = track.scrollWidth - track.clientWidth;
    if (targetLeft < 0) targetLeft = 0;
    if (targetLeft > maxScroll) targetLeft = maxScroll;

    track.scrollTo({
      left: targetLeft,
      behavior
    });
  };

  const pauseAllExcept = (exceptVideo, root) => {
    qsa(root, SELECTORS.video).forEach(v => { if (v !== exceptVideo) v.pause(); });
    // sync play buttons
    qsa(root, SELECTORS.play).forEach(btn => {
      const v = btn.closest(SELECTORS.card)?.querySelector(SELECTORS.video);
      setPressed(btn, !!v && !v.paused);
    });
  };

  /* ---------- main ---------- */
  function setupSection(sec){
    const track = qs(sec, SELECTORS.track);
    const cards = qsa(sec, SELECTORS.card);
    if (!track || !cards.length) return;

    // init: desktop -> middle(1) of first three; mobile -> first
    const startIdx  = isDesktop() ? Math.min(1, cards.length - 2) : 0;
    const startCard = cards[startIdx];
    const startVid  = startCard?.querySelector(SELECTORS.video);

    const tryAutoplay = () => {
      if (!startVid) return;
      startVid.muted = true;
      pauseAllExcept(startVid, sec);
      startVid.play().catch(()=>{});
      setPressed(startCard.querySelector(SELECTORS.play), true);
    };

    scrollToCard(track, startCard, "auto");
    requestAnimationFrame(() => setTimeout(tryAutoplay, 80));

    // sync UI with media events
    qsa(sec, SELECTORS.video).forEach(v => {
      v.addEventListener("play",  () => pauseAllExcept(v, sec));
      v.addEventListener("pause", () => setPressed(v.closest(SELECTORS.card)?.querySelector(SELECTORS.play), false));
      v.addEventListener("ended", () => setPressed(v.closest(SELECTORS.card)?.querySelector(SELECTORS.play), false));
      v.addEventListener("volumechange", () =>
        setPressed(v.closest(SELECTORS.card)?.querySelector(SELECTORS.mute), v.muted)
      );
    });

    /* ---------- clicks on buttons ---------- */
    track.addEventListener("click", (e) => {
      const btnPlay = e.target.closest(SELECTORS.play);
      const btnMute = e.target.closest(SELECTORS.mute);
      if (!btnPlay && !btnMute) return;

      const card  = e.target.closest(SELECTORS.card);
      const video = card?.querySelector(SELECTORS.video);
      if (!video) return;

      const { first, last } = visibleRange(track, cards, perView());
      const idx = parseInt(card.dataset.index || "0", 10);

      const togglePlay = () => {
        if (video.paused) {
          pauseAllExcept(video, sec);
          video.play().catch(()=>{});
          setPressed(btnPlay, true);
        } else {
          video.pause();
          setPressed(btnPlay, false);
        }
      };
      const toggleMute = () => {
        video.muted = !video.muted;
        setPressed(btnMute, video.muted);
      };

      if (isDesktop()) {
        // desktop: both play & mute at edges move one step
        const isLeftEdge  = idx === first;
        const isRightEdge = idx === last;

        if (btnPlay) togglePlay();
        if (btnMute) toggleMute();

        if (cards.length > 3) {
          if (isRightEdge && last < cards.length - 1)      scrollToCard(track, cards[last + 1]);
          else if (isLeftEdge && first > 0)                scrollToCard(track, cards[first - 1]);
        }
      } else if (isSingle()) {
        // mobile single-card: buttons DO NOT move – only control media
        if (btnPlay) togglePlay();
        if (btnMute) toggleMute();
      } else {
        // fallback (tablet >450 but <1024, though CSS מציג 3) – כמו desktop
        if (btnPlay) togglePlay();
        if (btnMute) toggleMute();
      }
    });

    /* ---------- mobile tap on side “peeks” to move & autoplay ---------- */
    track.addEventListener("click", (e) => {
      if (!isSingle()) return; // only up to 450px
      if (e.target.closest(SELECTORS.play) || e.target.closest(SELECTORS.mute)) return; // buttons handled above

      const rect   = track.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const goRight = clickX > rect.width / 2;

      const { first, last } = visibleRange(track, cards, 1);
      const targetIndex = goRight
        ? Math.min(cards.length - 1, last + 1)
        : Math.max(0, first - 1);

      const nextCard = cards[targetIndex];
      if (nextCard) {
        scrollToCard(track, nextCard);
        const v = nextCard.querySelector(SELECTORS.video);
        if (v) {
          pauseAllExcept(v, sec);
          v.muted = true;
          v.play().catch(()=>{});
          setPressed(nextCard.querySelector(SELECTORS.play), true);
        }
      }
    });

    /* ---------- wheel paging on desktop: step-by-step ---------- */
    track.addEventListener("wheel", (e) => {
      if (!isDesktop()) return;
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        const { first, last } = visibleRange(track, cards, 3);
        const dir = e.deltaY > 0 ? 1 : -1;
        const target = dir > 0 ? Math.min(cards.length - 1, last + 1)
                               : Math.max(0, first - 1);
        scrollToCard(track, cards[target]);
      }
    }, { passive: false });

    /* ---------- stabilize on resize ---------- */
    let rAf;
    window.addEventListener("resize", () => {
      cancelAnimationFrame(rAf);
      rAf = requestAnimationFrame(() => {
        const { first } = visibleRange(track, cards, perView());
        scrollToCard(track, cards[first], "auto");

        if (isDesktop()) {
          // ensure the centered (middle of visible) is muted autoplay
          const { first: f, last: l } = visibleRange(track, cards, 3);
          const mid = Math.min(l, Math.max(f, f + 1));
          const v = cards[mid]?.querySelector(SELECTORS.video);
          if (v) {
            v.muted = true;
            pauseAllExcept(v, sec);
            v.play().catch(()=>{});
            setPressed(cards[mid].querySelector(SELECTORS.play), true);
          }
        } else if (isSingle()) {
          const v = cards[0]?.querySelector(SELECTORS.video);
          if (v) {
            v.muted = true;
            pauseAllExcept(v, sec);
            v.play().catch(()=>{});
            setPressed(cards[0].querySelector(SELECTORS.play), true);
          }
        }
      });
    });
  }

  onReady(() => {
    document.querySelectorAll(SELECTORS.section).forEach(setupSection);
  });
})();
