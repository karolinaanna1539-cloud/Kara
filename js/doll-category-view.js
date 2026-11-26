
/* =====================================================
   THE DEN
   DOLL DETAILS — INTERACTIVE DASHBOARD
   BODY MEASUREMENTS UPDATE
===================================================== */

(function () {

    "use strict";

    const profileContent =
        document.getElementById("profileContent");

    if (!profileContent) return;

    const $ = id => document.getElementById(id);

    /* =================================================
       CATEGORY CONFIGURATION
    ================================================= */

    const categories = [

        {
            id: "personal",
            title: "PERSONAL DATA",
            description: "Identity & background",
            icon: "user"
        },

        {
            id: "physical",
            title: "APPEARANCE",
            description: "Physical characteristics",
            icon: "appearance"
        },

        {
            id: "measurements",
            title: "BODY MEASUREMENTS",
            description: "Interactive mannequin & body dimensions",
            icon: "ruler"
        },

        {
            id: "medical",
            title: "PHYSICAL REPORT",
            description: "Measurements & condition",
            icon: "medical"
        },

        {
            id: "clothing",
            title: "CLOTHING",
            description: "Available outfits",
            icon: "shirt"
        },

        {
            id: "makeup",
            title: "MAKE-UP",
            description: "Cosmetics & styling",
            icon: "brush"
        },

        {
            id: "hairstyle",
            title: "HAIRSTYLE",
            description: "Hair styling options",
            icon: "scissors"
        },

        {
            id: "nails",
            title: "NAILS",
            description: "Manicure & nail styling",
            icon: "nails"
        },

              {
            id: "accessories",
            title: "ACCESSORIES",
            description: "Additional accessories",
            icon: "gem"
        },
        {
            id: "kinks",
            title: "KINK LIST",
            description: "Preferences & individual galleries",
            icon: "history"
        },

        {
            id: "gallery",
            title: "GALLERY",
            description: "General photo collection",
            icon: "gallery"
        },

        {
            id: "history",
            title: "ARCHIVE HISTORY",
            description: "Historical records",
            icon: "history"
        }

    ];

    let activeCategory = null;

    const buttons = new Map();
    const sections = new Map();

    /* =================================================
       ICONS
    ================================================= */

    const icons = {

        user: `
            <circle cx="12" cy="7" r="4"/>
            <path d="M4 22v-3a8 8 0 0 1 16 0v3"/>
        `,

        appearance: `
            <circle cx="12" cy="5" r="3"/>
            <path d="M8 10h8l3 6"/>
            <path d="M8 10l-3 6"/>
            <path d="M9 10v6l-2 6"/>
            <path d="M15 10v6l2 6"/>
            <path d="M9 16h6"/>
        `,

        ruler: `
            <rect x="2" y="7" width="20" height="10" rx="2"/>
            <path d="M6 7v5M10 7v3M14 7v5M18 7v3"/>
        `,

        medical: `
            <rect x="5" y="4" width="14" height="18" rx="2"/>
            <rect x="9" y="2" width="6" height="4" rx="1"/>
            <path d="M12 9v8"/>
            <path d="M8 13h8"/>
        `,

        shirt: `
            <path d="M8 3L3 6 1 11 6 13v8h12v-8l5-2-2-5-5-3"/>
            <path d="M8 3a4 4 0 0 0 8 0"/>
        `,

        brush: `
            <path d="M14 6l4-4 4 4-4 4"/>
            <path d="M14 6l-7 7 4 4 7-7"/>
            <path d="M7 13C2 13 5 19 1 21C7 23 11 20 11 17"/>
        `,

        scissors: `
            <circle cx="6" cy="6" r="3"/>
            <circle cx="6" cy="18" r="3"/>
            <path d="M8 8l13 13"/>
            <path d="M8 16L21 3"/>
        `,

        nails: `
            <path d="M8 21V8a4 4 0 0 1 8 0v13z"/>
            <path d="M8 12h8"/>
        `,

        gem: `
            <path d="M3 8l4-5h10l4 5-9 13z"/>
            <path d="M3 8h18"/>
            <path d="M7 3l5 18 5-18"/>
        `,

        gallery: `
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8" cy="8" r="2"/>
            <path d="M3 18l6-6 4 4 4-5 4 5"/>
        `,

        history: `
            <circle cx="12" cy="12" r="9"/>
            <path d="M12 6v6l4 3"/>
        `,

        settings: `
            <circle cx="12" cy="12" r="4"/>
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
            <path d="M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3"/>
        `,

        chevron: `
            <path d="M6 9l6 6 6-6"/>
        `

    };

    function createIcon(name) {

        const wrapper = document.createElement("span");

        wrapper.className = "dashboard-icon";
        wrapper.setAttribute("aria-hidden", "true");

        wrapper.innerHTML = `
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                ${icons[name] || icons.user}
            </svg>
        `;

        return wrapper;

    }

    /* =================================================
       DASHBOARD STYLES
    ================================================= */

    const style = document.createElement("style");

    style.textContent = `

        #profileContent[hidden],
        #profileContent [hidden] {
            display: none !important;
        }

        .profile-hero {
            grid-template-columns:
                minmax(240px, 360px) minmax(0, 1fr);
            gap: 35px;
            padding: 24px;
            border: 1px solid #294332;
            border-radius: 6px;
            background: linear-gradient(
                145deg,
                #0c1810,
                #050a07 75%
            );
        }

        .profile-main-image {
            overflow: hidden;
            border-radius: 4px;
            background: #020503;
        }

        .profile-main-image img {
            height: 420px;
            object-fit: contain;
        }

        .profile-identity h2 {
            font-size: 34px;
            margin: 12px 0;
        }

        .dashboard-reserve {
            display: block;
            width: 100%;
            box-sizing: border-box;
            max-width: 340px;
            margin-top: 22px;
            padding: 16px;
            text-align: center;
            text-decoration: none;
            color: #00150c;
            background: var(--green, #00df80);
            border: 1px solid var(--green, #00df80);
            border-radius: 3px;
            font-size: 12px;
            font-weight: bold;
            letter-spacing: 1.5px;
            transition: background .2s, box-shadow .2s;
        }

        .dashboard-reserve:hover {
            background: #b0ffd3;
            color: #00150c;
            box-shadow: 0 0 20px rgba(0,255,136,.2);
        }

        .dashboard-heading {
            margin: 35px 0 18px;
        }

        .dashboard-heading h3 {
            color: white;
            letter-spacing: 3px;
            margin: 8px 0;
        }

        .dashboard-heading p {
            color: #83a58e;
            font-size: 11px;
            line-height: 1.6;
        }

        .dashboard-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
        }

        .dashboard-tile {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
            min-width: 0;
            min-height: 145px;
            padding: 18px;
            box-sizing: border-box;
            background: linear-gradient(
                145deg,
                #0d1b12,
                #07100a
            );
            border: 1px solid #294332;
            border-radius: 5px;
            color: white;
            font-family: inherit;
            text-align: left;
            cursor: pointer;
            transition:
                border-color .2s,
                background .2s,
                transform .2s,
                box-shadow .2s;
        }

        .dashboard-tile:hover {
            border-color: var(--green, #00df80);
            transform: translateY(-2px);
            box-shadow: 0 0 16px rgba(0,255,136,.07);
        }

        .dashboard-tile.is-active {
            background: #14291c;
            border-color: var(--green, #00df80);
            box-shadow: 0 0 15px rgba(0,255,136,.1);
        }

        .dashboard-tile:focus-visible,
        .dashboard-reserve:focus-visible,
        .dashboard-admin-toggle:focus-visible {
            outline: 2px solid white;
            outline-offset: 3px;
        }

        .dashboard-tile-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
        }

        .dashboard-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: var(--green, #00df80);
        }

        .dashboard-icon svg {
            width: 27px;
            height: 27px;
        }

        .dashboard-arrow {
            transition: transform .25s;
        }

        .dashboard-arrow svg {
            width: 16px;
            height: 16px;
        }

        .dashboard-tile.is-active .dashboard-arrow {
            transform: rotate(180deg);
        }

        .dashboard-tile-title {
            font-size: 12px;
            font-weight: bold;
            letter-spacing: 1.5px;
            overflow-wrap: anywhere;
        }

        .dashboard-tile-description {
            color: #8da898;
            font-size: 11px;
            line-height: 1.5;
        }

        .dashboard-panels {
            margin-top: 20px;
        }

        .dashboard-panels .profile-section {
            margin: 0 0 20px;
            min-height: 0;
            border: 1px solid #345443;
            border-radius: 5px;
            background: #08110b;
        }

        .dashboard-panels .profile-section.is-open {
            animation: dashboardReveal .3s ease both;
        }

        @keyframes dashboardReveal {

            from {
                opacity: 0;
                transform: translateY(-8px);
            }

            to {
                opacity: 1;
                transform: translateY(0);
            }

        }

        .dashboard-panels .category-back-button {
            margin-bottom: 20px;
        }

        .dashboard-panels .doll-gallery {
            grid-template-columns:
                repeat(3, minmax(0, 1fr));
            gap: 15px;
        }

        .dashboard-panels .gallery-item {
            padding: 10px;
            border-radius: 4px;
        }

        .dashboard-panels .gallery-item img {
            height: 260px;
        }

        /* BODY MEASUREMENTS */

        #measurements {
            min-width: 0;
        }

        #measurements .body-measurements {
            margin: 0;
        }

        /* PHYSICAL REPORT */

        #medical {
            background: #09130f;
        }

        .clinical-report-header {
            display: flex;
            align-items: center;
            gap: 15px;
            padding: 18px;
            margin-bottom: 20px;
            background: #10231a;
            border: 1px solid #365747;
            border-left: 3px solid #75c9a0;
            border-radius: 3px;
        }

        .clinical-report-header .dashboard-icon svg {
            width: 34px;
            height: 34px;
            color: #92d8b1;
        }

        .clinical-report-header strong {
            display: block;
            color: #d7eee0;
            font-size: 15px;
            letter-spacing: 2px;
        }

        .clinical-report-header small {
            display: block;
            color: #8eae9b;
            font-size: 10px;
            margin-top: 6px;
            letter-spacing: 1px;
        }

        .clinical-heading {
            color: #91c5a6;
            font-size: 11px;
            letter-spacing: 2px;
            margin: 25px 0 12px;
            padding-bottom: 10px;
            border-bottom: 1px solid #345443;
        }

        #medical .profile-data-item {
            background: #0c1b13;
            border: 1px solid #2b4636;
            border-radius: 3px;
        }

        #medical .profile-data-label {
            color: #91c5a6;
        }

        .clinical-note {
            color: #7e9a89;
            font-size: 10px;
            line-height: 1.7;
            margin-top: 25px;
            letter-spacing: .5px;
        }

        /* ADMINISTRATION */

        .dashboard-admin-toggle {
            display: flex;
            align-items: center;
            gap: 12px;
            width: 100%;
            padding: 18px;
            margin-top: 25px;
            box-sizing: border-box;
            color: #a5c7b1;
            background: #0a150e;
            border: 1px solid #345443;
            border-radius: 4px;
            font-family: inherit;
            font-size: 11px;
            font-weight: bold;
            letter-spacing: 1.5px;
            cursor: pointer;
            text-align: left;
        }

        .dashboard-admin-toggle:hover {
            border-color: var(--green, #00df80);
        }

        .dashboard-admin-toggle .dashboard-arrow {
            margin-left: auto;
        }

        .dashboard-admin-toggle.is-active .dashboard-arrow {
            transform: rotate(180deg);
        }

        #profileAdmin {
            margin-top: 12px;
            border-radius: 4px;
        }

        /* RESPONSIVE DESIGN */

        @media (max-width: 850px) {

            .dashboard-grid {
                grid-template-columns:
                    repeat(2, minmax(0, 1fr));
            }

            .profile-hero {
                grid-template-columns:
                    minmax(180px, 280px) minmax(0, 1fr);
                gap: 20px;
            }

            .profile-main-image img {
                height: 340px;
            }

        }

        @media (max-width: 600px) {

            .profile-hero {
                grid-template-columns: 1fr;
                padding: 15px;
            }

            .profile-main-image img {
                height: 350px;
            }

            .profile-identity h2 {
                font-size: 26px;
            }

            .dashboard-tile {
                padding: 13px;
                min-height: 125px;
            }

            .dashboard-tile-title {
                font-size: 10px;
                letter-spacing: .7px;
            }

            .dashboard-tile-description {
                font-size: 10px;
            }

            .dashboard-panels .doll-gallery {
                grid-template-columns:
                    repeat(2, minmax(0, 1fr));
            }

            .dashboard-panels .gallery-item img {
                height: 180px;
            }

            #measurements {
                padding: 10px;
            }

        }

        @media (max-width: 350px) {

            .dashboard-grid {
                grid-template-columns: 1fr;
            }

            .dashboard-panels .doll-gallery {
                grid-template-columns: 1fr;
            }

        }

        @media (prefers-reduced-motion: reduce) {

            .dashboard-tile,
            .dashboard-arrow,
            .dashboard-reserve {
                transition: none;
            }

            .dashboard-panels .profile-section.is-open {
                animation: none;
            }

        }

    `;

    document.head.appendChild(style);

    /* =================================================
       UPDATE PAGE HEADINGS
    ================================================= */

    document.title =
        "DOLL PROFILE & CUSTOMIZATION // THE DEN";

    const pageTitle =
        document.querySelector(".profile-topbar h2");

    if (pageTitle) {

        pageTitle.textContent = "DOLL PROFILE";

    }

    const pageSubtitle =
        document.querySelector(".profile-subtitle");

    if (pageSubtitle) {

        pageSubtitle.textContent =
            "PERSONAL PROFILE & CUSTOMIZATION";

    }

    /* =================================================
       REMOVE OLD NAVIGATION
    ================================================= */

    profileContent.classList.remove(
        "category-view-active"
    );

    const oldNavigation =
        profileContent.querySelector(".profile-nav");

    if (oldNavigation) {

        oldNavigation.hidden = true;

    }

    const oldAppearanceHub = $("appearance");

    if (oldAppearanceHub) {

        oldAppearanceHub.hidden = true;

    }

    /* =================================================
       RESERVATION BUTTON
    ================================================= */

    const dollId = new URLSearchParams(
        window.location.search
    ).get("id");

    const identity =
        profileContent.querySelector(".profile-identity");

    if (identity && dollId) {

        const reserve = document.createElement("a");

        reserve.className = "dashboard-reserve";

        reserve.textContent =
            "MAKE A RESERVATION →";

        reserve.href =
            `doll-reservation.html?id=${encodeURIComponent(dollId)}`;

        identity.appendChild(reserve);

    }

    /* =================================================
       CREATE DASHBOARD
    ================================================= */

    const dashboard = document.createElement("div");

    dashboard.className = "profile-dashboard";

    const heading = document.createElement("div");

    heading.className = "dashboard-heading";

    heading.innerHTML = `

        <p class="system-label">
            THE DEN // COLLECTION ACCESS
        </p>

        <h3>EXPLORE THE PROFILE</h3>

        <p>
            Select a category to explore its content
            and available customization options.
        </p>

    `;

    const grid = document.createElement("div");

    grid.className = "dashboard-grid";

    const panels = document.createElement("div");

    panels.className = "dashboard-panels";

    dashboard.append(
        heading,
        grid,
        panels
    );

    const hero =
        profileContent.querySelector(".profile-hero");

    if (hero) {

        hero.after(dashboard);

    } else {

        profileContent.prepend(dashboard);

    }

    /* =================================================
       CREATE CATEGORY TILES
    ================================================= */

    categories.forEach(category => {

        const section = $(category.id);

        if (!section) return;

        section.hidden = true;

        section.classList.remove(
            "active-category-view"
        );

        sections.set(
            category.id,
            section
        );

        const button = document.createElement("button");

        button.type = "button";

        button.className = "dashboard-tile";

        button.dataset.dashboardCategory =
            category.id;

        button.setAttribute(
            "aria-expanded",
            "false"
        );

        button.setAttribute(
            "aria-controls",
            category.id
        );

        const top = document.createElement("div");

        top.className = "dashboard-tile-top";

        const icon = createIcon(category.icon);

        const arrow = createIcon("chevron");

        arrow.classList.add("dashboard-arrow");

        top.append(
            icon,
            arrow
        );

        const title = document.createElement("span");

        title.className =
            "dashboard-tile-title";

        title.textContent =
            category.title;

        const description =
            document.createElement("span");

        description.className =
            "dashboard-tile-description";

        description.textContent =
            category.description;

        button.append(
            top,
            title,
            description
        );

        button.addEventListener("click", () => {

            toggleCategory(category.id);

        });

        buttons.set(
            category.id,
            button
        );

        grid.appendChild(button);

        // Move the original section.
        // Existing IDs and event listeners are preserved.

        panels.appendChild(section);

        const backButton =
            section.querySelector(".category-back-button");

        if (backButton) {

            backButton.textContent =
                "↑ CLOSE CATEGORY";

            backButton.addEventListener("click", () => {

                closeCategories();

                button.focus();

                grid.scrollIntoView({
                    behavior: scrollBehavior(),
                    block: "start"
                });

            });

        }

    });

    /* =================================================
       APPEARANCE
    ================================================= */

    const appearanceSection = $("physical");

    if (appearanceSection) {

        const title =
            appearanceSection.querySelector("h3");

        if (title) {

            title.textContent =
                "APPEARANCE & CHARACTERISTICS";

        }

    }

    /* =================================================
       PHYSICAL REPORT
    ================================================= */

    const medicalSection = $("medical");

    const physicalData = $("physicalData");

    const conditionData = $("conditionData");

    if (medicalSection && conditionData) {

        const title =
            medicalSection.querySelector("h3");

        if (title) {

            title.textContent =
                "PHYSICAL REPORT";

        }

        const reportHeader =
            document.createElement("div");

        reportHeader.className =
            "clinical-report-header";

        const reportIcon =
            createIcon("medical");

        const reportText =
            document.createElement("div");

        reportText.innerHTML = `

            <strong>PHYSICAL ASSESSMENT</strong>

            <small>
                THE DEN // CONDITION DOCUMENTATION
            </small>

        `;

        reportHeader.append(
            reportIcon,
            reportText
        );

        const parametersHeading =
            document.createElement("h4");

        parametersHeading.className =
            "clinical-heading";

        parametersHeading.textContent =
            "01 // GENERAL PHYSICAL PARAMETERS";

        const parameters =
            document.createElement("div");

        parameters.className =
            "profile-data-grid";

        parameters.id =
            "clinicalParameters";

        const conditionHeading =
            document.createElement("h4");

        conditionHeading.className =
            "clinical-heading";

        conditionHeading.textContent =
            "02 // CONDITION & FUNCTIONAL ASSESSMENT";

        conditionData.before(
            reportHeader,
            parametersHeading,
            parameters,
            conditionHeading
        );

        const note = document.createElement("p");

        note.className = "clinical-note";

        note.textContent =
            "DOLL CONDITION DOCUMENTATION // " +
            "NOT A HUMAN MEDICAL CERTIFICATE";

        medicalSection.appendChild(note);

        const measurementLabels = [

            "HEIGHT (CM)",
            "WEIGHT (KG)",
            "BODY TYPE",
            "BODY MEASUREMENTS",
            "CONSTRUCTION MATERIAL"

        ];

        function updateClinicalParameters() {

            if (!physicalData) return;

            parameters.replaceChildren();

            const records =
                physicalData.querySelectorAll(
                    ".profile-data-item"
                );

            records.forEach(record => {

                const label =
                    record.querySelector(
                        ".profile-data-label"
                    );

                if (
                    label &&
                    measurementLabels.includes(
                        label.textContent.trim()
                    )
                ) {

                    parameters.appendChild(
                        record.cloneNode(true)
                    );

                }

            });

            if (!parameters.children.length) {

                const empty =
                    document.createElement("p");

                empty.className = "profile-note";

                empty.textContent =
                    "NO PARAMETERS RECORDED.";

                parameters.appendChild(empty);

            }

        }

        if (physicalData) {

            const observer =
                new MutationObserver(
                    updateClinicalParameters
                );

            observer.observe(
                physicalData,
                {
                    childList: true,
                    subtree: true,
                    characterData: true
                }
            );

            updateClinicalParameters();

        }

    }

    /* =================================================
       ADMINISTRATION PANEL
    ================================================= */

    const adminPanel = $("profileAdmin");

    if (adminPanel) {

        const adminWrapper =
            document.createElement("div");

        adminWrapper.className =
            "dashboard-admin-wrapper";

        adminWrapper.hidden = true;

        const adminButton =
            document.createElement("button");

        adminButton.type = "button";

        adminButton.className =
            "dashboard-admin-toggle";

        adminButton.setAttribute(
            "aria-expanded",
            "false"
        );

        adminButton.setAttribute(
            "aria-controls",
            "profileAdmin"
        );

        const adminIcon =
            createIcon("settings");

        const adminTitle =
            document.createElement("span");

        adminTitle.textContent =
            "ADMINISTRATION PANEL";

        const adminArrow =
            createIcon("chevron");

        adminArrow.classList.add(
            "dashboard-arrow"
        );

        adminButton.append(
            adminIcon,
            adminTitle,
            adminArrow
        );

        adminPanel.before(adminWrapper);

        adminWrapper.append(
            adminButton,
            adminPanel
        );

        // Administrator access remains controlled
        // by the original doll-details.js.

        function syncAdminAccess() {

            adminWrapper.hidden =
                adminPanel.hidden;

        }

        const adminObserver =
            new MutationObserver(syncAdminAccess);

        adminObserver.observe(
            adminPanel,
            {
                attributes: true,
                attributeFilter: ["hidden"]
            }
        );

        syncAdminAccess();

        adminPanel.style.display = "none";

        let adminExpanded = false;

        adminButton.addEventListener("click", () => {

            if (adminPanel.hidden) return;

            adminExpanded = !adminExpanded;

            adminPanel.style.display =
                adminExpanded ? "" : "none";

            adminButton.classList.toggle(
                "is-active",
                adminExpanded
            );

            adminButton.setAttribute(
                "aria-expanded",
                String(adminExpanded)
            );

        });

    }

    /* =================================================
       ANIMATION PREFERENCES
    ================================================= */

    function scrollBehavior() {

        return window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches
            ? "auto"
            : "smooth";

    }

    /* =================================================
       CLOSE CATEGORIES
    ================================================= */

    function closeCategories() {

        sections.forEach(section => {

            section.hidden = true;

            section.classList.remove(
                "is-open"
            );

        });

        buttons.forEach(button => {

            button.classList.remove(
                "is-active"
            );

            button.setAttribute(
                "aria-expanded",
                "false"
            );

        });

        activeCategory = null;

    }

    /* =================================================
       OPEN CATEGORY
    ================================================= */

    function toggleCategory(categoryId) {

        if (activeCategory === categoryId) {

            closeCategories();

            return;

        }

        const section = sections.get(categoryId);

        const button = buttons.get(categoryId);

        if (!section || !button) return;

        closeCategories();

        activeCategory = categoryId;

        section.hidden = false;

        section.classList.add("is-open");

        button.classList.add("is-active");

        button.setAttribute(
            "aria-expanded",
            "true"
        );

        section.scrollIntoView({
            behavior: scrollBehavior(),
            block: "nearest"
        });

    }

    /* =================================================
       SUPPORT EXISTING CATEGORY LINKS
    ================================================= */

    const requestedCategory =
        window.location.hash
            .replace(/^#/, "")
            .replace(/-gallery$/, "");

    if (sections.has(requestedCategory)) {

        toggleCategory(requestedCategory);

    }

})();

/* =====================================================
   END OF FILE
   THE DEN © 2026
===================================================== */
