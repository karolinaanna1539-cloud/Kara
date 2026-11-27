
/* =====================================================
   THE DEN // DYNAMIC CATEGORY MANAGEMENT
===================================================== */

window.inventoryCategoriesReady = (async function () {

    "use strict";

    const db = window.archiveSupabase;
    const session = await window.archiveAuthReady;

    if (!db || !session) return null;

    const ADMIN_ID =
        "3d4c3c65-3956-46b3-a83d-aae7e671c0ff";

    const isAdmin = session.user.id === ADMIN_ID;

    const BUCKET = "inventory-categories";

    const ICONS = [
        "folder", "link", "circle", "rope",
        "mask", "feather", "layers", "box",
        "drop", "shield", "shirt", "hand",
        "foot", "gem", "package", "chair",
        "tool", "safety", "clean", "briefcase"
    ];

    let categories = [];
    let busy = false;

    const $ = id => document.getElementById(id);

    function element(tag, className, text) {

        const node = document.createElement(tag);

        if (className) node.className = className;

        if (text !== undefined) node.textContent = text;

        return node;

    }

    function button(text, action, className = "") {

        const node = element(
            "button",
            "ic-button " + className,
            text
        );

        node.type = "button";

        node.addEventListener("click", action);

        return node;

    }

    function message(text, error = false) {

        const target = $("icMessage");

        if (!target) return;

        target.textContent = text;

        target.classList.toggle("error", error);

    }

    async function loadCategories() {

        const { data, error } = await db
            .from("inventory_categories")
            .select("*")
            .order("sort_order")
            .order("name");

        if (error) throw error;

        categories = data || [];

        return categories;

    }

    function getPath(record) {

        const names = [record.name];
        const visited = new Set([record.id]);

        let parentId = record.parent_id;

        while (parentId) {

            if (visited.has(parentId)) break;

            visited.add(parentId);

            const parent = categories.find(
                item => item.id === parentId
            );

            if (!parent) break;

            names.unshift(parent.name);

            parentId = parent.parent_id;

        }

        return names.join(" / ");

    }

    function isVisible(record) {

        const visited = new Set();

        let current = record;

        while (current) {

            if (!current.is_active) return false;

            if (visited.has(current.id)) return false;

            visited.add(current.id);

            current = categories.find(
                item => item.id === current.parent_id
            );

        }

        return true;

    }

    async function signedImage(path) {

        if (!path) return null;

        const { data, error } = await db.storage
            .from(BUCKET)
            .createSignedUrl(path, 3600);

        return error ? null : data.signedUrl;

    }

    /* =================================================
       PUBLIC CATEGORY INTERFACE
    ================================================= */

    const api = {

        getAll() {

            return categories.slice();

        },

        getVisible() {

            return categories.filter(isVisible);

        },

        getPath,

        signedImage,

        refresh: loadCategories

    };

    await loadCategories();

    if (!isAdmin) return api;

    /* =================================================
       ADMINISTRATOR PANEL
    ================================================= */

    const root = document.createElement("details");

    root.id = "inventoryCategoryManager";

    root.className = "ic-manager";

    root.innerHTML = `

        <summary class="ic-summary">

            <div>
                <p class="system-label">
                    ADMINISTRATOR ACCESS
                </p>

                <h3>CATEGORY MANAGEMENT</h3>
            </div>

            <span class="ic-arrow">+</span>

        </summary>

        <div class="ic-content">

            <div class="ic-toolbar">

                <button type="button"
                        id="icAdd"
                        class="ic-button primary">
                    + ADD CATEGORY
                </button>

                <button type="button"
                        id="icRefresh"
                        class="ic-button">
                    REFRESH
                </button>

            </div>

            <p id="icMessage"
               class="ic-message"
               aria-live="polite"></p>

            <form id="icForm"
                  class="ic-form"
                  hidden>

                <h4 id="icFormTitle">
                    NEW CATEGORY
                </h4>

                <input type="hidden" id="icId">

                <label for="icName">NAME</label>

                <input id="icName"
                       maxlength="100"
                       required>

                <label for="icType">TYPE</label>

                <select id="icType">

                    <option value="category">
                        CATEGORY / SUBCATEGORY
                    </option>

                    <option value="group">
                        GROUP
                    </option>

                </select>

                <label for="icParent">
                    PARENT CATEGORY / GROUP
                </label>

                <select id="icParent"></select>

                <label for="icDescription">
                    DESCRIPTION
                </label>

                <textarea id="icDescription"
                          rows="3"
                          maxlength="2000"></textarea>

                <label for="icIcon">ICON</label>

                <select id="icIcon"></select>

                <label for="icOrder">
                    DISPLAY ORDER
                </label>

                <input id="icOrder"
                       type="number"
                       min="0"
                       max="99999"
                       value="0">

                <label class="ic-checkbox">

                    <input type="checkbox"
                           id="icActive"
                           checked>

                    VISIBLE IN COLLECTION

                </label>

                <label for="icImage">
                    CATEGORY IMAGE
                </label>

                <input type="file"
                       id="icImage"
                       accept="image/jpeg,image/png,image/webp,image/gif">

                <p class="ic-help">
                    JPG, PNG, WEBP, GIF — maximum 5 MB.
                </p>

                <div id="icPreview"></div>

                <label class="ic-checkbox">

                    <input type="checkbox"
                           id="icRemoveImage">

                    REMOVE CURRENT IMAGE

                </label>

                <div class="ic-toolbar">

                    <button type="submit"
                            class="ic-button primary">
                        SAVE CATEGORY
                    </button>

                    <button type="button"
                            id="icCancel"
                            class="ic-button">
                        CANCEL
                    </button>

                </div>

            </form>

            <input id="icSearch"
                   type="search"
                   placeholder="Search categories...">

            <div id="icList"></div>

        </div>

    `;

    const target = $("inventoryEditor");

    if (!target) return api;

    target.before(root);

    for (const icon of ICONS) {

        const option = element(
            "option",
            "",
            icon.toUpperCase()
        );

        option.value = icon;

        $("icIcon").appendChild(option);

    }

    /* =================================================
       HIERARCHY HELPERS
    ================================================= */

    function isDescendant(record, ancestorId) {

        const visited = new Set();

        let current = record;

        while (current?.parent_id) {

            if (current.parent_id === ancestorId) {

                return true;

            }

            if (visited.has(current.id)) break;

            visited.add(current.id);

            current = categories.find(
                item => item.id === current.parent_id
            );

        }

        return false;

    }

    function populateParents(editId = null) {

        const select = $("icParent");

        select.replaceChildren();

        const empty = element(
            "option",
            "",
            "NO PARENT / ROOT LEVEL"
        );

        empty.value = "";

        select.appendChild(empty);

        for (const record of categories) {

            if (record.id === editId) continue;

            if (
                editId &&
                isDescendant(record, editId)
            ) continue;

            const option = element(
                "option",
                "",
                getPath(record)
            );

            option.value = record.id;

            select.appendChild(option);

        }

    }

    /* =================================================
       CATEGORY LIST
    ================================================= */

    let renderVersion = 0;

    async function renderList() {

        const version = ++renderVersion;

        const list = $("icList");

        list.replaceChildren();

        const search = $("icSearch")
            .value.trim().toLowerCase();

        const records = categories.filter(record =>

            getPath(record)
                .toLowerCase()
                .includes(search)

        );

        if (!records.length) {

            list.appendChild(
                element(
                    "p",
                    "ic-empty",
                    "NO CATEGORIES FOUND."
                )
            );

            return;

        }

        const cards = await Promise.all(

            records.map(async record => {

                const card = element(
                    "article",
                    "ic-card"
                );

                const imageUrl = await signedImage(
                    record.image_path
                );

                if (imageUrl) {

                    const image = element(
                        "img",
                        "ic-card-image"
                    );

                    image.src = imageUrl;
                    image.alt = record.name;
                    image.loading = "lazy";

                    card.appendChild(image);

                }

                const info = element(
                    "div",
                    "ic-card-info"
                );

                info.append(

                    element(
                        "strong",
                        "ic-card-name",
                        record.name
                    ),

                    element(
                        "p",
                        "ic-card-path",
                        getPath(record)
                    ),

                    element(
                        "span",
                        "ic-card-type",
                        record.is_group
                            ? "GROUP"
                            : "CATEGORY"
                    ),

                    element(
                        "span",
                        "ic-card-status",
                        isVisible(record)
                            ? "VISIBLE"
                            : "HIDDEN"
                    )

                );

                const actions = element(
                    "div",
                    "ic-card-actions"
                );

                actions.append(

                    button(
                        "EDIT",
                        () => openEditor(record)
                    ),

                    button(
                        "DELETE",
                        () => deleteCategory(record),
                        "danger"
                    )

                );

                card.append(info, actions);

                return card;

            })

        );

        if (version !== renderVersion) return;

        list.replaceChildren(...cards);

    }

    /* =================================================
       CATEGORY EDITOR
    ================================================= */

    async function openEditor(record = null) {

        if (busy) return;

        $("icForm").reset();

        $("icId").value = record?.id || "";

        $("icName").value = record?.name || "";

        $("icType").value = record?.is_group
            ? "group"
            : "category";

        populateParents(record?.id);

        $("icParent").value =
            record?.parent_id || "";

        $("icDescription").value =
            record?.description || "";

        $("icIcon").value =
            record?.icon || "folder";

        $("icOrder").value =
            record?.sort_order ?? 0;

        $("icActive").checked =
            record?.is_active ?? true;

        $("icRemoveImage").checked = false;

        $("icFormTitle").textContent = record
            ? "EDIT CATEGORY"
            : "NEW CATEGORY";

        $("icPreview").replaceChildren();

        $("icForm").hidden = false;

        $("icName").focus();

        if (record?.image_path) {

            const url = await signedImage(
                record.image_path
            );

            if (
                url &&
                $("icId").value === record.id
            ) {

                const image = element(
                    "img",
                    "ic-preview-image"
                );

                image.src = url;
                image.alt = record.name;

                $("icPreview").appendChild(image);

            }

        }

    }

    function closeEditor() {

        $("icForm").hidden = true;

        $("icForm").reset();

        $("icId").value = "";

        $("icPreview").replaceChildren();

    }

    /* =================================================
       IMAGE STORAGE
    ================================================= */

    async function uploadImage(file) {

        const extensions = {

            "image/jpeg": "jpg",
            "image/png": "png",
            "image/webp": "webp",
            "image/gif": "gif"

        };

        if (!extensions[file.type]) {

            throw new Error(
                "Unsupported image format."
            );

        }

        if (file.size > 5 * 1024 * 1024) {

            throw new Error(
                "Maximum image size is 5 MB."
            );

        }

        const path =

            session.user.id + "/" +

            crypto.randomUUID() + "." +

            extensions[file.type];

        const { error } = await db.storage

            .from(BUCKET)

            .upload(path, file, {

                contentType: file.type,

                upsert: false

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
       SAVE CATEGORY
    ================================================= */

    async function saveCategory(event) {

        event.preventDefault();

        if (!isAdmin || busy) return;

        busy = true;

        const submit = $("icForm")
            .querySelector('[type="submit"]');

        submit.disabled = true;

        submit.textContent = "SAVING...";

        let uploadedPath = null;
        let committed = false;

        try {

            const id = $("icId").value;

            const existing = categories.find(
                record => record.id === id
            );

            const oldImage =
                existing?.image_path || null;

            const payload = {

                name: $("icName").value.trim(),

                parent_id:
                    $("icParent").value || null,

                is_group:
                    $("icType").value === "group",

                description:
                    $("icDescription").value.trim(),

                icon: $("icIcon").value,

                sort_order: Number(
                    $("icOrder").value || 0
                ),

                is_active: $("icActive").checked,

                image_path: oldImage

            };

            if (!payload.name) {

                throw new Error(
                    "Category name is required."
                );

            }

            const file = $("icImage").files[0];

            if (file) {

                uploadedPath = await uploadImage(file);

                payload.image_path = uploadedPath;

            } else if ($("icRemoveImage").checked) {

                payload.image_path = null;

            }

            const query = id

                ? db.from("inventory_categories")
                    .update(payload)
                    .eq("id", id)

                : db.from("inventory_categories")
                    .insert(payload);

            const { error } = await query

                .select("id")

                .single();

            if (error) throw error;

            committed = true;

            let cleanupOK = true;

            if (
                oldImage &&
                oldImage !== payload.image_path
            ) {

                cleanupOK = await removeImage(oldImage);

            }

            closeEditor();

            await refresh();

            message(

                cleanupOK

                    ? "Category saved successfully."

                    : "Category saved. Old image cleanup failed.",

                !cleanupOK

            );

        } catch (error) {

            if (uploadedPath && !committed) {

                await removeImage(uploadedPath);

            }

            message(

                committed

                    ? "Saved, but refresh failed: " +
                        error.message

                    : error.message,

                true

            );

        } finally {

            busy = false;

            submit.disabled = false;

            submit.textContent = "SAVE CATEGORY";

        }

    }

    /* =================================================
       DELETE CATEGORY
    ================================================= */

    async function deleteCategory(record) {

        if (!isAdmin || busy) return;

        if (!confirm(
            "Delete category: " + record.name + "?"
        )) return;

        busy = true;

        try {

            const { error } = await db

                .from("inventory_categories")

                .delete()

                .eq("id", record.id)

                .select("id")

                .single();

            if (error) throw error;

            const cleanupOK = await removeImage(
                record.image_path
            );

            closeEditor();

            await refresh();

            message(

                cleanupOK

                    ? "Category deleted."

                    : "Category deleted. Image cleanup failed.",

                !cleanupOK

            );

        } catch (error) {

            message(error.message, true);

        } finally {

            busy = false;

        }

    }

    /* =================================================
       REFRESH AND SYNCHRONIZATION
    ================================================= */

    async function refresh() {

        await loadCategories();

        await renderList();

        window.dispatchEvent(

            new CustomEvent(
                "inventory-categories-changed"
            )

        );

    }

    $("icAdd").addEventListener(
        "click",
        () => openEditor()
    );

    $("icCancel").addEventListener(
        "click",
        () => {

            if (!busy) closeEditor();

        }
    );

    $("icForm").addEventListener(
        "submit",
        saveCategory
    );

    $("icSearch").addEventListener(
        "input",
        () => renderList()
    );

    $("icRefresh").addEventListener(
        "click",
        async () => {

            if (busy) return;

            try {

                await refresh();

                message("Categories refreshed.");

            } catch (error) {

                message(error.message, true);

            }

        }
    );

    await renderList();

    return api;

})().catch(error => {

    console.error(
        "Category management initialization failed:",
        error
    );

    return null;

});

/* =====================================================
   END OF MODULE
===================================================== */
