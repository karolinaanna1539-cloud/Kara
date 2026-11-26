
/* =====================================================
   THE DEN // KINK LIST MODULE
===================================================== */

(async function () {

    "use strict";

    const supabase = window.archiveSupabase;
    const session = await window.archiveAuthReady;

    if (!supabase || !session) return;

    const ADMIN_ID =
        "3d4c3c65-3956-46b3-a83d-aae7e671c0ff";

    const isAdmin = session.user.id === ADMIN_ID;

    const BUCKET = "doll-kink-gallery";

    const dollId = new URLSearchParams(
        window.location.search
    ).get("id");

    if (!dollId) return;

    const root = document.getElementById("dollKinkList");

    if (!root) return;

    const STATUSES = [
        "PREFERRED",
        "AVAILABLE",
        "NEGOTIABLE",
        "LIMITED",
        "HARD LIMIT",
        "NOT SPECIFIED"
    ];

    const CATEGORIES = [
        "BONDAGE",
        "FETISH CLOTHING",
        "SENSORY PLAY",
        "ROLEPLAY",
        "RESTRAINTS",
        "POWER EXCHANGE",
        "OBJECTIFICATION",
        "OTHER"
    ];

    let records = [];
    let activeId = null;
    let busy = false;

    const $ = id => document.getElementById(id);

    function element(tag, className = "", text = "") {

        const node = document.createElement(tag);

        if (className) node.className = className;

        if (text) node.textContent = text;

        return node;

    }

    function button(text, className, action) {

        const node = element(
            "button",
            className,
            text
        );

        node.type = "button";

        node.addEventListener("click", action);

        return node;

    }

    function message(text, type = "") {

        $("kinkMessage").textContent = text;

        $("kinkMessage").dataset.type = type;

    }

    async function runAction(action) {

        if (busy) return;

        busy = true;

        try {

            await action();

        } catch (error) {

            console.error(error);

            message(
                error.message || "Operation failed.",
                "error"
            );

        } finally {

            busy = false;

        }

    }

    /* =================================================
       MODULE STRUCTURE
    ================================================= */

    root.innerHTML = `
        <div class="kl-header">

            <div>
                <p class="kl-label">
                    PERSONAL PROFILE MODULE
                </p>

                <h3>KINK LIST</h3>

                <p class="kl-subtitle">
                    PREFERENCES & DOCUMENTATION
                </p>
            </div>

            <span id="kinkCount" class="kl-count">
                0 ENTRIES
            </span>

        </div>

        <p id="kinkMessage"
           class="kl-message"
           aria-live="polite">
        </p>

        <div id="kinkAdmin" hidden>

            <button type="button"
                    id="kinkAddButton"
                    class="kl-button">
                + ADD NEW ENTRY
            </button>

            <form id="kinkForm"
                  class="kl-form"
                  hidden>

                <h4 id="kinkFormTitle">
                    NEW ENTRY
                </h4>

                <input type="hidden" id="kinkEditId">

                <label for="kinkName">NAME</label>

                <input id="kinkName"
                       type="text"
                       maxlength="100"
                       required>

                <label for="kinkCategory">
                    CATEGORY
                </label>

                <input id="kinkCategory"
                       list="kinkCategoryList"
                       maxlength="100"
                       required>

                <datalist id="kinkCategoryList">
                </datalist>

                <label for="kinkStatus">STATUS</label>

                <select id="kinkStatus"></select>

                <label for="kinkDescription">
                    DESCRIPTION
                </label>

                <textarea id="kinkDescription"
                          rows="5"
                          maxlength="5000">
                </textarea>

                <label for="kinkLimitations">
                    LIMITATIONS
                </label>

                <textarea id="kinkLimitations"
                          rows="4"
                          maxlength="5000">
                </textarea>

                <label for="kinkSortOrder">
                    DISPLAY ORDER
                </label>

                <input id="kinkSortOrder"
                       type="number"
                       min="0"
                       max="9999"
                       value="0">

                <div class="kl-actions">

                    <button type="submit"
                            class="kl-button">
                        SAVE ENTRY
                    </button>

                    <button type="button"
                            id="kinkCancelButton"
                            class="kl-button secondary">
                        CANCEL
                    </button>

                </div>

            </form>

        </div>

        <div class="kl-toolbar">

            <input id="kinkSearch"
                   type="search"
                   placeholder="Search entries...">

            <select id="kinkStatusFilter">
                <option value="">
                    ALL STATUSES
                </option>
            </select>

        </div>

        <div id="kinkGrid"></div>

        <div id="kinkDetails" hidden></div>

    `;

    /* =================================================
       INITIAL CONFIGURATION
    ================================================= */

    $("kinkAdmin").hidden = !isAdmin;

    for (const status of STATUSES) {

        const option = element(
            "option",
            "",
            status
        );

        option.value = status;

        $("kinkStatus").appendChild(option);

        $("kinkStatusFilter").appendChild(
            option.cloneNode(true)
        );

    }

    function updateCategoryList() {

        const categories = new Set([
            ...CATEGORIES,
            ...records.map(item => item.category)
        ]);

        $("kinkCategoryList").replaceChildren();

        for (const category of categories) {

            const option = document.createElement("option");

            option.value = category;

            $("kinkCategoryList").appendChild(option);

        }

    }

    /* =================================================
       STATUS LABEL
    ================================================= */

    function statusBadge(status) {

        const badge = element(
            "span",
            "kl-status",
            status || "NOT SPECIFIED"
        );

        badge.dataset.status =
            status || "NOT SPECIFIED";

        return badge;

    }

    /* =================================================
       LOAD ENTRIES
    ================================================= */

    async function loadEntries() {

        const { data, error } = await supabase

            .from("doll_kinks")

            .select("*")

            .eq("doll_id", dollId)

            .order("sort_order")

            .order("name");

        if (error) throw error;

        records = data || [];

        $("kinkCount").textContent =
            records.length + " ENTRIES";

        updateCategoryList();

        renderEntries();

        if (activeId) {

            const selected = records.find(
                item => item.id === activeId
            );

            if (selected) {

                await openEntry(selected.id);

            } else {

                closeEntry();

            }

        }

    }

    /* =================================================
       RENDER CATEGORY GROUPS
    ================================================= */

    function renderEntries() {

        const grid = $("kinkGrid");

        grid.replaceChildren();

        const search = $("kinkSearch")
            .value.trim().toLowerCase();

        const status = $("kinkStatusFilter").value;

        const filtered = records.filter(item => {

            const matchesSearch = [
                item.name,
                item.category,
                item.description
            ].join(" ").toLowerCase().includes(search);

            const matchesStatus =
                !status || item.status === status;

            return matchesSearch && matchesStatus;

        });

        if (!filtered.length) {

            grid.appendChild(
                element(
                    "p",
                    "kl-empty",
                    "NO ENTRIES FOUND."
                )
            );

            return;

        }

        const groups = new Map();

        for (const item of filtered) {

            if (!groups.has(item.category)) {

                groups.set(item.category, []);

            }

            groups.get(item.category).push(item);

        }

        for (const [category, items] of groups) {

            const section = element(
                "section",
                "kl-category"
            );

            section.appendChild(
                element("h4", "kl-category-title", category)
            );

            const tiles = element(
                "div",
                "kl-grid"
            );

            for (const item of items) {

                const tile = button(
                    "",
                    "kl-tile",
                    () => {

                        if (busy) return;

                        if (activeId === item.id) {

                            closeEntry();

                        } else {

                            openEntry(item.id).catch(error =>
                                message(error.message, "error")
                            );

                        }

                    }
                );

                tile.dataset.id = item.id;

                tile.classList.toggle(
                    "active",
                    activeId === item.id
                );

                tile.setAttribute(
                    "aria-expanded",
                    String(activeId === item.id)
                );

                tile.append(

                    element(
                        "strong",
                        "kl-tile-name",
                        item.name
                    ),

                    statusBadge(item.status),

                    element(
                        "span",
                        "kl-tile-action",
                        "VIEW DETAILS +"
                    )

                );

                tiles.appendChild(tile);

            }

            section.appendChild(tiles);

            grid.appendChild(section);

        }

    }

    /* =================================================
       ENTRY EDITOR
    ================================================= */

    function openEditor(item = null) {

        if (!isAdmin || busy) return;

        $("kinkForm").reset();

        $("kinkEditId").value = item?.id || "";

        $("kinkName").value = item?.name || "";

        $("kinkCategory").value =
            item?.category || "OTHER";

        $("kinkStatus").value =
            item?.status || "NOT SPECIFIED";

        $("kinkDescription").value =
            item?.description || "";

        $("kinkLimitations").value =
            item?.limitations || "";

        $("kinkSortOrder").value =
            item?.sort_order ?? 0;

        $("kinkFormTitle").textContent =
            item ? "EDIT ENTRY" : "NEW ENTRY";

        $("kinkForm").hidden = false;

        $("kinkForm").scrollIntoView({
            behavior: "smooth",
            block: "nearest"
        });

    }

    function closeEditor() {

        $("kinkForm").hidden = true;

        $("kinkForm").reset();

        $("kinkEditId").value = "";

    }

    $("kinkAddButton").addEventListener(
        "click",
        () => openEditor()
    );

    $("kinkCancelButton").addEventListener(
        "click",
        closeEditor
    );

    $("kinkForm").addEventListener(
        "submit",
        event => {

            event.preventDefault();

            if (!isAdmin) return;

            runAction(async () => {

                const id = $("kinkEditId").value;

                const payload = {

                    doll_id: dollId,

                    name: $("kinkName").value.trim(),

                    category: $("kinkCategory")
                        .value.trim().toUpperCase(),

                    status: $("kinkStatus").value,

                    description: $("kinkDescription")
                        .value.trim(),

                    limitations: $("kinkLimitations")
                        .value.trim(),

                    sort_order: Number(
                        $("kinkSortOrder").value || 0
                    )

                };

                if (!payload.name || !payload.category) {

                    throw new Error(
                        "Name and category are required."
                    );

                }

                const query = id

                    ? supabase
                        .from("doll_kinks")
                        .update(payload)
                        .eq("id", id)
                        .eq("doll_id", dollId)

                    : supabase
                        .from("doll_kinks")
                        .insert(payload);

                const { data, error } = await query

                    .select("id")

                    .single();

                if (error) throw error;

                activeId = data.id;

                closeEditor();

                await loadEntries();

                message(
                    "Entry saved successfully.",
                    "success"
                );

            });

        }
    );

    /* =================================================
       OPEN INDIVIDUAL ENTRY
    ================================================= */

    function closeEntry() {

        activeId = null;

        $("kinkDetails").hidden = true;

        $("kinkDetails").replaceChildren();

        renderEntries();

    }

    async function openEntry(id) {

        const item = records.find(
            record => record.id === id
        );

        if (!item) return;

        activeId = id;

        renderEntries();

        const panel = $("kinkDetails");

        panel.replaceChildren();

        panel.hidden = false;

        const header = element(
            "div",
            "kl-detail-header"
        );

        header.append(

            element("h3", "", item.name),

            button(
                "CLOSE ×",
                "kl-button secondary",
                closeEntry
            )

        );

        panel.append(

            header,

            statusBadge(item.status),

            element(
                "h4",
                "kl-section-title",
                "DESCRIPTION"
            ),

            element(
                "p",
                "kl-description",
                item.description || "No description."
            ),

            element(
                "h4",
                "kl-section-title",
                "LIMITATIONS"
            ),

            element(
                "p",
                "kl-description",
                item.limitations || "Not specified."
            )

        );

        if (isAdmin) {

            const actions = element(
                "div",
                "kl-actions"
            );

            actions.append(

                button(
                    "EDIT ENTRY",
                    "kl-button",
                    () => openEditor(item)
                ),

                button(
                    "DELETE ENTRY",
                    "kl-button danger",
                    () => deleteEntry(item)
                )

            );

            panel.appendChild(actions);

        }

        panel.appendChild(
            element(
                "h4",
                "kl-section-title",
                "PHOTO GALLERY"
            )
        );

        const gallery = element(
            "div",
            "kl-gallery"
        );

        panel.appendChild(gallery);

        if (isAdmin) {

            panel.appendChild(
                createUploadForm(item.id)
            );

        }

        await loadGallery(item.id, gallery);

    }

    /* =================================================
       PHOTO GALLERY
    ================================================= */

    async function loadGallery(kinkId, gallery) {

        gallery.replaceChildren(
            element("p", "kl-empty", "LOADING PHOTOS...")
        );

        const { data, error } = await supabase

            .from("doll_kink_gallery")

            .select("*")

            .eq("kink_id", kinkId)

            .order("sort_order")

            .order("created_at");

        if (error) throw error;

        if (!gallery.isConnected) return;

        gallery.replaceChildren();

        if (!data?.length) {

            gallery.appendChild(
                element("p", "kl-empty", "NO PHOTOS YET.")
            );

            return;

        }

        for (const photo of data) {

            const card = element(
                "article",
                "kl-photo-card"
            );

            const { data: signed } =
                await supabase.storage

                    .from(BUCKET)

                    .createSignedUrl(
                        photo.image_path,
                        3600
                    );

            if (!gallery.isConnected) return;

            if (signed?.signedUrl) {

                const image = document.createElement("img");

                image.src = signed.signedUrl;

                image.alt = photo.caption || "Gallery photo";

                image.loading = "lazy";

                const imageButton = button(
                    "",
                    "kl-photo-button",
                    () => showLightbox(
                        signed.signedUrl,
                        image.alt
                    )
                );

                imageButton.appendChild(image);

                card.appendChild(imageButton);

            } else {

                card.appendChild(
                    element(
                        "p",
                        "kl-empty",
                        "IMAGE UNAVAILABLE"
                    )
                );

            }

            if (photo.caption) {

                card.appendChild(
                    element(
                        "p",
                        "kl-photo-caption",
                        photo.caption
                    )
                );

            }

            if (isAdmin) {

                card.appendChild(

                    button(
                        "DELETE PHOTO",
                        "kl-button danger",
                        () => deletePhoto(photo)
                    )

                );

            }

            gallery.appendChild(card);

        }

    }

    /* =================================================
       PHOTO UPLOAD
    ================================================= */

    function createUploadForm(kinkId) {

        const form = element(
            "form",
            "kl-upload-form"
        );

        const files = document.createElement("input");

        files.type = "file";

        files.multiple = true;

        files.required = true;

        files.accept =
            "image/jpeg,image/png,image/webp,image/gif";

        const caption = document.createElement("input");

        caption.type = "text";

        caption.placeholder = "Photo caption (optional)";

        caption.maxLength = 500;

        const submit = element(
            "button",
            "kl-button",
            "UPLOAD PHOTOS"
        );

        submit.type = "submit";

        form.append(

            element("h4", "", "ADD PHOTOS"),

            files,

            caption,

            submit

        );

        form.addEventListener("submit", event => {

            event.preventDefault();

            if (!isAdmin || busy) return;

            runAction(async () => {

                const selected = Array.from(files.files);

                const allowed = {

                    "image/jpeg": "jpg",

                    "image/png": "png",

                    "image/webp": "webp",

                    "image/gif": "gif"

                };

                for (const file of selected) {

                    if (!allowed[file.type]) {

                        throw new Error(
                            "Unsupported image format."
                        );

                    }

                    if (file.size > 10485760) {

                        throw new Error(
                            "Maximum image size is 10 MB."
                        );

                    }

                }

                submit.disabled = true;

                submit.textContent = "UPLOADING...";

                let uploaded = 0;

                try {

                    for (const file of selected) {

                        const path =

                            session.user.id + "/" +

                            dollId + "/" +

                            kinkId + "/" +

                            crypto.randomUUID() + "." +

                            allowed[file.type];

                        const { error: uploadError } =
                            await supabase.storage

                                .from(BUCKET)

                                .upload(path, file, {

                                    contentType: file.type,

                                    upsert: false

                                });

                        if (uploadError) throw uploadError;

                        const { error: insertError } =
                            await supabase

                                .from("doll_kink_gallery")

                                .insert({

                                    kink_id: kinkId,

                                    image_path: path,

                                    caption: caption.value.trim()

                                });

                        if (insertError) {

                            await supabase.storage

                                .from(BUCKET)

                                .remove([path]);

                            throw insertError;

                        }

                        uploaded++;

                    }

                    message(
                        uploaded + " photos uploaded.",
                        "success"
                    );

                } catch (error) {

                    message(
                        uploaded + " photos saved. " +
                        error.message,
                        "error"
                    );

                } finally {

                    submit.disabled = false;

                    submit.textContent = "UPLOAD PHOTOS";

                    if (activeId === kinkId) {

                        await openEntry(kinkId);

                    }

                }

            });

        });

        return form;

    }

    /* =================================================
       DELETE PHOTO
    ================================================= */

    function deletePhoto(photo) {

        if (!isAdmin || busy) return;

        if (!confirm("Delete this photo?")) return;

        runAction(async () => {

            const { error } = await supabase

                .from("doll_kink_gallery")

                .delete()

                .eq("id", photo.id)

                .eq("kink_id", photo.kink_id)

                .select("id")

                .single();

            if (error) throw error;

            const { error: storageError } =
                await supabase.storage

                    .from(BUCKET)

                    .remove([photo.image_path]);

            if (activeId === photo.kink_id) {

                await openEntry(photo.kink_id);

            }

            message(

                storageError

                    ? "Photo record deleted. Storage cleanup failed."

                    : "Photo deleted.",

                storageError ? "error" : "success"

            );

        });

    }

    /* =================================================
       DELETE ENTRY
    ================================================= */

    function deleteEntry(item) {

        if (!isAdmin || busy) return;

        if (!confirm(
            "Delete this entry and all its photos?"
        )) return;

        runAction(async () => {

            const { data: photos, error: galleryError } =
                await supabase

                    .from("doll_kink_gallery")

                    .select("image_path")

                    .eq("kink_id", item.id);

            if (galleryError) throw galleryError;

            const { error } = await supabase

                .from("doll_kinks")

                .delete()

                .eq("id", item.id)

                .eq("doll_id", dollId)

                .select("id")

                .single();

            if (error) throw error;

            let cleanupFailed = false;

            if (photos?.length) {

                const { error: storageError } =
                    await supabase.storage

                        .from(BUCKET)

                        .remove(
                            photos.map(photo => photo.image_path)
                        );

                cleanupFailed = Boolean(storageError);

            }

            closeEntry();

            closeEditor();

            await loadEntries();

            message(

                cleanupFailed

                    ? "Entry deleted. Storage cleanup failed."

                    : "Entry deleted successfully.",

                cleanupFailed ? "error" : "success"

            );

        });

    }

    /* =================================================
       PHOTO LIGHTBOX
    ================================================= */

    const lightbox = element(
        "dialog",
        "kl-lightbox"
    );

    const lightboxImage = document.createElement("img");

    const closeLightbox = button(
        "CLOSE ×",
        "kl-button",
        () => lightbox.close()
    );

    lightbox.append(
        closeLightbox,
        lightboxImage
    );

    document.body.appendChild(lightbox);

    lightbox.addEventListener("click", event => {

        if (event.target === lightbox) {

            lightbox.close();

        }

    });

    lightbox.addEventListener("close", () => {

        lightboxImage.removeAttribute("src");

    });

    function showLightbox(url, alt) {

        lightboxImage.src = url;

        lightboxImage.alt = alt;

        if (!lightbox.open) {

            lightbox.showModal();

        }

    }

    /* =================================================
       FILTERS
    ================================================= */

    $("kinkSearch").addEventListener(
        "input",
        renderEntries
    );

    $("kinkStatusFilter").addEventListener(
        "change",
        renderEntries
    );

    /* =================================================
       INITIALIZATION
    ================================================= */

    try {

        await loadEntries();

    } catch (error) {

        console.error(error);

        message(
            "Unable to load KINK LIST: " + error.message,
            "error"
        );

    }

})();
