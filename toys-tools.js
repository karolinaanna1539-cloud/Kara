
/* =====================================================
   THE DEN // TOYS & TOOLS
   DYNAMIC INVENTORY SYSTEM 3.1
===================================================== */

(async function () {

    "use strict";

    const db = window.archiveSupabase;
    const session = await window.archiveAuthReady;

    if (!session || !db) return;

    const user = session.user;
    const BUCKET = "karolina-images";
    const MAX_FILE_SIZE = 10 * 1024 * 1024;

    let inventory = [];
    let editingImagePath = null;
    let realtimeChannel = null;
    let renderVersion = 0;
    let loadVersion = 0;
    let categoryVersion = 0;
    let saving = false;
    let categoryAPI = null;
    let refreshTimer = null;

    const $ = id => document.getElementById(id);

    /* =================================================
       DOM ELEMENTS
    ================================================= */

    const elements = {

        form: $("itemForm"),
        itemId: $("itemId"),
        name: $("itemName"),
        category: $("itemCategory"),
        status: $("itemStatus"),
        location: $("itemLocation"),
        description: $("itemDescription"),
        image: $("itemImageFile"),
        imagePreview: $("currentImagePreview"),

        formTitle: $("formTitle"),
        formMessage: $("formMessage"),
        saveButton: $("saveButton"),
        cancelButton: $("cancelEditButton"),

        grid: $("inventoryGrid"),
        search: $("searchInput"),
        filterCategory: $("filterCategory"),
        filterStatus: $("filterStatus"),

        connection: $("connectionStatus"),
        total: $("totalCount"),
        available: $("availableCount"),
        inUse: $("inUseCount"),
        storage: $("storageCount"),

        logout: $("logoutButton"),
        categoryGroups: $("inventoryCategoryGroups"),
        showAll: $("showAllCategories"),
        activeCategory: $("activeCategoryName"),
        resultCount: $("inventoryResultCount"),
        clearFilters: $("clearInventoryFilters"),
        editor: $("inventoryEditor")

    };

    /* =================================================
       HELPERS
    ================================================= */

    function makeElement(tag, className, text) {

        const node = document.createElement(tag);

        if (className) {
            node.className = className;
        }

        if (text !== undefined) {
            node.textContent = text;
        }

        return node;

    }

    function makeButton(text, className, action) {

        const button = makeElement(
            "button",
            className,
            text
        );

        button.type = "button";
        button.addEventListener("click", action);

        return button;

    }

    function setMessage(message, error = false) {

        elements.formMessage.textContent = message;

        elements.formMessage.classList.toggle(
            "error",
            error
        );

    }

    function setConnection(message, error = false) {

        elements.connection.textContent = message;

        elements.connection.classList.toggle(
            "error",
            error
        );

    }

    /* =================================================
       CATEGORY ICONS
    ================================================= */

    const icons = {

        folder:
            '<path d="M2 5h8l3 3h9v13H2z"/>',

        link:
            '<rect x="2" y="7" width="9" height="10" rx="4"/>' +
            '<rect x="13" y="7" width="9" height="10" rx="4"/>' +
            '<path d="M8 12h8"/>',

        circle:
            '<circle cx="12" cy="12" r="9"/>' +
            '<rect x="9" y="2" width="6" height="5" rx="1"/>',

        rope:
            '<path d="M5 5c0-4 14-4 14 0s-14 4-14 8 14 4 14 0S5 9 5 17s14 5 14 0"/>',

        mask:
            '<path d="M3 7c6-4 12-4 18 0v8c-3 5-6 6-9 2-3 4-6 3-9-2z"/>' +
            '<ellipse cx="7" cy="11" rx="2" ry="1.5"/>' +
            '<ellipse cx="17" cy="11" rx="2" ry="1.5"/>',

        feather:
            '<path d="M4 20L19 5"/>' +
            '<path d="M7 17C0 7 14 1 21 3c2 8-5 20-14 14z"/>',

        layers:
            '<path d="M12 2L2 8l10 6 10-6z"/>' +
            '<path d="M2 12l10 6 10-6M2 16l10 6 10-6"/>',

        box:
            '<rect x="3" y="3" width="18" height="18" rx="3"/>' +
            '<path d="M3 9h18M9 3v18"/>',

        drop:
            '<path d="M12 2C9 7 4 12 4 16a8 8 0 0 0 16 0c0-4-5-9-8-14z"/>',

        shield:
            '<path d="M12 2L3 6v7c0 5 9 9 9 9s9-4 9-9V6z"/>',

        shirt:
            '<path d="M8 3L2 7l3 6 3-2v10h8V11l3 2 3-6-6-4"/>' +
            '<path d="M8 3a4 4 0 0 0 8 0"/>',

        hand:
            '<path d="M7 12V5a1.5 1.5 0 0 1 3 0v6V3a1.5 1.5 0 0 1 3 0v8V5a1.5 1.5 0 0 1 3 0v7V8a1.5 1.5 0 0 1 3 0v8c0 4-3 6-7 6s-6-2-8-5l-2-4c-1-3 2-4 5-1z"/>',

        foot:
            '<ellipse cx="10" cy="15" rx="5" ry="7"/>' +
            '<circle cx="7" cy="4" r="2"/>' +
            '<circle cx="12" cy="3" r="1.5"/>' +
            '<circle cx="16" cy="5" r="1.5"/>',

        gem:
            '<path d="M3 8l4-5h10l4 5-9 13z"/>' +
            '<path d="M3 8h18M7 3l5 18 5-18"/>',

        package:
            '<path d="M3 6l9-4 9 4v12l-9 4-9-4z"/>' +
            '<path d="M3 6l9 4 9-4M12 10v12"/>',

        chair:
            '<rect x="5" y="3" width="14" height="11" rx="3"/>' +
            '<path d="M3 12v6h18v-6M5 18v4M19 18v4"/>',

        tool:
            '<path d="M14 6l4-4 4 4-4 4-4-1-9 12-3-3 12-9z"/>',

        safety:
            '<path d="M12 2L3 6v7c0 5 9 9 9 9s9-4 9-9V6z"/>' +
            '<path d="M7 12l3 3 7-7"/>',

        clean:
            '<rect x="7" y="9" width="10" height="13" rx="2"/>' +
            '<path d="M10 9V5h5v4M10 5V2h9M19 2v3"/>',

        briefcase:
            '<rect x="2" y="7" width="20" height="14" rx="2"/>' +
            '<path d="M8 7V3h8v4M2 13h20M10 13v3h4v-3"/>'

    };

    function createIcon(name) {

        const wrapper = makeElement(
            "span",
            "inventory-category-icon"
        );

        wrapper.setAttribute(
            "aria-hidden",
            "true"
        );

        const icon = Object.prototype.hasOwnProperty.call(
            icons,
            name
        ) ? icons[name] : icons.folder;

        wrapper.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg"
                 viewBox="0 0 24 24"
                 fill="none"
                 stroke="currentColor"
                 stroke-width="1.5"
                 stroke-linecap="round"
                 stroke-linejoin="round">
                ${icon}
            </svg>
        `;

        return wrapper;

    }

    /* =================================================
       CUSTOM CATEGORY ICONS
    ================================================= */

    async function applyCustomIcon(record, originalIcon) {

        if (!record.image_path || !categoryAPI) {
            return;
        }

        try {

            const url = await categoryAPI.signedImage(
                record.image_path
            );

            if (!url) return;

            const image = document.createElement("img");

            image.className = "ic-category-custom-icon";

            image.alt = record.name;

            image.width = 48;
            image.height = 48;

            image.addEventListener(
                "load",
                () => {

                    if (originalIcon.parentNode) {

                        originalIcon.replaceWith(image);

                    }

                },
                { once: true }
            );

            image.addEventListener(
                "error",
                () => {

                    console.warn(
                        "Could not load category icon:",
                        record.name
                    );

                },
                { once: true }
            );

            image.src = url;

        } catch (error) {

            console.warn(
                "Custom category icon error:",
                error
            );

        }

    }

    /* =================================================
       DYNAMIC CATEGORY NAVIGATION
    ================================================= */

    async function buildCategories() {

        const version = ++categoryVersion;

        categoryAPI =
            await window.inventoryCategoriesReady;

        if (!categoryAPI) {

            elements.categoryGroups.textContent =
                "Could not load category database.";

            return false;

        }

        const records = categoryAPI.getVisible();
        const groups = new Map();

        for (const record of records) {

            if (record.is_group) continue;

            const parent = records.find(
                item => item.id === record.parent_id
            );

            const groupName = parent
                ? categoryAPI.getPath(parent)
                : "GENERAL INVENTORY";

            if (!groups.has(groupName)) {

                groups.set(groupName, []);

            }

            groups.get(groupName).push(record);

        }

        const fragment =
            document.createDocumentFragment();

        const customIcons = [];

        for (const [groupName, categories] of groups) {

            const section = makeElement(
                "section",
                "inventory-category-group"
            );

            const heading = makeElement(
                "h4",
                "inventory-group-title",
                groupName.toUpperCase()
            );

            const grid = makeElement(
                "div",
                "inventory-category-grid"
            );

            for (const record of categories) {

                const tile = makeElement(
                    "button",
                    "inventory-category-tile"
                );

                tile.type = "button";

                tile.dataset.category = record.name;

                tile.setAttribute(
                    "aria-pressed",
                    "false"
                );

                const top = makeElement(
                    "div",
                    "inventory-category-tile-top"
                );

                const count = makeElement(
                    "span",
                    "inventory-category-count",
                    "0"
                );

                const originalIcon = createIcon(
                    record.icon || "folder"
                );

                top.append(
                    originalIcon,
                    count
                );

                tile.appendChild(top);

                tile.appendChild(

                    makeElement(
                        "span",
                        "inventory-category-name",
                        record.name.toUpperCase()
                    )

                );

                if (record.description) {

                    tile.appendChild(

                        makeElement(
                            "span",
                            "ic-category-description",
                            record.description
                        )

                    );

                }

                tile.addEventListener(
                    "click",
                    () => selectCategory(
                        record.name,
                        true
                    )
                );

                grid.appendChild(tile);

                if (record.image_path) {

                    customIcons.push({
                        record,
                        originalIcon
                    });

                }

            }

            section.append(heading, grid);

            fragment.appendChild(section);

        }

        if (version !== categoryVersion) {

            return false;

        }

        elements.categoryGroups.replaceChildren(
            fragment
        );

        syncCategoryOptions();

        updateCategoryNavigation();

        /* Load custom icons independently.
           Image errors cannot block the inventory. */

        customIcons.forEach(entry => {

            applyCustomIcon(
                entry.record,
                entry.originalIcon
            );

        });

        return true;

    }

    /* =================================================
       CATEGORY DROPDOWNS
    ================================================= */

    function ensureCategoryOption(select, category) {

        if (!category) return;

        const exists = Array.from(
            select.options
        ).some(
            option => option.value === category
        );

        if (!exists) {

            const option =
                document.createElement("option");

            option.value = category;

            option.textContent = category;

            select.appendChild(option);

        }

    }

    function syncCategoryOptions() {

        const selectedItem =
            elements.category.value;

        const selectedFilter =
            elements.filterCategory.value;

        const records = categoryAPI
            ? categoryAPI.getVisible().filter(
                record => !record.is_group
            )
            : [];

        const allRecords = categoryAPI
            ? categoryAPI.getAll()
            : [];

        elements.category.replaceChildren();

        elements.filterCategory.replaceChildren();

        const placeholder =
            document.createElement("option");

        placeholder.value = "";

        placeholder.textContent =
            "SELECT CATEGORY";

        placeholder.disabled = true;

        placeholder.defaultSelected = true;

        elements.category.appendChild(
            placeholder
        );

        const allOption =
            document.createElement("option");

        allOption.value = "";

        allOption.textContent =
            "ALL CATEGORIES";

        elements.filterCategory.appendChild(
            allOption
        );

        for (const select of [
            elements.category,
            elements.filterCategory
        ]) {

            const groups = new Map();

            for (const record of records) {

                const parent = allRecords.find(
                    item => item.id === record.parent_id
                );

                const groupName = parent
                    ? categoryAPI.getPath(parent)
                    : "GENERAL INVENTORY";

                if (!groups.has(groupName)) {

                    const group =
                        document.createElement("optgroup");

                    group.label = groupName;

                    groups.set(groupName, group);

                    select.appendChild(group);

                }

                const option =
                    document.createElement("option");

                option.value = record.name;

                option.textContent = record.name;

                groups.get(groupName).appendChild(
                    option
                );

            }

        }

        inventory.forEach(item => {

            ensureCategoryOption(
                elements.filterCategory,
                item.category
            );

            if (!categoryAPI) {

                ensureCategoryOption(
                    elements.category,
                    item.category
                );

            }

        });

        const editingItem = inventory.find(
            item => String(item.id) ===
                elements.itemId.value
        );

        if (editingItem) {

            ensureCategoryOption(
                elements.category,
                editingItem.category
            );

        }

        const itemExists = Array.from(
            elements.category.options
        ).some(
            option => option.value === selectedItem
        );

        elements.category.value = itemExists

            ? selectedItem

            : editingItem?.category || "";

        const filterExists = Array.from(
            elements.filterCategory.options
        ).some(
            option => option.value === selectedFilter
        );

        elements.filterCategory.value = filterExists

            ? selectedFilter

            : "";

    }

    /* =================================================
       CATEGORY COUNTERS
    ================================================= */

    function updateCategoryNavigation() {

        const selected =
            elements.filterCategory.value;

        const tiles =
            elements.categoryGroups.querySelectorAll(
                ".inventory-category-tile"
            );

        tiles.forEach(tile => {

            const category = tile.dataset.category;

            const count = inventory.filter(
                item => item.category === category
            ).length;

            tile.querySelector(
                ".inventory-category-count"
            ).textContent = count;

            tile.classList.toggle(
                "is-active",
                selected === category
            );

            tile.classList.toggle(
                "is-empty",
                count === 0
            );

            tile.setAttribute(
                "aria-pressed",
                String(selected === category)
            );

        });

        elements.activeCategory.textContent =
            selected
                ? selected.toUpperCase()
                : "ALL ITEMS";

        elements.showAll.classList.toggle(
            "is-active",
            !selected
        );

        elements.showAll.setAttribute(
            "aria-pressed",
            String(!selected)
        );

    }

    function selectCategory(category, scroll = false) {

        elements.filterCategory.value = category;

        updateCategoryNavigation();

        renderInventory();

        if (scroll) {

            document.querySelector(
                ".inventory-list-section"
            )?.scrollIntoView({

                behavior: window.matchMedia(
                    "(prefers-reduced-motion: reduce)"
                ).matches ? "auto" : "smooth",

                block: "start"

            });

        }

    }

    function clearFilters() {

        elements.search.value = "";

        elements.filterStatus.value = "";

        selectCategory("");

    }

    /* =================================================
       INVENTORY STATISTICS
    ================================================= */

    function updateStatistics() {

        elements.total.textContent =
            inventory.length;

        elements.available.textContent =
            inventory.filter(
                item => item.status === "AVAILABLE"
            ).length;

        elements.inUse.textContent =
            inventory.filter(
                item => item.status === "IN USE"
            ).length;

        elements.storage.textContent =
            inventory.filter(
                item => item.status === "STORAGE"
            ).length;

    }

    /* =================================================
       PRIVATE IMAGE STORAGE
    ================================================= */

    async function getSignedImage(path) {

        if (!path) return null;

        const { data, error } = await db.storage

            .from(BUCKET)

            .createSignedUrl(path, 3600);

        if (error) {

            console.error(error);

            return null;

        }

        return data.signedUrl;

    }

    async function uploadImage(file) {

        if (!file) return null;

        const allowedTypes = [

            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif"

        ];

        if (!allowedTypes.includes(file.type)) {

            throw new Error(
                "Unsupported image format."
            );

        }

        if (file.size > MAX_FILE_SIZE) {

            throw new Error(
                "Maximum image size is 10 MB."
            );

        }

        const safeName = file.name

            .toLowerCase()

            .replace(/[^a-z0-9._-]/g, "-");

        const path =

            user.id + "/" +

            crypto.randomUUID() + "-" +

            safeName;

        const { error } = await db.storage

            .from(BUCKET)

            .upload(path, file, {

                cacheControl: "3600",

                upsert: false,

                contentType: file.type

            });

        if (error) throw error;

        return path;

    }

    async function removeImage(path) {

        if (!path) return true;

        const { error } = await db.storage

            .from(BUCKET)

            .remove([path]);

        if (error) {

            console.error(error);

            return false;

        }

        return true;

    }

    /* =================================================
       IMAGE LIGHTBOX
    ================================================= */

    function openImage(url, name) {

        const dialog = makeElement(
            "dialog",
            "inventory-lightbox"
        );

        const close = makeButton(

            "CLOSE ×",

            "inventory-lightbox-close",

            () => dialog.close()

        );

        const image =
            document.createElement("img");

        image.src = url;

        image.alt = name || "Inventory image";

        const caption = makeElement(

            "p",

            "inventory-lightbox-caption",

            name || ""

        );

        dialog.append(close, image, caption);

        document.body.appendChild(dialog);

        dialog.addEventListener("click", event => {

            if (event.target === dialog) {

                dialog.close();

            }

        });

        dialog.addEventListener(
            "close",
            () => dialog.remove()
        );

        dialog.showModal();

    }

    /* =================================================
       LOAD INVENTORY
    ================================================= */

    async function loadInventory() {

        const version = ++loadVersion;

        setConnection("SYNCHRONIZING...");

        const { data, error } = await db

            .from("inventory_items")

            .select("*")

            .order("created_at", {
                ascending: false
            });

        if (version !== loadVersion) return;

        if (error) {

            console.error(error);

            setConnection(
                "DATABASE ERROR",
                true
            );

            elements.grid.textContent =
                "Could not load inventory.";

            return;

        }

        inventory = data || [];

        syncCategoryOptions();

        updateStatistics();

        updateCategoryNavigation();

        setConnection(

            categoryAPI

                ? "DATABASE ONLINE"

                : "CATEGORY DATABASE ERROR",

            !categoryAPI

        );

        await renderInventory();

    }

    /* =================================================
       RENDER INVENTORY CARDS
    ================================================= */

    async function renderInventory() {

        const version = ++renderVersion;

        const search = elements.search.value

            .toLowerCase()

            .trim();

        const category =
            elements.filterCategory.value;

        const status =
            elements.filterStatus.value;

        const filtered = inventory.filter(item => {

            const searchable = [

                item.name,
                item.category,
                item.status,
                item.location,
                item.description

            ].join(" ").toLowerCase();

            return (

                searchable.includes(search) &&

                (!category ||
                    item.category === category) &&

                (!status ||
                    item.status === status)

            );

        });

        elements.resultCount.textContent =

            `${filtered.length} / ${inventory.length} ITEMS`;

        elements.grid.replaceChildren();

        if (!filtered.length) {

            const empty = makeElement(
                "div",
                "inventory-empty-state"
            );

            empty.append(

                createIcon("folder"),

                makeElement(
                    "h3",
                    "",
                    "NO RECORDS FOUND"
                ),

                makeElement(
                    "p",
                    "",
                    "No items match the selected filters."
                )

            );

            elements.grid.appendChild(empty);

            return;

        }

        const cards = await Promise.all(

            filtered.map(createInventoryCard)

        );

        if (version !== renderVersion) return;

        elements.grid.replaceChildren(...cards);

    }

    async function createInventoryCard(item) {

        const card = makeElement(
            "article",
            "inventory-card"
        );

        const imageFrame = makeElement(
            "div",
            "inventory-image-frame"
        );

        const imageUrl = await getSignedImage(
            item.image_path
        );

        if (imageUrl) {

            const image =
                document.createElement("img");

            image.className = "inventory-image";

            image.src = imageUrl;

            image.alt = item.name || "";

            image.loading = "lazy";

            const imageButton = makeButton(

                "",

                "inventory-image-button",

                () => openImage(
                    imageUrl,
                    item.name
                )

            );

            imageButton.setAttribute(
                "aria-label",
                "View image: " + item.name
            );

            imageButton.appendChild(image);

            imageFrame.appendChild(imageButton);

        } else {

            const placeholder = makeElement(
                "div",
                "inventory-image-placeholder"
            );

            placeholder.append(

                createIcon("box"),

                makeElement(
                    "span",
                    "",
                    "NO IMAGE"
                )

            );

            imageFrame.appendChild(placeholder);

        }

        const content = makeElement(
            "div",
            "inventory-content"
        );

        const category = makeElement(

            "p",

            "inventory-category",

            item.category || "OTHER"

        );

        const name = makeElement(

            "h3",

            "inventory-item-name",

            item.name || "UNNAMED ITEM"

        );

        const status = makeElement(

            "span",

            "inventory-status",

            item.status || "UNKNOWN"

        );

        status.dataset.status =
            item.status || "";

        content.append(category, name, status);

        if (item.location) {

            content.appendChild(

                makeElement(

                    "p",

                    "inventory-detail",

                    "LOCATION: " + item.location

                )

            );

        }

        if (item.description) {

            content.appendChild(

                makeElement(

                    "p",

                    "inventory-description",

                    item.description

                )

            );

        }

        /* Only the item owner can edit or delete. */

        if (item.owner_id === user.id) {

            const actions = makeElement(
                "div",
                "inventory-action"
            );

            actions.append(

                makeButton(

                    "EDIT",

                    "edit-action",

                    () => editItem(item)

                ),

                makeButton(

                    "DELETE",

                    "delete-action",

                    () => deleteItem(item)

                )

            );

            content.appendChild(actions);

        }

        card.append(imageFrame, content);

        return card;

    }

    /* =================================================
       FORM MANAGEMENT
    ================================================= */

    function resetForm() {

        elements.form.reset();

        elements.itemId.value = "";

        editingImagePath = null;

        elements.formTitle.textContent =
            "ADD NEW ITEM";

        elements.saveButton.textContent =
            "SAVE ITEM";

        elements.cancelButton.hidden = true;

        elements.imagePreview.replaceChildren();

        syncCategoryOptions();

        elements.category.value = "";

        setMessage("");

    }

    async function editItem(item) {

        if (saving || item.owner_id !== user.id) {

            return;

        }

        elements.itemId.value = item.id;

        elements.name.value = item.name || "";

        ensureCategoryOption(

            elements.category,

            item.category

        );

        elements.category.value =
            item.category || "";

        elements.status.value =
            item.status || "AVAILABLE";

        elements.location.value =
            item.location || "";

        elements.description.value =
            item.description || "";

        elements.image.value = "";

        editingImagePath =
            item.image_path || null;

        elements.formTitle.textContent =
            "EDIT ITEM";

        elements.saveButton.textContent =
            "UPDATE ITEM";

        elements.cancelButton.hidden = false;

        elements.imagePreview.replaceChildren();

        elements.editor.open = true;

        setMessage("");

        elements.editor.scrollIntoView({

            behavior: window.matchMedia(
                "(prefers-reduced-motion: reduce)"
            ).matches ? "auto" : "smooth",

            block: "start"

        });

        if (editingImagePath) {

            const url = await getSignedImage(
                editingImagePath
            );

            if (

                url &&

                elements.itemId.value ===
                    String(item.id)

            ) {

                const image =
                    document.createElement("img");

                image.className =
                    "inventory-preview-image";

                image.src = url;

                image.alt = item.name || "";

                elements.imagePreview.appendChild(
                    image
                );

            }

        }

    }

    /* =================================================
       SAVE INVENTORY ITEM
    ================================================= */

    async function saveItem(event) {

        event.preventDefault();

        if (saving) return;

        saving = true;

        elements.saveButton.disabled = true;

        elements.saveButton.textContent =
            "SAVING...";

        setMessage("");

        let uploadedPath = null;

        let committed = false;

        try {

            const id = elements.itemId.value;

            const oldImage = editingImagePath;

            const existing = inventory.find(

                item => String(item.id) === id

            );

            if (

                id &&

                (!existing ||
                    existing.owner_id !== user.id)

            ) {

                throw new Error(
                    "You cannot edit this item."
                );

            }

            const payload = {

                name: elements.name.value.trim(),

                category: elements.category.value,

                status: elements.status.value,

                location:
                    elements.location.value.trim(),

                description:
                    elements.description.value.trim(),

                image_path: oldImage,

                updated_at:
                    new Date().toISOString()

            };

            if (!payload.name) {

                throw new Error(
                    "Item name is required."
                );

            }

            if (!payload.category) {

                throw new Error(
                    "Select a category."
                );

            }

            if (!categoryAPI) {

                throw new Error(
                    "Category database is unavailable. Refresh the page."
                );

            }

            const validCategory =
                categoryAPI.getVisible().some(

                    record =>

                        !record.is_group &&

                        record.name === payload.category

                );

            const unchangedCategory =

                existing &&

                existing.category === payload.category;

            if (!validCategory && !unchangedCategory) {

                throw new Error(
                    "This category is no longer available."
                );

            }

            const file = elements.image.files[0];

            if (file) {

                uploadedPath = await uploadImage(file);

                payload.image_path = uploadedPath;

            }

            let result;

            if (id) {

                result = await db

                    .from("inventory_items")

                    .update(payload)

                    .eq("id", id)

                    .eq("owner_id", user.id)

                    .select("id")

                    .single();

            } else {

                result = await db

                    .from("inventory_items")

                    .insert({

                        ...payload,

                        owner_id: user.id

                    })

                    .select("id")

                    .single();

            }

            if (result.error) {

                throw result.error;

            }

            committed = true;

            let cleanupOK = true;

            if (

                uploadedPath &&

                oldImage &&

                oldImage !== uploadedPath

            ) {

                cleanupOK = await removeImage(
                    oldImage
                );

            }

            resetForm();

            await loadInventory();

            setMessage(

                cleanupOK

                    ? "Item saved successfully."

                    : "Item saved. Old image cleanup failed.",

                !cleanupOK

            );

        } catch (error) {

            if (uploadedPath && !committed) {

                await removeImage(uploadedPath);

            }

            console.error(error);

            setMessage(

                committed

                    ? "Item saved, but refresh failed."

                    : error.message,

                true

            );

        } finally {

            saving = false;

            elements.saveButton.disabled = false;

            elements.saveButton.textContent =

                elements.itemId.value

                    ? "UPDATE ITEM"

                    : "SAVE ITEM";

        }

    }

    /* =================================================
       DELETE INVENTORY ITEM
    ================================================= */

    async function deleteItem(item) {

        if (saving || item.owner_id !== user.id) {

            return;

        }

        if (!window.confirm(

            "Delete item: " + item.name + "?"

        )) return;

        saving = true;

        elements.saveButton.disabled = true;

        try {

            const { error } = await db

                .from("inventory_items")

                .delete()

                .eq("id", item.id)

                .eq("owner_id", user.id)

                .select("id")

                .single();

            if (error) throw error;

            const cleanupOK = await removeImage(
                item.image_path
            );

            if (

                elements.itemId.value ===
                    String(item.id)

            ) {

                resetForm();

            }

            await loadInventory();

            if (!cleanupOK) {

                window.alert(
                    "Item deleted, but image cleanup failed."
                );

            }

        } catch (error) {

            console.error(error);

            window.alert(

                "Could not delete item: " +

                error.message

            );

        } finally {

            saving = false;

            elements.saveButton.disabled = false;

        }

    }

    /* =================================================
       REALTIME SYNCHRONIZATION
    ================================================= */

    function subscribeToRealtime() {

        realtimeChannel = db

            .channel("inventory-items-live")

            .on(

                "postgres_changes",

                {

                    event: "*",

                    schema: "public",

                    table: "inventory_items"

                },

                () => {

                    clearTimeout(refreshTimer);

                    refreshTimer = setTimeout(

                        () => loadInventory(),

                        250

                    );

                }

            )

            .subscribe(status => {

                if (status === "SUBSCRIBED") {

                    setConnection(

                        categoryAPI

                            ? "DATABASE ONLINE // LIVE SYNC ACTIVE"

                            : "CATEGORY DATABASE ERROR",

                        !categoryAPI

                    );

                }

                if (status === "CHANNEL_ERROR") {

                    setConnection(

                        "REALTIME CONNECTION ERROR",

                        true

                    );

                }

            });

    }

    /* =================================================
       CATEGORY SYNCHRONIZATION
    ================================================= */

    window.addEventListener(

        "inventory-categories-changed",

        async () => {

            try {

                await buildCategories();

            } catch (error) {

                console.error(
                    "Category synchronization error:",
                    error
                );

            }

            try {

                await loadInventory();

            } catch (error) {

                console.error(error);

                setConnection(

                    "INVENTORY SYNCHRONIZATION ERROR",

                    true

                );

            }

        }

    );

    /* =================================================
       EVENT LISTENERS
    ================================================= */

    elements.form.addEventListener(

        "submit",

        saveItem

    );

    elements.cancelButton.addEventListener(

        "click",

        () => {

            if (!saving) resetForm();

        }

    );

    elements.search.addEventListener(

        "input",

        renderInventory

    );

    elements.filterCategory.addEventListener(

        "change",

        () => {

            updateCategoryNavigation();

            renderInventory();

        }

    );

    elements.filterStatus.addEventListener(

        "change",

        renderInventory

    );

    elements.showAll.addEventListener(

        "click",

        () => selectCategory("")

    );

    elements.clearFilters.addEventListener(

        "click",

        clearFilters

    );

    /* =================================================
       LOGOUT
    ================================================= */

    elements.logout.addEventListener(

        "click",

        async () => {

            const { error } = await db.auth.signOut();

            if (error) {

                window.alert(

                    "Could not log out: " +

                    error.message

                );

                return;

            }

            window.location.replace("index.html");

        }

    );

    /* =================================================
       INITIALIZATION
    ================================================= */

    elements.editor.open = false;

    try {

        await buildCategories();

    } catch (error) {

        console.error(
            "Category initialization error:",
            error
        );

        categoryAPI = null;

        elements.categoryGroups.textContent =
            "Could not load category database.";

    }

    try {

        await loadInventory();

        subscribeToRealtime();

    } catch (error) {

        console.error(error);

        setConnection(

            "INVENTORY INITIALIZATION ERROR",

            true

        );

    }

    window.addEventListener(

        "beforeunload",

        () => {

            clearTimeout(refreshTimer);

            if (realtimeChannel) {

                db.removeChannel(realtimeChannel);

            }

        }

    );

})();

/* =====================================================
   END OF FILE
   THE DEN © 2026
===================================================== */
