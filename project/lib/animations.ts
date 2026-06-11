import gsap from 'gsap';

// ─── Card Dealing Animation ────────────────────────────────────────────────────

/** Animate cards being dealt to the player's hand */
export const animateCardDeal = (
  cardElements: NodeListOf<Element> | Element[],
  fromElement?: Element | null
): gsap.core.Timeline => {
  const tl = gsap.timeline();
  const fromRect = fromElement?.getBoundingClientRect();

  tl.fromTo(
    cardElements,
    {
      opacity: 0,
      scale: 0.3,
      y: fromRect ? -(window.innerHeight - fromRect.top) : -200,
      x: fromRect ? fromRect.left - window.innerWidth / 2 : 0,
      rotateZ: () => gsap.utils.random(-30, 30),
    },
    {
      opacity: 1,
      scale: 1,
      y: 0,
      x: 0,
      rotateZ: 0,
      stagger: { each: 0.08, from: 'start' },
      duration: 0.5,
      ease: 'back.out(1.4)',
    }
  );

  return tl;
};

// ─── Card Play Animation ───────────────────────────────────────────────────────

/** Animate a card flying from hand to the discard pile */
export const animateCardPlay = (
  cardElement: Element,
  targetElement: Element,
  onComplete?: () => void
): void => {
  const cardRect = cardElement.getBoundingClientRect();
  const targetRect = targetElement.getBoundingClientRect();

  const deltaX = targetRect.left + targetRect.width / 2 - (cardRect.left + cardRect.width / 2);
  const deltaY = targetRect.top + targetRect.height / 2 - (cardRect.top + cardRect.height / 2);

  gsap.to(cardElement, {
    x: deltaX,
    y: deltaY,
    scale: 0.8,
    rotateZ: gsap.utils.random(-15, 15),
    duration: 0.4,
    ease: 'power3.out',
    onComplete: () => {
      gsap.set(cardElement, { clearProps: 'all' });
      onComplete?.();
    },
  });
};

// ─── Card Draw Animation ───────────────────────────────────────────────────────

/** Animate a card sliding from draw pile to hand */
export const animateCardDraw = (
  cardElement: Element,
  fromElement?: Element | null
): void => {
  const fromRect = fromElement?.getBoundingClientRect();

  gsap.fromTo(
    cardElement,
    {
      opacity: 0,
      scale: 0.5,
      y: fromRect ? -(window.innerHeight - fromRect.top) : -300,
      rotateY: 180,
    },
    {
      opacity: 1,
      scale: 1,
      y: 0,
      rotateY: 0,
      duration: 0.6,
      ease: 'back.out(1.2)',
    }
  );
};

// ─── Card Flip Animation ──────────────────────────────────────────────────────

export const animateCardFlip = (cardElement: Element): void => {
  gsap.fromTo(
    cardElement,
    { rotateY: 0 },
    {
      rotateY: 360,
      duration: 0.6,
      ease: 'power2.inOut',
    }
  );
};

// ─── Screen Shake ──────────────────────────────────────────────────────────────

export const animateScreenShake = (intensity: number = 5): void => {
  const body = document.body;
  gsap.to(body, {
    x: intensity,
    duration: 0.05,
    yoyo: true,
    repeat: 5,
    ease: 'none',
    onComplete: () => gsap.set(body, { x: 0 }),
  });
};

// ─── Draw Two/Four Effect ──────────────────────────────────────────────────────

