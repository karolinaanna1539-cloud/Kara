
/* =====================================================
   THE DEN — TOYS & TOOLS
   INVENTORY CLASSIFICATION SYSTEM 2.0
===================================================== */

(async function () {

    "use strict";

    const supabaseClient = window.archiveSupabase;
    const session = await window.archiveAuthReady;

    if (!session || !supabaseClient) return;

    const user = session.user;
    const BUCKET = "karolina-images";
    const MAX_FILE_SIZE = 10 * 1024 * 1024;

    let inventory = [];
    let editingImagePath = null;
    let realtimeChannel = null;
    let renderVersion = 0;
    let loadVersion = 0;
    let saving = false;

    /* =================================================
       CATEGORY CONFIGURATION
    ================================================= */

    const categoryGroups = [

        {
            name: "BDSM EQUIPMENT",
            categories: [
                ["Restraints", "link"],
                ["Collars & Leashes", "circle"],
                ["Ropes & Bondage", "rope"],
                ["Masks & Hoods", "mask"],
                ["Sensory Accessories", "feather"],
                ["Impact Play", "layers"],
                ["Toys", "box"]
            ]
        },

        {
            name: "CLOTHING & STYLE",
            categories: [
                ["Latex & Rubber", "drop"],
                ["Leather Gear", "shield"],
                ["Clothing & Lingerie", "shirt"],
                ["Gloves & Stockings", "hand"],
                ["Footwear", "foot"],
                ["Jewellery", "gem"],
                ["Accessories", "package"]
            ]
        },

        {
            name: "TECHNICAL & MAINTENANCE",
            categories: [
                ["Furniture", "chair"],
                ["Tools", "tool"],
                ["Safety Equipment", "safety"],
                ["Cleaning & Maintenance", "clean"]
            ]
        },

        {
            name: "GENERAL INVENTORY",
            categories: [
                ["Equipment", "briefcase"],
                ["Other", "folder"]
            ]
        }

    ];

    /* =================================================
       CATEGORY ICONS
    ================================================= */

    const icons = {

        link: `
            <rect x="2" y="7" width="9" height="10" rx="4"/>
            <rect x="13" y="7" width="9" height="10" rx="4"/>
            <path d="M8 12h8"/>
        `,

        circle: `
            <circle cx="12" cy="12" r="9"/>
            <rect x="9" y="2" width="6" height="5" rx="1"/>
        `,

        rope: `
            <path d="M5 5c0-4 14-4 14 0s-14 4-14 8
            14 4 14 0S5 9 5 17s14 5 14 0"/>
        `,

        mask: `
            <path d="M3 7c6-4 12-4 18 0v8
            c-3 5-6 6-9 2-3 4-6 3-9-2z"/>
            <ellipse cx="7" cy="11" rx="2" ry="1.5"/>
            <ellipse cx="17" cy="11" rx="2" ry="1.5"/>
        `,

        feather: `
            <path d="M4 20L19 5"/>
            <path d="M7 17C0 7 14 1 21 3
            c2 8-5 20-14 14z"/>
            <path d="M12 12h6M12 12V6"/>
        `,

        layers: `
            <path d="M12 2L2 8l10 6 10-6z"/>
            <path d="M2 12l10 6 10-6"/>
            <path d="M2 16l10 6 10-6"/>
        `,

        box: `
            <rect x="3" y="3" width="18" height="18" rx="3"/>
            <path d="M3 9h18M9 3v18"/>
        `,

        drop: `
            <path d="M12 2C9 7 4 12 4 16
            a8 8 0 0 0 16 0c0-4-5-9-8-14z"/>
        `,

        shield: `
            <path d="M12 2L3 6v7
            c0 5 9 9 9 9s9-4 9-9V6z"/>
        `,

        shirt: `
            <path d="M8 3L2 7l3 6 3-2v10h8V11
            l3 2 3-6-6-4"/>
            <path d="M8 3a4 4 0 0 0 8 0"/>
        `,

        hand: `
            <path d="M7 12V5a1.5 1.5 0 0 1 3 0v6
            V3a1.5 1.5 0 0 1 3 0v8
            V5a1.5 1.5 0 0 1 3 0v7
            V8a1.5 1.5 0 0 1 3 0v8
            c0 4-3 6-7 6s-6-2-8-5l-2-4
            c-1-3 2-4 5-1z"/>
        `,

        foot: `
            <ellipse cx="10" cy="15" rx="5" ry="7"/>
            <circle cx="7" cy="4" r="2"/>
            <circle cx="12" cy="3" r="1.5"/>
            <circle cx="16" cy="5" r="1.5"/>
        `,

        gem: `
            <path d="M3 8l4-5h10l4 5-9 13z"/>
            <path d="M3 8h18M7 3l5 18 5-18"/>
        `,

        package: `
            <path d="M3 6l9-4 9 4v12l-9 4-9-4z"/>
            <path d="M3 6l9 4 9-4M12 10v12"/>
        `,

        chair: `
            <rect x="5" y="3" width="14" height="11" rx="3"/>
            <path d="M3 12v6h18v-6M5 18v4M19 18v4"/>
        `,

        tool: `
            <path d="M14 6l4-4 4 4-4 4-4-1
            -9 12-3-3 12-9z"/>
        `,

        safety: `
            <path d="M12 2L3 6v7
            c0 5 9 9 9 9s9-4 9-9V6z"/>
            <path d="M7 12l3 3 7-7"/>
        `,

        clean: `
            <rect x="7" y="9" width="10" height="13" rx="2"/>
            <path d="M10 9V5h5v4M10 5V2h9M19 2v3"/>
        `,

        briefcase: `
            <rect x="2" y="7" width="20" height="14" rx="2"/>
            <path d="M8 7V3h8v4M2 13h20M10 13v3h4v-3"/>
        `,

        folder: `
            <path d="M2 5h8l3 3h9v13H2z"/>
        `

    };

    /* =================================================
       DOM ELEMENTS
    ================================================= */

    const elements = {

        form: document.getElementById("itemForm"),
        itemId: document.getElementById("itemId"),
        name: document.getElementById("itemName"),
        category: document.getElementById("itemCategory"),
        status: document.getElementById("itemStatus"),
        location: document.getElementById("itemLocation"),
        description: document.getElementById("itemDescription"),
        image: document.getElementById("itemImageFile"),
        imagePreview: document.getElementById("currentImagePreview"),

        formTitle: document.getElementById("formTitle"),
        formMessage: document.getElementById("formMessage"),
        saveButton: document.getElementById("saveButton"),
        cancelButton: document.getElementById("cancelEditButton"),

        grid: document.getElementById("inventoryGrid"),
        search: document.getElementById("searchInput"),
        filterCategory: document.getElementById("filterCategory"),
        filterStatus: document.getElementById("filterStatus"),

        connection: document.getElementById("connectionStatus"),
        total: document.getElementById("totalCount"),
        available: document.getElementById("availableCount"),
        inUse: document.getElementById("inUseCount"),
        storage: document.getElementById("storageCount"),

        logout: document.getElementById("logoutButton"),

        categoryGroups: document.getElementById(
            "inventoryCategoryGroups"
        ),

        showAll: document.getElementById(
            "showAllCategories"
        ),

        activeCategory: document.getElementById(
            "activeCategoryName"
        ),

        resultCount: document.getElementById(
            "inventoryResultCount"
        ),

        clearFilters: document.getElementById(
            "clearInventoryFilters"
        ),

        editor: document.getElementById(
            "inventoryEditor"
        )

    };

    /* =================================================
       HELPERS
    ================================================= */

    function makeElement(tag, className, text) {

        const element = document.createElement(tag);

        if (className) {
            element.className = className;
        }

        if (text !== undefined) {
            element.textContent = text;
        }

        return element;

    }

    function setMessage(message, isError = false) {

        elements.formMessage.textContent = message;

        elements.formMessage.classList.toggle(
            "error",
            isError
        );

    }

    function setConnection(message, isError = false) {

        elements.connection.textContent = message;

        elements.connection.classList.toggle(
            "error",
            isError
        );

    }

    function createIcon(name) {

        const wrapper = makeElement(
            "span",
            "inventory-category-icon"
        );

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
                ${icons[name] || icons.folder}
            </svg>

        `;

        return wrapper;

    }

    /* =================================================
       CATEGORY NAVIGATION
    ================================================= */

    function buildCategories() {

        if (!elements.categoryGroups) return;

        elements.categoryGroups.replaceChildren();

        categoryGroups.forEach(group => {

            const section = makeElement(
                "section",
                "inventory-category-group"
            );

            const heading = makeElement(
                "h4",
                "inventory-group-title",
                group.name
            );

            const grid = makeElement(
                "div",
                "inventory-category-grid"
            );

            group.categories.forEach(([name, icon]) => {

                const button = makeElement(
                    "button",
                    "inventory-category-tile"
                );

                button.type = "button";

                button.dataset.category = name;

                button.setAttribute(
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

                top.append(
                    createIcon(icon),
                    count
                );

                const title = makeElement(
                    "span",
                    "inventory-category-name",
                    name.toUpperCase()
                );

                button.append(top, title);

                button.addEventListener("click", () => {

                    selectCategory(name, true);

                });

                grid.appendChild(button);

            });

            section.append(heading, grid);

            elements.categoryGroups.appendChild(section);

        });

        updateCategoryNavigation();

    }

    function updateCategoryNavigation() {

        const selected = elements.filterCategory.value;

        if (elements.categoryGroups) {

            const tiles =
                elements.categoryGroups.querySelectorAll(
                    ".inventory-category-tile"
                );

            tiles.forEach(tile => {

                const category = tile.dataset.category;

                const count = inventory.filter(
                    item => item.category === category
                ).length;

                const countElement = tile.querySelector(
                    ".inventory-category-count"
                );

                countElement.textContent = count;

                tile.classList.toggle(
                    "is-active",
                    selected === category
                );

                tile.setAttribute(
                    "aria-pressed",
                    String(selected === category)
                );

                tile.classList.toggle(
                    "is-empty",
                    count === 0
                );

            });

        }

        if (elements.activeCategory) {

            elements.activeCategory.textContent =
                selected
                    ? selected.toUpperCase()
                    : "ALL ITEMS";

        }

        if (elements.showAll) {

            elements.showAll.classList.toggle(
                "is-active",
                !selected
            );

            elements.showAll.setAttribute(
                "aria-pressed",
                String(!selected)
            );

        }

    }

    function selectCategory(category, scroll = false) {

        elements.filterCategory.value = category;

        updateCategoryNavigation();

        renderInventory();

        if (scroll) {

            const target = document.querySelector(
                ".inventory-list-section"
            );

            if (target) {

                target.scrollIntoView({

                    behavior: window.matchMedia(
                        "(prefers-reduced-motion: reduce)"
                    ).matches ? "auto" : "smooth",

                    block: "start"

                });

            }

        }

    }

    function clearFilters() {

        elements.search.value = "";
        elements.filterStatus.value = "";

        selectCategory("");

    }

    /* =================================================
       SUPPORT EXISTING CUSTOM CATEGORIES
    ================================================= */

    function ensureCategoryOption(select, category) {

        if (!category) return;

        const exists = Array.from(select.options).some(
            option => option.value === category
        );

        if (!exists) {

            const option = document.createElement("option");

            option.value = category;
            option.textContent = category;

            select.appendChild(option);

        }

    }

    function syncExistingCategories() {

        inventory.forEach(item => {

            ensureCategoryOption(
                elements.category,
                item.category
            );

            ensureCategoryOption(
                elements.filterCategory,
                item.category
            );

        });

    }

    /* =================================================
       FORM MANAGEMENT
    ================================================= */

    function resetForm() {

        elements.form.reset();

        elements.itemId.value = "";

        editingImagePath = null;

        elements.formTitle.textContent = "ADD NEW ITEM";

        elements.saveButton.textContent = "SAVE ITEM";

        elements.cancelButton.hidden = true;

        elements.imagePreview.replaceChildren();

        setMessage("");

    }

    /* =================================================
       PRIVATE IMAGE STORAGE
    ================================================= */

    async function getSignedImage(path) {

        if (!path) return null;

        const { data, error } = await supabaseClient.storage
            .from(BUCKET)
            .createSignedUrl(path, 3600);

        if (error) {

            console.error("Image URL error:", error);

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

            throw new Error("Unsupported image format.");

        }

        if (file.size > MAX_FILE_SIZE) {

            throw new Error("Image is larger than 10 MB.");

        }

        const safeName = file.name
            .toLowerCase()
            .replace(/[^a-z0-9._-]/g, "-");

        const imagePath =
            user.id + "/" +
            crypto.randomUUID() + "-" +
            safeName;

        const { error } = await supabaseClient.storage
            .from(BUCKET)
            .upload(imagePath, file, {

                cacheControl: "3600",
                upsert: false,
                contentType: file.type

            });

        if (error) throw error;

        return imagePath;

    }

    async function removeImage(path) {

        if (!path) return;

        const { error } = await supabaseClient.storage
            .from(BUCKET)
            .remove([path]);

        if (error) {

            console.error(
                "Could not remove image:",
                error
            );

        }

    }

    /* =================================================
       LOAD INVENTORY
    ================================================= */

    async function loadInventory() {

        const version = ++loadVersion;

        setConnection("SYNCHRONIZING...");

        const { data, error } = await supabaseClient
            .from("inventory_items")
            .select("*")
            .order("created_at", {
                ascending: false
            });

        if (version !== loadVersion) return;

        if (error) {

            console.error(error);

            setConnection("DATABASE ERROR", true);

            elements.grid.textContent =
                "Could not load inventory. " +
                "Check database permissions.";

            return;

        }

        inventory = data || [];

        syncExistingCategories();

        setConnection("DATABASE ONLINE");

        updateStatistics();

        updateCategoryNavigation();

        await renderInventory();

    }

    /* =================================================
       STATISTICS
    ================================================= */

    function updateStatistics() {

        elements.total.textContent = inventory.length;

        elements.available.textContent = inventory.filter(
            item => item.status === "AVAILABLE"
        ).length;

        elements.inUse.textContent = inventory.filter(
            item => item.status === "IN USE"
        ).length;

        elements.storage.textContent = inventory.filter(
            item => item.status === "STORAGE"
        ).length;

    }

    /* =================================================
       IMAGE LIGHTBOX
    ================================================= */

    function openImage(url, name) {

        const dialog = makeElement(
            "dialog",
            "inventory-lightbox"
        );

        const closeButton = makeElement(
            "button",
            "inventory-lightbox-close",
            "CLOSE ×"
        );

        closeButton.type = "button";

        const image = document.createElement("img");

        image.src = url;
        image.alt = name || "Inventory image";

        const caption = makeElement(
            "p",
            "inventory-lightbox-caption",
            name || ""
        );

        dialog.append(
            closeButton,
            image,
            caption
        );

        document.body.appendChild(dialog);

        closeButton.addEventListener("click", () => {

            dialog.close();

        });

        dialog.addEventListener("click", event => {

            if (event.target === dialog) {

                dialog.close();

            }

        });

        dialog.addEventListener("close", () => {

            dialog.remove();

        });

        dialog.showModal();

    }

    /* =================================================
       RENDER INVENTORY
    ================================================= */

    async function renderInventory() {

        const version = ++renderVersion;

        const searchTerm = elements.search.value
            .toLowerCase()
            .trim();

        const categoryFilter =
            elements.filterCategory.value;

        const statusFilter =
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

                searchable.includes(searchTerm) &&

                (
                    !categoryFilter ||
                    item.category === categoryFilter
                ) &&

                (
                    !statusFilter ||
                    item.status === statusFilter
                )

            );

        });

        if (elements.resultCount) {

            elements.resultCount.textContent =
                `${filtered.length} / ${inventory.length} ITEMS`;

        }

        elements.grid.replaceChildren();

        if (filtered.length === 0) {

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

            filtered.map(async item => {

                const card = makeElement(
                    "article",
                    "inventory-card"
                );

                /* IMAGE */

                const imageFrame = makeElement(
                    "div",
                    "inventory-image-frame"
                );

                let imageUrl = null;

                if (item.image_path) {

                    imageUrl = await getSignedImage(
                        item.image_path
                    );

                }

                if (imageUrl) {

                    const image = document.createElement("img");

                    image.className = "inventory-image";

                    image.src = imageUrl;

                    image.alt = item.name || "";

                    image.loading = "lazy";

                    const imageButton = makeElement(
                        "button",
                        "inventory-image-button"
                    );

                    imageButton.type = "button";

                    imageButton.setAttribute(
                        "aria-label",
                        "View image: " + (item.name || "")
                    );

                    imageButton.appendChild(image);

                    imageButton.addEventListener("click", () => {

                        openImage(imageUrl, item.name);

                    });

                    imageFrame.appendChild(imageButton);

                } else {

                    const placeholder = makeElement(
                        "div",
                        "inventory-image-placeholder"
                    );

                    placeholder.append(

                        createIcon("package"),

                        makeElement(
                            "span",
                            "",
                            "NO IMAGE AVAILABLE"
                        )

                    );

                    imageFrame.appendChild(placeholder);

                }

                card.appendChild(imageFrame);

                /* CONTENT */

                const content = makeElement(
                    "div",
                    "inventory-content"
                );

                content.appendChild(

                    makeElement(
                        "p",
                        "inventory-category",
                        item.category || "Other"
                    )

                );

                content.appendChild(

                    makeElement(
                        "h3",
                        "inventory-item-name",
                        item.name || "Unnamed item"
                    )

                );

                /* STATUS */

                const status = makeElement(
                    "span",
                    "inventory-status",
                    item.status || "UNKNOWN"
                );

                status.dataset.status = item.status || "";

                content.appendChild(status);

                /* LOCATION */

                if (item.location) {

                    content.appendChild(

                        makeElement(
                            "p",
                            "inventory-detail",
                            "LOCATION: " + item.location
                        )

                    );

                }

                /* DESCRIPTION */

                if (item.description) {

                    content.appendChild(

                        makeElement(
                            "p",
                            "inventory-description",
                            item.description
                        )

                    );

                }

                /* OWNER ACTIONS */

                if (item.owner_id === user.id) {

                    const actions = makeElement(
                        "div",
                        "inventory-action"
                    );

                    const editButton = makeElement(
                        "button",
                        "",
                        "EDIT"
                    );

                    editButton.type = "button";

                    editButton.addEventListener("click", () => {

                        editItem(item);

                    });

                    const deleteButton = makeElement(
                        "button",
                        "delete-action",
                        "DELETE"
                    );

                    deleteButton.type = "button";

                    deleteButton.addEventListener("click", () => {

                        deleteItem(item);

                    });

                    actions.append(
                        editButton,
                        deleteButton
                    );

                    content.appendChild(actions);

                }

                card.appendChild(content);

                return card;

            })

        );

        if (version !== renderVersion) return;

        elements.grid.replaceChildren(...cards);

    }

    /* =================================================
       EDIT ITEM
    ================================================= */

    function editItem(item) {

        if (item.owner_id !== user.id || saving) return;

        ensureCategoryOption(
            elements.category,
            item.category
        );

        elements.itemId.value = item.id;

        elements.name.value = item.name || "";

        elements.category.value =
            item.category || "Other";

        elements.status.value =
            item.status || "AVAILABLE";

        elements.location.value =
            item.location || "";

        elements.description.value =
            item.description || "";

        elements.image.value = "";

        editingImagePath = item.image_path || null;

        elements.formTitle.textContent = "EDIT ITEM";

        elements.saveButton.textContent = "UPDATE ITEM";

        elements.cancelButton.hidden = false;

        elements.imagePreview.replaceChildren();

        if (elements.editor) {

            elements.editor.open = true;

        }

        if (item.image_path) {

            getSignedImage(item.image_path).then(url => {

                if (!url) return;

                if (elements.itemId.value !== String(item.id)) {
                    return;
                }

                const image = document.createElement("img");

                image.src = url;

                image.alt = "Current item image";

                image.className =
                    "inventory-preview-image";

                elements.imagePreview.replaceChildren(image);

            });

        }

        setMessage("Editing selected record.");

        elements.form.scrollIntoView({

            behavior: window.matchMedia(
                "(prefers-reduced-motion: reduce)"
            ).matches ? "auto" : "smooth"

        });

    }

    /* =================================================
       SAVE ITEM
    ================================================= */

    async function saveItem(event) {

        event.preventDefault();

        if (saving) return;

        const name = elements.name.value.trim();

        if (!name) {

            setMessage("Item name is required.", true);

            return;

        }

        const category = elements.category.value;

        if (!category) {

            setMessage("Select a category.", true);

            return;

        }

        const itemId = elements.itemId.value;

        const selectedFile = elements.image.files[0];

        const previousImage = editingImagePath;

        if (itemId) {

            const existingItem = inventory.find(
                item => String(item.id) === itemId
            );

            if (!existingItem ||
                existingItem.owner_id !== user.id) {

                setMessage("Access denied.", true);

                return;

            }

        }

        const payload = {

            name,

            category,

            status: elements.status.value,

            location:
                elements.location.value.trim() || null,

            description:
                elements.description.value.trim() || null,

            image_path: previousImage,

            updated_at: new Date().toISOString()

        };

        saving = true;

        elements.saveButton.disabled = true;

        elements.cancelButton.disabled = true;

        elements.saveButton.textContent = "SAVING...";

        let uploadedPath = null;
        let committed = false;

        try {

            if (selectedFile) {

                uploadedPath = await uploadImage(
                    selectedFile
                );

                payload.image_path = uploadedPath;

            }

            let result;

            if (itemId) {

                result = await supabaseClient
                    .from("inventory_items")
                    .update(payload)
                    .eq("id", itemId)
                    .eq("owner_id", user.id)
                    .select()
                    .single();

            } else {

                result = await supabaseClient
                    .from("inventory_items")
                    .insert({

                        ...payload,

                        owner_id: user.id

                    })
                    .select()
                    .single();

            }

            if (result.error) throw result.error;

            committed = true;

            if (uploadedPath && previousImage) {

                await removeImage(previousImage);

            }

            resetForm();

            setMessage("Record saved successfully.");

            await loadInventory();

        } catch (error) {

            console.error("Save error:", error);

            if (uploadedPath && !committed) {

                await removeImage(uploadedPath);

            }

            setMessage(

                committed
                    ? "Record saved. Refresh the inventory."
                    : error.message || "Could not save item.",

                true

            );

        } finally {

            saving = false;

            elements.saveButton.disabled = false;

            elements.cancelButton.disabled = false;

            elements.saveButton.textContent =
                elements.itemId.value
                    ? "UPDATE ITEM"
                    : "SAVE ITEM";

        }

    }

    /* =================================================
       DELETE ITEM
    ================================================= */

    async function deleteItem(item) {

        if (item.owner_id !== user.id || saving) return;

        const confirmed = window.confirm(

            'Delete "' + item.name + '" permanently?'

        );

        if (!confirmed) return;

        try {

            const { data, error } = await supabaseClient
                .from("inventory_items")
                .delete()
                .eq("id", item.id)
                .eq("owner_id", user.id)
                .select("id")
                .single();

            if (error) throw error;

            if (!data) {

                throw new Error(
                    "Record was not deleted."
                );

            }

            await removeImage(item.image_path);

            if (
                elements.itemId.value === String(item.id)
            ) {

                resetForm();

            }

            await loadInventory();

        } catch (error) {

            console.error("Delete error:", error);

            window.alert(

                "Could not delete item: " + error.message

            );

        }

    }

    /* =================================================
       REALTIME SYNCHRONIZATION
    ================================================= */

    function subscribeToRealtime() {

        realtimeChannel = supabaseClient

            .channel("inventory-items-live")

            .on(

                "postgres_changes",

                {

                    event: "*",

                    schema: "public",

                    table: "inventory_items"

                },

                () => {

                    loadInventory();

                }

            )

            .subscribe(status => {

                if (status === "SUBSCRIBED") {

                    setConnection(

                        "DATABASE ONLINE // LIVE SYNC ACTIVE"

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

    if (elements.showAll) {

        elements.showAll.addEventListener(

            "click",

            () => selectCategory("")

        );

    }

    if (elements.clearFilters) {

        elements.clearFilters.addEventListener(

            "click",

            clearFilters

        );

    }

    /* =================================================
       LOGOUT
    ================================================= */

    elements.logout.addEventListener("click", async () => {

        const { error } =
            await supabaseClient.auth.signOut();

        if (error) {

            window.alert(

                "Could not log out: " + error.message

            );

            return;

        }

        window.location.replace("index.html");

    });

    /* =================================================
       INITIALIZATION
    ================================================= */

    if (elements.editor) {

        elements.editor.open = false;

    }

    buildCategories();

    await loadInventory();

    subscribeToRealtime();

    window.addEventListener("beforeunload", () => {

        if (realtimeChannel) {

            supabaseClient.removeChannel(

                realtimeChannel

            );

        }

    });

})();

/* =====================================================
   END OF FILE
   THE DEN © 2026
===================================================== */
