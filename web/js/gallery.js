// Gallery Application Logic

async function initGallery(dataPath) {
  try {
    // 1. Fetch Nav Data and Render Navigation
    await renderNavigation();

    // 2. Fetch Album Data
    const response = await fetch(dataPath);
    const albumData = await response.json();

    // 3. Render Header (if not already rendered by SSR)
    const titleEl = document.getElementById("album-title");
    if (!titleEl.textContent.trim()) {
      renderHeader(albumData);
    } else {
      // Trigger animations even if SSR rendered
      requestAnimationFrame(() => {
        const heroBg = document.getElementById("hero-bg");
        if (heroBg) {
          heroBg.classList.remove("opacity-0");
          heroBg.classList.remove("scale-105");
          heroBg.classList.add("scale-100");
        }
      });
      setTimeout(() => {
        const title = document.getElementById("album-title");
        const desc = document.getElementById("album-desc");
        if (title) title.classList.remove("translate-y-8", "opacity-0");
        if (desc) desc.classList.remove("translate-y-8", "opacity-0");

        // Author logic might need check if exists, but for now simple animation trigger
      }, 100);
    }

    // 4. Render Grid (if not already rendered by SSR)
    const gridContainer = document.getElementById("gallery-grid");
    if (!gridContainer.children.length) {
      renderGrid(albumData);
    } else {
      // Trigger animation for grid
      gridContainer.classList.remove("opacity-0");
    }

    // 5. Initialize PhotoSwipe
    initPhotoSwipe();

    // 6. Init Navbar Scroll Effect
    initNavbarEffect();

    // 7. Render Footer
    renderFooter(albumData);
  } catch (error) {
    console.error("Error loading gallery:", error);
    document.body.innerHTML =
      '<div class="text-center py-20">Error loading gallery data.</div>';
  }
}

async function renderNavigation() {
  try {
    const response = await fetch("config/nav.json");
    const navItems = await response.json();
    const mobileNavLinksContainer = document.getElementById("mobile-nav-links");

    if (!mobileNavLinksContainer) return;

    // Clear existing
    mobileNavLinksContainer.innerHTML = "";

    // Get current filename to set active state
    const currentPath = window.location.pathname;
    const currentFile =
      currentPath.substring(currentPath.lastIndexOf("/") + 1) || "nature.html";

    navItems.forEach((item) => {
      let isActive = false;
      if (item.link === currentFile) isActive = true;
      if (
        item.link === "nature.html" &&
        (currentFile === "" || currentFile === "index.html")
      )
        isActive = true;

      const link = document.createElement("a");
      link.href = item.link;
      link.className = `group flex items-center justify-between py-4 px-6 rounded-2xl transition-all duration-500 ${
        isActive
          ? "bg-white/10 text-white translate-x-2"
          : "text-white/50 hover:text-white hover:bg-white/5 hover:translate-x-1"
      }`;

      link.innerHTML = `
        <span class="text-sm md:text-base font-bold tracking-tight break-words pr-4">${
          item.title
        }</span>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transform transition-transform duration-500 ${
          isActive
            ? "opacity-100 translate-x-0"
            : "opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0"
        }" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
      `;

      mobileNavLinksContainer.appendChild(link);
    });

    // Mobile Menu Interaction
    const menuBtn = document.getElementById("mobile-menu-btn");
    const closeBtn = document.getElementById("close-menu-btn");
    const mobileMenu = document.getElementById("mobile-menu");
    const menuBackdrop = document.getElementById("menu-backdrop");
    const menuPanel = document.getElementById("menu-panel");

    if (menuBtn && closeBtn && mobileMenu && menuPanel) {
      const openMenu = () => {
        mobileMenu.classList.remove("pointer-events-none");
        if (menuBackdrop) menuBackdrop.classList.remove("opacity-0");
        menuPanel.classList.remove("translate-x-full");
        document.body.style.overflow = "hidden";
      };

      const closeMenu = () => {
        mobileMenu.classList.add("pointer-events-none");
        if (menuBackdrop) menuBackdrop.classList.add("opacity-0");
        menuPanel.classList.add("translate-x-full");
        document.body.style.overflow = "";
      };

      menuBtn.addEventListener("click", openMenu);
      closeBtn.addEventListener("click", closeMenu);
      if (menuBackdrop) menuBackdrop.addEventListener("click", closeMenu);
    }
  } catch (error) {
    console.error("Error loading navigation:", error);
  }
}