export const animateDrawPenalty = (count: number): void => {
  animateScreenShake(count === 4 ? 8 : 4);

  // Flash overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 9999; pointer-events: none;
    background: ${count === 4 ? 'rgba(139, 0, 0, 0.3)' : 'rgba(255, 165, 0, 0.3)'};
  `;
  document.body.appendChild(overlay);

  gsap.fromTo(
    overlay,
    { opacity: 1 },
    {
      opacity: 0,
      duration: 0.6,
      ease: 'power2.out',
      onComplete: () => overlay.remove(),
    }
  );
};

// ─── Skip Turn Animation ───────────────────────────────────────────────────────

export const animateSkipTurn = (): void => {
  const skipIcon = document.createElement('div');
  skipIcon.innerHTML = '⊘';
  skipIcon.style.cssText = `
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    font-size: 120px; z-index: 9999; pointer-events: none;
    color: white; text-shadow: 0 0 40px rgba(255,0,0,0.8);
  `;
  document.body.appendChild(skipIcon);

  gsap.fromTo(
    skipIcon,
    { scale: 0, opacity: 0, rotateZ: -180 },
    {
      scale: 1,
      opacity: 1,
      rotateZ: 0,
      duration: 0.4,
      ease: 'back.out(2)',
      onComplete: () => {
        gsap.to(skipIcon, {
          opacity: 0,
          scale: 1.5,
          delay: 0.5,
          duration: 0.3,
          onComplete: () => skipIcon.remove(),
        });
      },
    }
  );
};

// ─── Reverse Animation ─────────────────────────────────────────────────────────

export const animateReverse = (): void => {
  const arrow = document.createElement('div');
  arrow.innerHTML = '⇄';
  arrow.style.cssText = `
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    font-size: 100px; z-index: 9999; pointer-events: none;
    color: white; text-shadow: 0 0 40px rgba(59,130,246,0.8);
  `;
  document.body.appendChild(arrow);

  gsap.fromTo(
    arrow,
    { scale: 0, opacity: 0, rotateZ: 0 },
    {
      scale: 1.2,
      opacity: 1,
      rotateZ: 360,
      duration: 0.5,
      ease: 'power4.out',
      onComplete: () => {
        gsap.to(arrow, {
          opacity: 0,
          scale: 2,
          delay: 0.4,
          duration: 0.3,
          onComplete: () => arrow.remove(),
        });
      },
    }
  );
};

// ─── UNO Call Animation ────────────────────────────────────────────────────────

export const animateUnoCall = (): void => {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 9999; pointer-events: none;
    display: flex; align-items: center; justify-content: center;
  `;

  const text = document.createElement('div');
  text.innerHTML = 'UNO!';
  text.style.cssText = `
    font-size: 100px; font-weight: 900; letter-spacing: 8px;
    background: linear-gradient(135deg, #FF6B6B, #FFD93D, #4D96FF, #6BCB77);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text; filter: drop-shadow(0 0 30px rgba(255,255,255,0.5));
  `;
  overlay.appendChild(text);
  document.body.appendChild(overlay);

  const tl = gsap.timeline({
    onComplete: () => overlay.remove(),
  });

  tl.fromTo(text, { scale: 0, rotateZ: -20 }, {
    scale: 1.3,
    rotateZ: 0,
    duration: 0.4,
    ease: 'back.out(3)',
  })
    .to(text, { scale: 1, duration: 0.2 })
    .to(text, { scale: 1.5, opacity: 0, duration: 0.4, delay: 0.6 });
};

// ─── Win Celebration ───────────────────────────────────────────────────────────

export const animateWinCelebration = (): void => {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 9999; pointer-events: none;
    display: flex; align-items: center; justify-content: center;
    flex-direction: column; gap: 16px;
  `;

  const title = document.createElement('div');
  title.innerHTML = '🎉 YOU WIN! 🎉';
  title.style.cssText = `
    font-size: 56px; font-weight: 900; color: #FFD700;
    text-shadow: 0 0 40px rgba(255,215,0,0.6), 0 4px 20px rgba(0,0,0,0.4);
  `;
  overlay.appendChild(title);
  document.body.appendChild(overlay);

  gsap.fromTo(title, { scale: 0, rotateZ: -10 }, {
    scale: 1,
    rotateZ: 0,
    duration: 0.6,
    ease: 'elastic.out(1, 0.5)',
  });

  // Auto-remove after 3 seconds
  gsap.to(overlay, {
    opacity: 0,
    delay: 3,
    duration: 0.5,
    onComplete: () => overlay.remove(),
  });
};

// ─── Pulse Glow Effect ─────────────────────────────────────────────────────────

export const animatePulseGlow = (element: Element, color: string = '#FFD700'): void => {
  gsap.fromTo(
    element,
    { boxShadow: `0 0 0px ${color}` },
    {
      boxShadow: `0 0 30px ${color}, 0 0 60px ${color}`,
      duration: 0.6,
      yoyo: true,
      repeat: 2,
      ease: 'power2.inOut',
    }
  );
};

// ─── Turn Indicator Animation ──────────────────────────────────────────────────

export const animateTurnChange = (element: Element): void => {
  gsap.fromTo(
    element,
    { scale: 0.9, opacity: 0.5 },
    {
      scale: 1,
      opacity: 1,
      duration: 0.4,
      ease: 'back.out(2)',
    }
  );
};

// ─── Page Transition ───────────────────────────────────────────────────────────

export const animatePageEnter = (element: Element): void => {
  gsap.fromTo(
    element,
    { opacity: 0, y: 30 },
    { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }
  );
};

export const animateStaggerChildren = (
  parent: Element,
  selector: string,
  delay: number = 0
): void => {
  const children = parent.querySelectorAll(selector);
  gsap.fromTo(
    children,
    { opacity: 0, y: 20, scale: 0.95 },
    {
      opacity: 1,
      y: 0,
      scale: 1,
      stagger: 0.1,
      delay,
      duration: 0.5,
      ease: 'power2.out',
    }
  );
};
