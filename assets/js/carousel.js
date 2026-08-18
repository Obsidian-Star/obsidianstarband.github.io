(function () {
  const carousel = document.getElementById('photo-carousel');
  if (!carousel) return;

  const track = carousel.querySelector('.carousel-track');
  const dots = carousel.querySelector('.carousel-dots');
  const previous = carousel.querySelector('.previous');
  const next = carousel.querySelector('.next');
  let currentIndex = 0;
  let autoPlayTimer;

  fetch('data/index.json', { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error('Could not load carousel photos');
      return response.json();
    })
    .then(data => {
      const photos = Array.isArray(data.photos) ? data.photos : [];
      if (photos.length === 0) {
        carousel.hidden = true;
        return;
      }

      photos.forEach((photo, index) => {
        const slide = document.createElement('div');
        slide.className = 'carousel-slide';
        const image = document.createElement('img');
        image.src = photo.src;
        image.alt = photo.alt || 'Band photo';
        slide.appendChild(image);
        track.appendChild(slide);

        const dot = document.createElement('button');
        dot.className = 'carousel-dot';
        dot.type = 'button';
        dot.setAttribute('aria-label', 'Show photo ' + (index + 1));
        dot.addEventListener('click', () => showPhoto(index));
        dots.appendChild(dot);
      });

      function showPhoto(index) {
        currentIndex = (index + photos.length) % photos.length;
        track.style.transform = 'translateX(-' + (currentIndex * 100) + '%)';
        dots.querySelectorAll('.carousel-dot').forEach((dot, dotIndex) => {
          dot.classList.toggle('active', dotIndex === currentIndex);
        });
      }

      function startAutoPlay() {
        clearInterval(autoPlayTimer);
        if (photos.length > 1) {
          autoPlayTimer = setInterval(() => showPhoto(currentIndex + 1), 5000);
        }
      }

      function stopAutoPlay() {
        clearInterval(autoPlayTimer);
      }

      function showPhotoAndRestart(index) {
        showPhoto(index);
        startAutoPlay();
      }

      previous.addEventListener('click', () => showPhotoAndRestart(currentIndex - 1));
      next.addEventListener('click', () => showPhotoAndRestart(currentIndex + 1));
      dots.addEventListener('click', event => {
        if (event.target.classList.contains('carousel-dot')) startAutoPlay();
      });
      carousel.addEventListener('mouseenter', stopAutoPlay);
      carousel.addEventListener('mouseleave', startAutoPlay);
      carousel.addEventListener('focusin', stopAutoPlay);
      carousel.addEventListener('focusout', event => {
        if (!carousel.contains(event.relatedTarget)) startAutoPlay();
      });
      showPhoto(0);
      startAutoPlay();
    })
    .catch(error => console.error(error));
})();