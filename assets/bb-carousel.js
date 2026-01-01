/* assets/bb-carousel.js — LTR-only, cleaned (single click handler) */
(function () {
  "use strict";

  const DESKTOP_BP = 1024; // desktop from this width
  const SINGLE_BP  = 450;  // up to this width -> single card "peek" carousel

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

  const perView = () => (isSingle() ? 1 : 3);

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

  const setPressed = (btn, on) => {
    if (!btn) return;
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  };

  // Scroll horizontally within the track and try to center the card
  const scrollToCard = (track, card, behavior = "smooth") => {
    if (!track || !card) return;

    const cardLeftInTrack = card.offsetLeft - track.offsetLeft;
    const centerOffset = (track.clientWidth - card.offsetWidth) / 2;
    let targetLeft = cardLeftInTrack - Math.max(0, centerOffset);

    const maxScroll = track.scrollWidth - track.clientWidth;
    if (targetLeft < 0) targetLeft = 0;
    if (targetLeft > maxScroll) targetLeft = maxScroll;

    track.scrollTo({ left: targetLeft, behavior });
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

    // init: desktop -> middle of first three; otherwise -> first
    const startIdx  = isDesktop() ? Math.min(1, Math.max(0, cards.length - 2)) : 0;
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

    // Sync UI with media events
    qsa(sec, SELECTORS.video).forEach(v => {
      v.addEventListener("play",  () => pauseAllExcept(v, sec));
      v.addEventListener("pause", () => setPressed(v.closest(SELECTORS.card)?.querySelector(SELECTORS.play), false));
      v.addEventListener("ended", () => setPressed(v.closest(SELECTORS.card)?.querySelector(SELECTORS.play), false));
      v.addEventListener("volumechange", () =>
        setPressed(v.closest(SELECTORS.card)?.querySelector(SELECTORS.mute), v.muted)
      );
    });

    /* ---------- single click handler (buttons + mobile tap paging) ---------- */
    track.addEventListener("click", (e) => {
      const btnPlay = e.target.closest(SELECTORS.play);
      const btnMute = e.target.closest(SELECTORS.mute);

      const card  = e.target.closest(SELECTORS.card);
      if (!card) return;

      const video = card.querySelector(SELECTORS.video);
      const idx   = parseInt(card.dataset.index || "0", 10);

      const doTogglePlay = () => {
        if (!video || !btnPlay) return;
        if (video.paused) {
          pauseAllExcept(video, sec);
          video.play().catch(()=>{});
          setPressed(btnPlay, true);
        } else {
          video.pause();
          setPressed(btnPlay, false);
        }
      };

      const doToggleMute = () => {
        if (!video || !btnMute) return;
        video.muted = !video.muted;
        setPressed(btnMute, video.muted);
      };

      // If clicked on controls, only control media (+ desktop edge paging behavior)
      if (btnPlay || btnMute) {
        const { first, last } = visibleRange(track, cards, perView());
        const isLeftEdge  = idx === first;
        const isRightEdge = idx === last;

        if (btnPlay) doTogglePlay();
        if (btnMute) doToggleMute();

        // Desktop: edge click also moves one step (if more than 3 cards)
        if (isDesktop() && cards.length > 3) {
          if (isRightEdge && last < cards.length - 1) scrollToCard(track, cards[last + 1]);
          else if (isLeftEdge && first > 0)           scrollToCard(track, cards[first - 1]);
        }
        return;
      }

      // Mobile (single card): tap left/right side to move & autoplay next
      if (isSingle()) {
        const rect   = track.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const goRight = clickX > rect.width / 2;

        const { first, last } = visibleRange(track, cards, 1);
        const targetIndex = goRight
          ? Math.min(cards.length - 1, last + 1)
          : Math.max(0, first - 1);

        const nextCard = cards[targetIndex];
        if (!nextCard) return;

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

    /* ---------- wheel paging on desktop ---------- */
    track.addEventListener("wheel", (e) => {
      if (!isDesktop()) return;

      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        const { first, last } = visibleRange(track, cards, 3);
        const dir = e.deltaY > 0 ? 1 : -1;
        const target = dir > 0
          ? Math.min(cards.length - 1, last + 1)
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
