/**
 * Инициализация интерактивных блоков: двухслойной карусели и слайдера до/после.
 * Скрипт подключён с атрибутом `defer`, поэтому DOM уже готов к моменту выполнения кода.
 */

(() => {
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  class CarouselLine {
    constructor(lineElement, options) {
      this.line = lineElement;
      this.track = this.line.querySelector(".carousel-track");
      if (!this.track) {
        this.isActive = false;
        return;
      }

      this.direction = Number(this.line.dataset.direction) || -1;
      this.speed = options.speed;
      this.stepSize = options.stepSize;
      this.paused = false;
      this.offset = 0;
      this.lastTimestamp = null;
      this.frameId = null;
      this.isActive = true;

      const initialWidth = this.track.scrollWidth;
      const items = Array.from(this.track.children);

      if (!items.length || initialWidth === 0) {
        this.isActive = false;
        return;
      }

      this.loopWidth = initialWidth;
      this._buildInfiniteTrack(items);
      this.offset = 0;
      this._render();

      this.frameId = requestAnimationFrame((timestamp) => this._tick(timestamp));
    }

    setOffset(newOffset, { wrap = true } = {}) {
      if (!this.isActive) return;
      this.offset = newOffset;
      if (wrap) {
        this._wrapOffset();
      }
      this._render();
    }

    getOffset() {
      return this.offset;
    }

    _buildInfiniteTrack(items) {
      const fragment = document.createDocumentFragment();
      const copies = 3;

      for (let copyIndex = 0; copyIndex < copies; copyIndex += 1) {
        items.forEach((item) => {
          const node =
            copyIndex === 1 ? item : item.cloneNode(true);

          if (copyIndex !== 1) {
            node.setAttribute("aria-hidden", "true");
            node.querySelectorAll("img").forEach((img) => {
              img.loading = "eager";
            });
          } else {
            node.removeAttribute?.("aria-hidden");
          }

          fragment.appendChild(node);
        });
      }

      this.track.textContent = "";
      this.track.appendChild(fragment);
    }

    _tick(timestamp) {
      if (this.paused || !this.isActive) {
        this.lastTimestamp = timestamp;
        this.frameId = requestAnimationFrame((ts) => this._tick(ts));
        return;
      }

      if (this.lastTimestamp == null) {
        this.lastTimestamp = timestamp;
      }

      const delta = timestamp - this.lastTimestamp;
      this.lastTimestamp = timestamp;
      const distance = (this.speed * delta) / 1000;

      this.offset += this.direction > 0 ? distance : -distance;
      this._wrapOffset();
      this._render();

      this.frameId = requestAnimationFrame((ts) => this._tick(ts));
    }

    _wrapOffset() {
      if (!this.isActive) return;

      const width = this.loopWidth;
      if (!width) return;

      this.offset = ((this.offset % width) + width) % width;
    }

    _render() {
      if (!this.isActive) return;
      const translateX = -(this.loopWidth + this.offset);
      this.track.style.transform = `translateX(${translateX}px)`;
    }

    setPaused(state) {
      if (!this.isActive) return;
      this.paused = state;
      if (!state) {
        this.lastTimestamp = performance.now();
      }
    }

    nudge(direction) {
      if (!this.isActive) return;
      this.offset -= direction * this.stepSize;
      this._wrapOffset();
      this._render();
    }
  }

  function initDualCarousel() {
    const carousel = document.querySelector(".dual-carousel");
    if (!carousel) return;

    const track = carousel.querySelector(".carousel-track");
    const card = carousel.querySelector(".carousel-card");
    const computedTrack = track ? window.getComputedStyle(track) : null;
    const gap =
      computedTrack && computedTrack.gap
        ? Number.parseFloat(computedTrack.gap)
        : 24;
    const cardWidth = card ? card.getBoundingClientRect().width : 240;

    const options = {
      speed: Number(carousel.dataset.speed) || 45,
      stepSize: cardWidth + gap,
    };

    const lines = Array.from(carousel.querySelectorAll(".carousel-line"))
      .map((line) => new CarouselLine(line, options))
      .filter((instance) => instance.isActive);

    if (!lines.length) return;

    lines.forEach((lineInstance) => {
      const lineElement = lineInstance.line;
      let isHovered = false;
      let isPointerDown = false;
      let activePointerId = null;
      let dragStartX = 0;
      let dragStartOffset = 0;

      const endDrag = () => {
        if (!isPointerDown) return;
        isPointerDown = false;
        carousel.classList.remove("is-dragging");
        if (
          activePointerId !== null &&
          typeof lineElement.hasPointerCapture === "function" &&
          lineElement.hasPointerCapture(activePointerId)
        ) {
          lineElement.releasePointerCapture(activePointerId);
        }
        activePointerId = null;
        if (!isHovered) {
          lineInstance.setPaused(false);
        }
      };

      lineElement.addEventListener("mouseenter", () => {
        isHovered = true;
        lineInstance.setPaused(true);
      });

      lineElement.addEventListener("mouseleave", () => {
        isHovered = false;
        if (!isPointerDown) {
          lineInstance.setPaused(false);
        }
      });

      lineElement.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        isPointerDown = true;
        activePointerId = event.pointerId;
        dragStartX = event.clientX;
        dragStartOffset = lineInstance.getOffset();
        lineInstance.setPaused(true);
        carousel.classList.add("is-dragging");
        lineElement.setPointerCapture?.(event.pointerId);
        event.preventDefault();
      });

      lineElement.addEventListener("pointermove", (event) => {
        if (!isPointerDown || event.pointerId !== activePointerId) return;
        const delta = event.clientX - dragStartX;
        lineInstance.setOffset(dragStartOffset - delta, { wrap: true });
      });

      const pointerEndHandler = (event) => {
        if (event.pointerId !== activePointerId) return;
        endDrag();
      };

      lineElement.addEventListener("pointerup", pointerEndHandler);
      lineElement.addEventListener("pointercancel", pointerEndHandler);
      lineElement.addEventListener("lostpointercapture", endDrag);
      lineElement.addEventListener("pointerleave", (event) => {
        if (isPointerDown && event.pointerId === activePointerId) {
          endDrag();
        }
      });
    });
  }

  function initComparisonSliders() {
    const comparisonBlocks = document.querySelectorAll(".comparison");

    comparisonBlocks.forEach((block) => {
      const slider = block.querySelector(".comparison__slider");
      if (!slider) return;

      const defaultValue = Number(block.dataset.default);
      const setPosition = (value) => {
        const safeValue = clamp(Number(value), 0, 100);
        const cssValue = `${safeValue}%`;
        block.style.setProperty("--comparison-position", cssValue);
        slider.value = String(safeValue);
      };

      if (!Number.isNaN(defaultValue)) {
        setPosition(defaultValue);
      } else {
        setPosition(slider.value);
      }

      slider.addEventListener("input", (event) => {
        setPosition(event.target.value);
      });

      slider.addEventListener("pointerdown", () => block.classList.add("is-dragging"));
      slider.addEventListener("pointerup", () => block.classList.remove("is-dragging"));
      slider.addEventListener("pointercancel", () =>
        block.classList.remove("is-dragging")
      );
      slider.addEventListener("blur", () => block.classList.remove("is-dragging"));
    });
  }

  function init() {
    initDualCarousel();
    initComparisonSliders();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
