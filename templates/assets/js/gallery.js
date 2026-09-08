// Gallery Application Logic

async function initGallery(configPath) {
  try {
    // 1. Fetch Nav Data and Render Navigation
    await renderNavigation(configPath);

    // 3. Trigger Header Animations
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
    }, 100);

    // 4. Trigger Grid Animations
    const gridContainer = document.getElementById("gallery-grid");
    if (gridContainer) {
      gridContainer.classList.remove("opacity-0");
    }

    // 5. Initialize PhotoSwipe
    initPhotoSwipe();

    // 6. Init Navbar Scroll Effect
    initNavbarEffect();
  } catch (error) {
    console.error("Error loading gallery:", error);
    // 非破坏性降级：构建期已静态渲染的画廊仍可浏览，仅在顶部提示数据加载失败
    const banner = document.createElement("div");
    banner.setAttribute("role", "alert");
    // 内联样式：此文件被 Tailwind 扫描，新增 class 字符串会改变产物 CSS
    banner.style.cssText =
      "position:fixed;top:0;left:0;right:0;z-index:9999;padding:10px 16px;text-align:center;background:#7f1d1d;color:#fff;font-size:13px;";
    banner.textContent = "部分画廊数据加载失败，请刷新重试。";
    document.body.insertAdjacentElement("afterbegin", banner);
  }
}

async function renderNavigation(configPath) {
  try {
    const response = await fetch(configPath || "/config/nav.json");
    const navItems = await response.json();
    const mobileNavLinksContainer = document.getElementById("mobile-nav-links");

    if (!mobileNavLinksContainer) return;

    // Clear existing
    mobileNavLinksContainer.innerHTML = "";

    // Get current album id from URL to set active state.
    // pathname 形如 /photography/<album-id>/...；相册索引页（/photography/）无 id，不高亮任何项
    const pathSegments = window.location.pathname.split("/").filter(Boolean);
    const photographyIdx = pathSegments.indexOf("photography");
    const currentAlbumId =
      photographyIdx !== -1 && pathSegments[photographyIdx + 1]
        ? pathSegments[photographyIdx + 1]
        : null;

    navItems.forEach((item) => {
      // nav.json 的 link 形如 ../<album-id>/，提取目标相册 id 与当前 id 比较
      const itemAlbumId = item.link.split("/").filter(Boolean).pop() || null;
      const isActive =
        currentAlbumId !== null && itemAlbumId === currentAlbumId;

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

function initPhotoSwipe() {
  const galleryGrid = document.querySelector("#gallery-grid");
  if (!galleryGrid) return;

  const lightbox = new PhotoSwipeLightbox({
    gallery: "#gallery-grid",
    children: "a",
    pswpModule: PhotoSwipe,
    // Optimize animation and transition
    // showHideOpacity: true, // Fade opacity for smoother transition
    // showAnimationDuration: 500, // Slightly slower animation
    // hideAnimationDuration: 400,
    bgOpacity: 1, // Darker background
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
            const elAttr = (name) => currSlide.data.element.getAttribute(name);

            const author = elAttr("data-author");
            const title = elAttr("data-title");
            const exif = {
              model: elAttr("data-exif-model"),
              date: elAttr("data-exif-date"),
              shutter: elAttr("data-exif-shutter"),
              aperture: elAttr("data-exif-aperture"),
              iso: elAttr("data-exif-iso"),
              focalLength: elAttr("data-exif-focallength"),
            };

            const hasExif = Object.values(exif).some((v) => v);

            let html =
              '<div class="absolute bottom-0 left-0 right-0 p-6 pointer-events-none flex flex-col items-center justify-end bg-gradient-to-t from-black/80 to-transparent pt-20">';

            // Title - Separate Line, slightly larger
            if (title) {
              html += `<h3 class="text-white text-lg md:text-xl font-medium mb-3 tracking-wide drop-shadow-md opacity-90">${title}</h3>`;
            }

            // Info Row - Low key, combined EXIF and Author
            if (hasExif || author) {
              html += `<div class="flex flex-wrap justify-center items-center gap-x-3 gap-y-1 text-white/50 text-[10px] md:text-xs font-light font-sans tracking-wider">`;

              if (author) {
                html += `<span class="opacity-70">© ${author}</span>`;
                if (hasExif) html += `<span class="opacity-30">|</span>`;
              }

              if (exif.model) html += `<span>${exif.model}</span>`;
              if (exif.focalLength) html += `<span>${exif.focalLength}</span>`;
              if (exif.aperture) html += `<span>${exif.aperture}</span>`;
              if (exif.shutter) html += `<span>${exif.shutter}s</span>`;
              if (exif.iso) html += `<span>${exif.iso}</span>`;
              if (exif.date)
                html += `<span class="opacity-60">${exif.date}</span>`;

              html += `</div>`;
            }

            html += "</div>";
            el.innerHTML = html;
          }
        });
      },
    });
  });

  lightbox.init();
}

function initNavbarEffect() {
  const navbar = document.getElementById("navbar");
  if (!navbar) return;
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
        "text-gray-900",
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
        "text-gray-900",
      );
      navbar.classList.add("text-white");

      if (menuBtn) {
        menuBtn.classList.add("text-white", "hover:bg-white/10");
        menuBtn.classList.remove("text-gray-900", "hover:bg-black/5");
      }
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initGallery();
});
