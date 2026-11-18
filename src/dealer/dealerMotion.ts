type Point = { x: number; y: number };
type CardSpot = Point & { width: number; height: number };
type Side = 'left' | 'right';
type Movement = 'deal' | 'discard' | 'move';

function handSvg(side: Side) {
  const mirror = side === 'left' ? -1 : 1;

  return `
    <g class="dealer-limb" data-side="${side}">
      <path class="dealer-sleeve-shadow" />
      <path class="dealer-sleeve" />
      <g class="dealer-wrist">
        <g transform="scale(${mirror} 1)">
          <path fill="#fbf5e7" d="M-13 -10 L12 -10 12 0 -13 0Z" />
          <path
            fill="#bd805c"
            stroke="#78472f"
            stroke-width="1.2"
            stroke-linejoin="round"
            d="M-10 -1 Q-14 5 -13 13 L-17 21 Q-18 25 -15 25 L-9 18
               L-8 29 Q-7 33 -4 30 L-4 20 L-2 33 Q0 36 2 32 L2 20
               L5 31 Q8 34 9 29 L7 17 L10 23 Q13 26 14 22 L12 11
               Q12 6 9 0 Z"
          />
          <circle cx="6" cy="-5" r="1.7" fill="#c3a164" />
        </g>
      </g>
    </g>`;
}

export class DealerMotion {
  private felt: HTMLElement;
  private signal: AbortSignal;
  private layer: HTMLDivElement;
  private svg: SVGSVGElement;
  private wrists: Record<Side, Point>;
  private hidden = new Set<HTMLElement>();

  async separatePair(originals: HTMLElement[], layout: () => HTMLElement[]) {
    const starts = originals.map(card => this.measure(card));
    const copies = originals.map((card, i) => {
      const copy = this.ghost(card, starts[i]);
      this.place(copy, starts[i]);
      return copy;
    });

    const zone = originals[0].closest<HTMLElement>('.player-zone')!;
    const visibility = zone.style.visibility;

    try {
      // The copies stay exactly where the original pair was dealt.
      originals.forEach(card => this.hide(card));

      await Promise.all([
        this.reach('left', this.grip(starts[0]), 280),
        this.reach('right', this.grip(starts[1]), 280),
      ]);

      // Measure the two real destinations while the new layout is hidden.
      // The moving cards and dealer arms are on a separate, visible layer.
      zone.style.visibility = 'hidden';
      const ends = layout().map(card => this.measure(card));

      await this.tween(620, t => {
        copies.forEach((copy, i) => {
          const start = starts[i];
          const end = ends[i];
          const at = {
            x: start.x + (end.x - start.x) * t,
            y: start.y + (end.y - start.y) * t - Math.sin(Math.PI * t) * 10,
          };

          this.place(copy, at);
          this.pose(i === 0 ? 'left' : 'right', this.grip(at));
        });
      });
    } finally {
      zone.style.visibility = visibility;
      copies.forEach(copy => copy.remove());
      originals.forEach(card => this.show(card));
    }
  }

  constructor(felt: HTMLElement, signal: AbortSignal) {
    this.felt = felt;
    this.signal = signal;

    this.layer = document.createElement('div');
    this.layer.className = 'dealer-motion';
    this.layer.setAttribute('aria-hidden', 'true');
    this.layer.innerHTML = `
      <svg width="100%" height="100%">
        ${handSvg('left')}
        ${handSvg('right')}
      </svg>`;

    this.svg = this.layer.querySelector('svg')!;
    felt.append(this.layer);

    this.wrists = {
      left: this.home('left'),
      right: this.home('right'),
    };

    this.pose('left', this.wrists.left);
    this.pose('right', this.wrists.right);
  }

  private home(side: Side): Point {
    return {
      x: this.felt.clientWidth * (side === 'left' ? 0.32 : 0.68),
      y: -42,
    };
  }

  private pose(side: Side, wrist: Point) {
    this.wrists[side] = wrist;

    const arm = this.svg.querySelector(`[data-side="${side}"]`)!;
    const shoulder = this.home(side);
    const elbow = {
      x: shoulder.x + (wrist.x - shoulder.x) * 0.38,
      y: wrist.y * 0.6 - 14,
    };

    const angle =
      Math.atan2(elbow.x - wrist.x, wrist.y - elbow.y) * 180 / Math.PI;

    const sleeve =
      `M ${shoulder.x} -70 Q ${elbow.x} ${elbow.y} ${wrist.x} ${wrist.y - 4}`;

    arm.querySelectorAll(':scope > path').forEach(path => {
      path.setAttribute('d', sleeve);
    });

    arm.querySelector('.dealer-wrist')!.setAttribute(
      'transform',
      `translate(${wrist.x} ${wrist.y}) rotate(${angle})`,
    );
  }