function renderHeader(data) {
  document.title = `${data.title} - Gallery`;
  document.getElementById("album-title").textContent = data.title;

  const descEl = document.getElementById("album-desc");
  if (Array.isArray(data.description)) {
    descEl.innerHTML = data.description
      .map((line) => `<p class="block">${line}</p>`)
      .join("");
  } else {
    descEl.textContent = data.description;
  }

  const heroBg = document.getElementById("hero-bg");
  if (data.cover) {
    heroBg.style.backgroundImage = `url('${data.cover}')`;
    // Trigger animation
    requestAnimationFrame(() => {
      heroBg.classList.remove("opacity-0");
      heroBg.classList.remove("scale-105");
      heroBg.classList.add("scale-100");
    });
  }

  // Animate text in
  setTimeout(() => {
    const title = document.getElementById("album-title");
    const desc = document.getElementById("album-desc");
    title.classList.remove("translate-y-8", "opacity-0");
    desc.classList.remove("translate-y-8", "opacity-0");

    // Render Album Author if exists
    if (data.author) {
      const metaDiv = document.createElement("div");
      metaDiv.className =
        "mt-4 flex items-center text-white/80 translate-y-8 opacity-0 transition-all duration-700 delay-500";
      metaDiv.innerHTML = `
        <span class="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium">
            © ${data.author}
        </span>
      `;
      desc.parentNode.appendChild(metaDiv);

      requestAnimationFrame(() => {
        metaDiv.classList.remove("translate-y-8", "opacity-0");
      });
    }
  }, 100);
}

function renderGrid(data) {
  const gridContainer = document.getElementById("gallery-grid");
  let html = "";

  data.images.forEach((img) => {
    html += `
            <a href="${img.src}" 
               data-pswp-width="${img.width}" 
               data-pswp-height="${img.height}" 
               data-author="${img.author || ""}"
               target="_blank"
               class="relative block mb-4 break-inside-avoid group overflow-hidden rounded-lg shadow-sm hover:shadow-xl transition-shadow duration-300">
                <img src="${img.thumbnail || img.src}" 
                     alt="${img.alt || ""}" 
                     class="w-full h-auto object-contain transition-transform duration-700 group-hover:scale-105"
                     loading="lazy" />
                <div class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300"></div>
                ${
                  img.author
                    ? `
                <div class="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <p class="text-white text-xs font-medium tracking-wide truncate">© ${img.author}</p>
                </div>
                `
                    : ""
                }
            </a>
        `;
  });

  gridContainer.innerHTML = html;
  document.getElementById("gallery-grid").classList.remove("opacity-0");
}

function renderFooter(data) {
  // Only create footer if it doesn't exist
  if (document.querySelector("footer")) return;

  const footer = document.createElement("footer");
  footer.className = "py-12 bg-white text-center";
  footer.innerHTML = `
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <p class="text-gray-500 text-sm">
                © ${new Date().getFullYear()} ${
    data.author
  }. All rights reserved.
            </p>
            <p class="text-gray-500 text-sm">Powered by <a href="https://github.com/fankangsong/static-gallary-generator" target="_blank" class="text-blue-600 hover:underline">static-gallary-generator</a>
        </div>
    `;
  document.querySelector("main").appendChild(footer);
}

function initPhotoSwipe() {
  const lightbox = new PhotoSwipeLightbox({
    gallery: "#gallery-grid",
    children: "a",
    pswpModule: PhotoSwipe,
    // Optimize animation and transition
    // showHideOpacity: true, // Fade opacity for smoother transition
    // showAnimationDuration: 500, // Slightly slower animation
    // hideAnimationDuration: 400,
    // bgOpacity: 0.92, // Darker background
    // wheelToZoom: true, // Enable mouse wheel zoom
    // // Improve closing behavior
    // closeOnVerticalDrag: true,
    // // Add padding to avoid edge sticking
    // padding: { top: 20, bottom: 20, left: 20, right: 20 },
  });

  lightbox.on("uiRegister", function () {
    lightbox.pswp.ui.registerElement({
      name: "custom-caption",
      order: 9,
      isButton: false,
      appendTo: "root",
      onInit: (el, pswp) => {
        lightbox.pswp.on("change", () => {
          const currSlide = lightbox.pswp.currSlide;
          if (currSlide && currSlide.data && currSlide.data.element) {
            const author = currSlide.data.element.getAttribute("data-author");
            if (author) {
              el.innerHTML = `
                <div class="absolute bottom-6 left-0 right-0 text-center pointer-events-none">
                  <span class="inline-block bg-black/50 backdrop-blur-md text-white/90 px-4 py-2 rounded-full text-sm font-medium shadow-lg">
                    © ${author}
                  </span>
                </div>
              `;
            } else {
              el.innerHTML = "";
            }
          }
        });
      },
    });
  });

  lightbox.init();
}

function initNavbarEffect() {
  const navbar = document.getElementById("navbar");
  const menuBtn = document.getElementById("mobile-menu-btn");

  // Initial check
  updateNavbar();

  window.addEventListener("scroll", updateNavbar);

  function updateNavbar() {
    if (window.scrollY > 50) {
      navbar.classList.add(
        "bg-white/90",
        "backdrop-blur-md",
        "shadow-sm",
        "text-gray-900"
      );
      navbar.classList.remove("text-white");

      if (menuBtn) {
        menuBtn.classList.remove("text-white", "hover:bg-white/10");
        menuBtn.classList.add("text-gray-900", "hover:bg-black/5");
      }
    } else {
      navbar.classList.remove(
        "bg-white/90",
        "backdrop-blur-md",
        "shadow-sm",
        "text-gray-900"
      );
      navbar.classList.add("text-white");

      if (menuBtn) {
        menuBtn.classList.add("text-white", "hover:bg-white/10");
        menuBtn.classList.remove("text-gray-900", "hover:bg-black/5");
      }
    }
  }
}
