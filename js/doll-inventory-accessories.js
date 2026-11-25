
/* =====================================================
   THE DEN — INVENTORY ACCESSORIES
   DOLL PROFILE INTEGRATION
===================================================== */

(async function () {

    "use strict";

    const supabase = window.archiveSupabase;
    const session = await window.archiveAuthReady;

    if (!supabase || !session) return;

    const ADMIN_ID =
        "3d4c3c65-3956-46b3-a83d-aae7e671c0ff";

    const isAdmin = session.user.id === ADMIN_ID;

    const dollId = new URLSearchParams(
        window.location.search
    ).get("id");

    const section = document.getElementById("accessories");

    if (!dollId || !section) return;

    const TABLE = "doll_inventory_accessories";
    const BUCKET = "karolina-images";

    let inventory = [];
    let linkedItems = new Set();
    let selectedCategory = "";
    let searchTerm = "";
    let managementMode = false;
    let busy = false;
    let loaded = false;
    let renderVersion = 0;

    const imageCache = new Map();

    /* =================================================
       HELPERS
    ================================================= */

    function create(tag, className, text) {

        const element = document.createElement(tag);

        if (className) {
            element.className = className;
        }

        if (text !== undefined) {
            element.textContent = text;
        }

        return element;

    }

    function button(text, className, action) {

        const element = create(
            "button",
            className,
            text
        );

        element.type = "button";
        element.addEventListener("click", action);

        return element;

    }

    async function getImage(path) {

        if (!path) return null;

        const cached = imageCache.get(path);

        if (cached && cached.expires > Date.now()) {
            return cached.url;
        }

        const { data, error } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(path, 3600);

        if (error) {
            console.error(error);
            return null;
        }

        imageCache.set(path, {
            url: data.signedUrl,
            expires: Date.now() + 3500000
        });

        return data.signedUrl;

    }

    /* =================================================
       MODULE STRUCTURE
    ================================================= */

    const root = create(
        "section",
        "dia-module"
    );

    root.id = "inventoryAccessories";

    const header = create("div", "dia-header");

    const heading = create("div");

    heading.append(

        create(
            "p",
            "dia-system-label",
            "THE DEN // CONNECTED INVENTORY"
        ),

        create(
            "h3",
            "dia-title",
            "INVENTORY ACCESSORIES"
        ),

        create(
            "p",
            "dia-subtitle",
            "Accessories linked directly from TOYS & TOOLS."
        )

    );

    const counter = create(
        "span",
        "dia-counter",
        "0 LINKED ITEMS"
    );

    header.append(heading, counter);

    const toolbar = create("div", "dia-toolbar");

    const search = create("input", "dia-search");

    search.type = "search";
    search.placeholder = "Search accessories...";
    search.setAttribute("aria-label", "Search accessories");

    search.addEventListener("input", () => {

        searchTerm = search.value
            .trim()
            .toLowerCase();

        render();

    });

    const categorySelect = create(
        "select",
        "dia-category-select"
    );

    categorySelect.setAttribute(
        "aria-label",
        "Accessory category"
    );

    categorySelect.addEventListener("change", () => {

        selectedCategory = categorySelect.value;

        render();

    });

    toolbar.append(search, categorySelect);

    const categoryBar = create(
        "div",
        "dia-category-bar"
    );

    const message = create(
        "p",
        "dia-message"
    );

    message.setAttribute("aria-live", "polite");

    const grid = create(
        "div",
        "dia-grid"
    );

    const modeLabel = create(
        "p",
        "dia-mode-label",
        "ASSIGNED ACCESSORIES"
    );

    const adminActions = create(
        "div",
        "dia-admin-actions"
    );

    let manageButton = null;

    if (isAdmin) {

        manageButton = button(

            "MANAGE ACCESSORIES",

            "dia-button dia-primary",

            () => {

                if (busy || !loaded) return;

                managementMode = !managementMode;

                selectedCategory = "";
                searchTerm = "";
                search.value = "";

                manageButton.textContent =
                    managementMode
                        ? "FINISH MANAGEMENT"
                        : "MANAGE ACCESSORIES";

                modeLabel.textContent =
                    managementMode
                        ? "SELECT ITEMS FROM INVENTORY"
                        : "ASSIGNED ACCESSORIES";

                updateCategories();
                render();

            }

        );

        adminActions.appendChild(manageButton);

    }

    const refreshButton = button(

        "REFRESH",

        "dia-button",

        () => {

            if (!busy) loadData();

        }

    );

    adminActions.appendChild(refreshButton);

    root.append(

        header,
        adminActions,
        modeLabel,
        toolbar,
        categoryBar,
        message,
        grid

    );

    section.appendChild(root);

    /* =================================================
       MESSAGES
    ================================================= */

    function setMessage(text, type = "") {

        message.textContent = text;

        message.className =
            "dia-message" +
            (type ? " " + type : "");

    }

    function setBusy(value) {

        busy = value;

        refreshButton.disabled = value;

        if (manageButton) {
            manageButton.disabled = value;
        }

        grid.querySelectorAll(
            ".dia-link-button"
        ).forEach(element => {

            element.disabled = value;

        });

    }

    /* =================================================
       DATA LOADING
    ================================================= */

    async function loadData() {

        if (busy) return;

        setBusy(true);

        setMessage("SYNCHRONIZING INVENTORY...");

        try {

            const [itemsResult, linksResult] =
                await Promise.all([

                    supabase
                        .from("inventory_items")
                        .select(
                            "id,name,category,status," +
                            "description,image_path"
                        )
                        .order("name", {
                            ascending: true
                        }),

                    supabase
                        .from(TABLE)
                        .select("inventory_item_id")
                        .eq("doll_id", dollId)

                ]);

            if (itemsResult.error) {
                throw itemsResult.error;
            }

            if (linksResult.error) {
                throw linksResult.error;
            }

            inventory = itemsResult.data || [];

            linkedItems = new Set(

                (linksResult.data || []).map(
                    item => item.inventory_item_id
                )

            );

            imageCache.clear();

            loaded = true;

            updateCategories();

            await render();

            setMessage("");

        } catch (error) {

            console.error(error);

            loaded = false;

            grid.replaceChildren();

            setMessage(

                error.message ||
                "Could not load inventory accessories.",

                "error"

            );

        } finally {

            setBusy(false);

        }

    }

    /* =================================================
       CATEGORY FILTERS
    ================================================= */

    function getVisibleItems() {

        if (managementMode && isAdmin) {
            return inventory;
        }

        return inventory.filter(

            item => linkedItems.has(item.id)

        );

    }

    function updateCategories() {

        const items = getVisibleItems();

        const categories = [

            ...new Set(

                items.map(
                    item => item.category || "Other"
                )

            )

        ].sort();

        if (
            selectedCategory &&
            !categories.includes(selectedCategory)
        ) {

            selectedCategory = "";

        }

        categorySelect.replaceChildren();

        const allOption = create(
            "option",
            "",
            "ALL CATEGORIES"
        );

        allOption.value = "";

        categorySelect.appendChild(allOption);

        categories.forEach(category => {

            const option = create(
                "option",
                "",
                category.toUpperCase()
            );

            option.value = category;

            categorySelect.appendChild(option);

        });

        categorySelect.value = selectedCategory;

        categoryBar.replaceChildren();

        function addCategory(category, label, count) {

            const tile = button(

                label + " (" + count + ")",

                "dia-category-button",

                () => {

                    selectedCategory = category;

                    updateCategories();

                    render();

                }

            );

            tile.classList.toggle(
                "is-active",
                selectedCategory === category
            );

            tile.setAttribute(

                "aria-pressed",

                String(selectedCategory === category)

            );

            categoryBar.appendChild(tile);

        }

        addCategory("", "ALL", items.length);

        categories.forEach(category => {

            const count = items.filter(

                item =>
                    (item.category || "Other") === category

            ).length;

            addCategory(

                category,
                category.toUpperCase(),
                count

            );

        });

    }

    /* =================================================
       IMAGE PREVIEW
    ================================================= */

    function openImage(url, name) {

        const dialog = create(
            "dialog",
            "dia-lightbox"
        );

        const image = create("img");

        image.src = url;
        image.alt = name || "Accessory";

        const close = button(

            "CLOSE ×",

            "dia-button",

            () => dialog.close()

        );

        dialog.append(

            close,
            image,
            create("p", "", name)

        );

        document.body.appendChild(dialog);

        dialog.addEventListener("close", () => {

            dialog.remove();

        });

        dialog.addEventListener("click", event => {

            if (event.target === dialog) {
                dialog.close();
            }

        });

        dialog.showModal();

    }

    /* =================================================
       RENDER ACCESSORIES
    ================================================= */

    async function render() {

        if (!loaded) return;

        const version = ++renderVersion;

        counter.textContent =
            linkedItems.size + " LINKED ITEMS";

        const filtered = getVisibleItems().filter(item => {

            const category = item.category || "Other";

            const searchable = [

                item.name,
                category,
                item.description,
                item.status

            ].join(" ").toLowerCase();

            return (

                (
                    !selectedCategory ||
                    category === selectedCategory
                ) &&

                searchable.includes(searchTerm)

            );

        });

        if (!filtered.length) {

            grid.replaceChildren(

                create(

                    "p",

                    "dia-empty",

                    managementMode
                        ? "NO MATCHING INVENTORY ITEMS."
                        : "NO ACCESSORIES FOUND."

                )

            );

            return;

        }

        const cards = await Promise.all(

            filtered.map(async item => {

                const linked = linkedItems.has(item.id);

                const card = create(
                    "article",
                    "dia-card"
                );

                card.classList.toggle(
                    "is-linked",
                    linked
                );

                const imageFrame = create(
                    "div",
                    "dia-image-frame"
                );

                const url = await getImage(
                    item.image_path
                );

                if (url) {

                    const image = create("img");

                    image.src = url;
                    image.alt = item.name || "";
                    image.loading = "lazy";

                    const imageButton = button(

                        "",

                        "dia-image-button",

                        () => openImage(url, item.name)

                    );

                    imageButton.setAttribute(

                        "aria-label",

                        "View " + (item.name || "accessory")

                    );

                    imageButton.appendChild(image);

                    imageFrame.appendChild(imageButton);

                } else {

                    imageFrame.appendChild(

                        create(
                            "span",
                            "dia-placeholder",
                            "NO IMAGE"
                        )

                    );

                }

                const content = create(
                    "div",
                    "dia-card-content"
                );

                content.append(

                    create(

                        "p",
                        "dia-item-category",
                        item.category || "Other"

                    ),

                    create(

                        "h4",
                        "dia-item-name",
                        item.name || "Unnamed item"

                    )

                );

                const status = create(

                    "span",

                    "dia-status",

                    item.status || "UNKNOWN"

                );

                status.dataset.status =
                    item.status || "";

                content.appendChild(status);

                if (item.description) {

                    content.appendChild(

                        create(

                            "p",

                            "dia-description",

                            item.description

                        )

                    );

                }

                if (managementMode && isAdmin) {

                    const linkButton = button(

                        linked
                            ? "✓ ASSIGNED — REMOVE"
                            : "+ ASSIGN ACCESSORY",

                        linked
                            ? "dia-button dia-link-button is-linked"
                            : "dia-button dia-link-button",

                        () => toggleLink(item)

                    );

                    linkButton.disabled = busy;

                    linkButton.setAttribute(

                        "aria-pressed",

                        String(linked)

                    );

                    content.appendChild(linkButton);

                }

                card.append(
                    imageFrame,
                    content
                );

                return card;

            })

        );

        if (version !== renderVersion) return;

        grid.replaceChildren(...cards);

    }

    /* =================================================
       ASSIGN / REMOVE ACCESSORIES
    ================================================= */

    async function toggleLink(item) {

        if (!isAdmin || busy || !loaded) return;

        const linked = linkedItems.has(item.id);

        setBusy(true);

        setMessage(

            linked
                ? "REMOVING ACCESSORY..."
                : "ASSIGNING ACCESSORY..."

        );

        try {

            let result;

            if (linked) {

                result = await supabase

                    .from(TABLE)

                    .delete()

                    .eq("doll_id", dollId)

                    .eq("inventory_item_id", item.id)

                    .select("inventory_item_id")

                    .single();

            } else {

                result = await supabase

                    .from(TABLE)

                    .insert({

                        doll_id: dollId,

                        inventory_item_id: item.id

                    })

                    .select("inventory_item_id")

                    .single();

            }

            if (result.error) {
                throw result.error;
            }

            if (linked) {

                linkedItems.delete(item.id);

            } else {

                linkedItems.add(item.id);

            }

            updateCategories();

            await render();

            setMessage(

                linked
                    ? "Accessory removed from profile."
                    : "Accessory assigned successfully.",

                "success"

            );

        } catch (error) {

            console.error(error);

            setMessage(

                error.message ||
                "Could not update accessory assignment.",

                "error"

            );

        } finally {

            setBusy(false);

        }

    }

    /* =================================================
       INITIALIZATION
    ================================================= */

    await loadData();

})();

/* =====================================================
   END OF FILE
   THE DEN © 2026
===================================================== */