  measure(element: HTMLElement): CardSpot {
    const card = element.getBoundingClientRect();
    const table = this.layer.getBoundingClientRect();

    return {
      x: card.left - table.left + card.width / 2,
      y: card.top - table.top + card.height / 2,
      width: element.offsetWidth,
      height: element.offsetHeight,
    };
  }

  private async tween(duration: number, draw: (progress: number) => void) {
    this.signal.throwIfAborted();

    await new Promise<void>((resolve, reject) => {
      const start = performance.now();
      let frame = 0;

      const cancel = () => {
        cancelAnimationFrame(frame);
        reject(new DOMException('Cancelled', 'AbortError'));
      };

      this.signal.addEventListener('abort', cancel, { once: true });

      const tick = (now: number) => {
        const t = Math.min(1, Math.max(0, (now - start) / duration));

        try {
          draw(t * t * (3 - 2 * t));
        } catch (error) {
          this.signal.removeEventListener('abort', cancel);
          reject(error);
          return;
        }

        if (t < 1) {
          frame = requestAnimationFrame(tick);
        } else {
          this.signal.removeEventListener('abort', cancel);
          resolve();
        }
      };

      frame = requestAnimationFrame(tick);
    });
  }

  private grip(card: Point): Point {
    return { x: card.x + 5, y: card.y - 26 };
  }

  private async reach(side: Side, target: Point, duration = 145) {
    const from = this.wrists[side];

    await this.tween(duration, t => {
      this.pose(side, {
        x: from.x + (target.x - from.x) * t,
        y: from.y + (target.y - from.y) * t,
      });
    });
  }

  private back() {
    const back = document.createElement('div');
    back.className = 'card card--back';
    return back;
  }

  hide(card: HTMLElement) {
    card.classList.add('dealer-card-hidden');
    this.hidden.add(card);
  }

  private show(card: HTMLElement) {
    card.classList.remove('dealer-card-hidden');
    this.hidden.delete(card);
  }

  // A moving copy can travel outside the hand's horizontal scroll area.
  private ghost(source: HTMLElement, size: CardSpot) {
    const copy = source.cloneNode(true) as HTMLElement;
    copy.classList.remove('dealer-card-hidden');
    copy.classList.add('dealer-flight');
    copy.removeAttribute('aria-label');
    copy.style.width = `${size.width}px`;
    copy.style.height = `${size.height}px`;
    this.layer.insertBefore(copy, this.svg);
    return copy;
  }

  private place(
    card: HTMLElement,
    at: Point,
    rotation = 0,
    tilt = 0,
    scale = 1,
  ) {
    card.style.transform = `
      translate(${at.x}px, ${at.y}px)
      translate(-50%, -50%)
      perspective(500px)
      rotate(${rotation}deg)
      rotateY(${tilt}deg)
      scale(${scale})
    `;
  }

  async carry(
    card: HTMLElement,
    source: CardSpot,
    target: CardSpot,
    mode: Movement,
    artwork: HTMLElement = card,
    side: Side = mode === 'discard' ? 'left' : 'right',
  ) {
    const size = this.measure(card);
    const face = this.ghost(artwork, size);
    const back = this.ghost(this.back(), size);
    this.hide(card);

    const placeCard = (t: number) => {
      const position = {
        x: source.x + (target.x - source.x) * t,
        y: source.y + (target.y - source.y) * t - Math.sin(t * Math.PI) * 12,
      };

      const turn = Math.max(0, Math.min(1, (t - 0.34) / 0.5));
      let flip = 0;
      let scale = 1;
      let rotation = 0;

      if (mode === 'deal') {
        flip = 1 - turn;
        scale = 0.55 + 0.45 * t;
        rotation = 20 * (1 - t);
      } else if (mode === 'discard') {
        flip = turn;
        scale = 1 - 0.55 * t;
        rotation = -18 * t;
      }

      const faceUp = flip < 0.5;
      face.hidden = !faceUp;
      back.hidden = faceUp;

      const tilt = artwork.classList.contains('card--back')
        ? 0
        : (faceUp ? flip : flip - 1) * 180;

      this.place(faceUp ? face : back, position, rotation, tilt, scale);
      return position;
    };

    placeCard(0);
    await this.reach(side, this.grip(source));

    const duration = mode === 'move' ? 550 : mode === 'discard' ? 205 : 300;
    await this.tween(duration, t => {
      this.pose(side, this.grip(placeCard(t)));
    });

    face.remove();
    back.remove();

    if (mode !== 'discard') this.show(card);
  }

async shuffleShoe(shoe: HTMLElement) {
    const target = this.measure(shoe);
    const center = {
      x: this.felt.clientWidth / 2,
      y: Math.min(110, this.felt.clientHeight * 0.28),
    };

    const spread = Math.min(64, this.felt.clientWidth * 0.14);
    const size = { ...center, width: 42, height: 59 };

    // Eight visible backs represent the two packets being shuffled.
    const cards = Array.from({ length: 8 }, () =>
      this.ghost(this.back(), size),
    );

    const drawPackets = (gap: number, ripple: number) => {
      cards.forEach((card, index) => {
        const direction = index % 2 === 0 ? -1 : 1;
        const progress = Math.max(0, Math.min(1, ripple * 2 - index / 7));
        const lift = Math.sin(Math.PI * progress);

        this.place(
          card,
          {
            x: center.x + direction * gap,
            y: center.y - index * 1.4 - lift * 8,
          },
          direction * gap / 6,
          direction * lift * 16,
        );
      });

      this.pose('left', this.grip({
        x: center.x - gap - 10,
        y: center.y,
      }));

      this.pose('right', this.grip({
        x: center.x + gap + 10,
        y: center.y,
      }));
    };

    try {
      cards.forEach((card, index) => {
        this.place(card, { x: center.x, y: center.y - index * 1.4 });
      });

      // Both hands reach for the stack, separate it, and riffle it together.
      await Promise.all([
        this.reach('left', this.grip({ x: center.x - 10, y: center.y })),
        this.reach('right', this.grip({ x: center.x + 10, y: center.y })),
      ]);

      await this.tween(330, t => drawPackets(spread * t, 0));
      await this.tween(600, t => drawPackets(spread * (1 - t), t));

      // The right hand loads the shuffled cards into the shoe.
      await Promise.all([
        this.reach('left', this.home('left'), 300),
        this.tween(430, t => {
          const position = {
            x: center.x + (target.x - center.x) * t,
            y: center.y + (target.y - center.y) * t,
          };

          cards.forEach((card, index) => {
            this.place(
              card,
              {
                x: position.x,
                y: position.y - index * 1.4 * (1 - t),
              },
              20 * t,
              0,
              1 - 0.5 * t,
            );
          });

          this.pose('right', this.grip(position));
        }),
      ]);
    } finally {
      cards.forEach(card => card.remove());
    }
    }


  async peek(card: HTMLElement) {
    const spot = this.measure(card);
    const grip = { x: spot.x - 14, y: spot.y - 32 };
    await this.reach('left', grip);

    // Only the back is used during the peek.
    const back = this.ghost(this.back(), spot);
    this.place(back, spot);
    this.hide(card);

    await this.tween(540, t => {
      const lift = Math.sin(Math.PI * t);
      this.place(
        back,
        { x: spot.x - 2 * lift, y: spot.y - 4 * lift },
        -4 * lift,
        27 * lift,
      );
      this.pose('left', {
        x: grip.x - 2 * lift,
        y: grip.y - 4 * lift,
      });
    });

    back.remove();
    this.show(card);
    await this.reach('left', this.home('left'));
  }

  async reveal(card: HTMLElement, turnFaceUp: () => HTMLElement) {
    const spot = this.measure(card);
    await this.reach('left', this.grip(spot));

    const back = this.ghost(this.back(), spot);
    this.place(back, spot);
    this.hide(card);

    // Swap to the real face when the card is edge-on.
    await this.tween(150, t => this.place(back, spot, 0, t * 90));

    const target = turnFaceUp();
    this.hide(target);
    const front = this.ghost(target, spot);
    this.place(front, spot, 0, -90);
    back.remove();

    await this.tween(150, t => this.place(front, spot, 0, -90 + t * 90));

    front.remove();
    this.show(target);
  }

  async rest() {
    await Promise.all([
      this.reach('left', this.home('left')),
      this.reach('right', this.home('right')),
    ]);
  }

  close() {
    for (const card of this.hidden) {
      card.classList.remove('dealer-card-hidden');
    }
    this.layer.remove();
  }
}