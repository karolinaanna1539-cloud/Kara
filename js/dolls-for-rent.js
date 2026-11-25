
/* =====================================================
   THE DEN
   COLLECTION & RESERVATION MANAGEMENT
   MODULE 09
===================================================== */

(async function () {

    "use strict";

    const supabase = window.archiveSupabase;
    const session = await window.archiveAuthReady;

    if (!supabase || !session) return;

    const user = session.user;

    const ADMIN_ID =
        "3d4c3c65-3956-46b3-a83d-aae7e671c0ff";

    const isAdmin = user.id === ADMIN_ID;
    const BUCKET = "dolls-for-rent";

    const $ = id => document.getElementById(id);

    const connection = $("dollsConnection");
    const adminPanel = $("dollsAdminPanel");
    const adminReservations = $("dollsAdminReservations");
    const form = $("dollForm");
    const saveButton = $("dollSaveButton");
    const cancelEditButton = $("dollCancelEdit");
    const formMessage = $("dollAdminMessage");

    const statuses = [
        "pending",
        "confirmed",
        "preparing",
        "ready_for_pickup",
        "active",
        "completed",
        "declined",
        "cancelled"
    ];

    const closedStatuses = [
        "completed",
        "declined",
        "cancelled"
    ];

    const cancellableStatuses = [
        "pending",
        "confirmed",
        "preparing",
        "ready_for_pickup"
    ];

    const categories = {
        clothing: "CLOTHING",
        makeup: "MAKE-UP",
        hairstyle: "HAIRSTYLE",
        nails: "NAILS",
        accessories: "ACCESSORIES"
    };

    let dolls = [];
    let reservations = [];

    let adminFilter = "all";
    let adminSearch = "";

    let dollLoadVersion = 0;
    let reservationLoadVersion = 0;

    let dollBusy = false;
    let reservationWrites = 0;

    let realtimeChannel = null;
    let refreshTimer = null;

    const openRecords = new Set();

    /* =================================================
       GENERAL HELPERS
    ================================================= */

    function makeElement(tag, className, content) {

        const node = document.createElement(tag);

        if (className) {
            node.className = className;
        }

        if (content !== undefined) {
            node.textContent = content;
        }

        return node;

    }

    function makeButton(label, className) {

        const button = makeElement(
            "button",
            className,
            label
        );

        button.type = "button";

        return button;

    }

    function makeLink(label, className, href) {

        const link = makeElement(
            "a",
            className,
            label
        );

        link.href = href;

        return link;

    }

    function statusLabel(status) {

        return String(status || "unknown")
            .replace(/_/g, " ")
            .toUpperCase();

    }

    function reference(record) {

        return "RES-" + String(record.id)
            .slice(0, 8)
            .toUpperCase();

    }

    function formatDate(value) {

        if (!value) return "NOT SPECIFIED";

        const date = new Date(
            value + "T12:00:00Z"
        );

        if (Number.isNaN(date.getTime())) {
            return value;
        }

        return new Intl.DateTimeFormat(
            "en-GB",
            {
                day: "2-digit",
                month: "long",
                year: "numeric",
                timeZone: "UTC"
            }
        ).format(date);

    }

    function formatTime(value) {

        return value
            ? String(value).slice(0, 5)
            : "To be agreed";

    }

    function formatTimestamp(value) {

        if (!value) return "NOT RECORDED";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "NOT RECORDED";
        }

        return new Intl.DateTimeFormat(
            "en-GB",
            {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Europe/Stockholm"
            }
        ).format(date);

    }

    function showMessage(target, message, error = false) {

        target.textContent = message;

        target.className = error
            ? "dolls-form-message error"
            : "dolls-form-message";

    }

    function showReservationMessage(
        target,
        message,
        type = "info"
    ) {

        target.textContent = message;
        target.className = "rm-message " + type;

    }

    function findDoll(id) {

        return dolls.find(doll => doll.id === id);

    }

    function dollName(id) {

        return findDoll(id)?.name || "PROFILE";

    }

    async function getImageUrl(path) {

        if (!path) return null;

        const { data, error } = await supabase
            .storage
            .from(BUCKET)
            .createSignedUrl(path, 3600);

        if (error) {

            console.error(error);
            return null;

        }

        return data?.signedUrl || null;

    }

    /* =================================================
       CUSTOMIZATION ICONS
    ================================================= */

    function createIcon(category) {

        const namespace =
            "http://www.w3.org/2000/svg";

        const svg = document.createElementNS(
            namespace,
            "svg"
        );

        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("aria-hidden", "true");

        const paths = {

            clothing: [
                "M8 3 3 6 1 11l5 2 2-3v11h8V10l2 3 5-2-2-5-5-3",
                "M8 3c0 4 8 4 8 0"
            ],

            makeup: [
                "m14 4 6 6-10 10-6-6Z",
                "m14 4 3-3 6 6-3 3",
                "M4 14c-3 2-3 6-3 8 3 0 7-1 9-2"
            ],

            hairstyle: [
                "M6 6m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0",
                "M6 18m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0",
                "M9 9l12 12",
                "M9 15 21 3"
            ],

            nails: [
                "M8 21V7a4 4 0 0 1 8 0v14Z",
                "M10 8h4v7h-4Z"
            ],

            accessories: [
                "m3 8 4-5h10l4 5-9 13Z",
                "M3 8h18",
                "m7 3 5 18 5-18"
            ]

        };

        for (const definition of paths[category] || []) {

            const path = document.createElementNS(
                namespace,
                "path"
            );

            path.setAttribute("d", definition);

            svg.appendChild(path);

        }

        return svg;

    }

    function createCustomizationOptions() {

        const section = makeElement(
            "div",
            "doll-customization"
        );

        section.appendChild(
            makeElement(
                "p",
                "doll-customization-title",
                "AVAILABLE CUSTOMIZATION CATEGORIES"
            )
        );

        const grid = makeElement(
            "div",
            "doll-options-grid"
        );

        for (const [category, label] of Object.entries(categories)) {

            const tile = makeElement(
                "div",
                "doll-option"
            );

            const icon = makeElement(
                "div",
                "doll-option-icon"
            );

            icon.appendChild(
                createIcon(category)
            );

            tile.append(
                icon,
                makeElement(
                    "span",
                    "doll-option-name",
                    label
                )
            );

            grid.appendChild(tile);

        }

        section.appendChild(grid);

        return section;

    }

    /* =================================================
       LOAD COLLECTION
    ================================================= */

    async function loadDolls() {

        const version = ++dollLoadVersion;

        const { data, error } = await supabase
            .from("dolls")
            .select("*")
            .order("created_at", {
                ascending: false
            });

        if (version !== dollLoadVersion) return;

        if (error) {

            console.error(error);

            $("dollsGrid").replaceChildren(
                makeElement(
                    "p",
                    "dolls-empty",
                    "UNABLE TO LOAD COLLECTION: " +
                    error.message
                )
            );

            return;

        }

        dolls = data || [];

        $("dollsCount").textContent =
            dolls.length + (
                dolls.length === 1
                    ? " DOLL"
                    : " DOLLS"
            );

        await renderDolls(version);

    }

    /* =================================================
       RENDER COLLECTION
    ================================================= */

    async function renderDolls(version) {

        const grid = $("dollsGrid");

        const fragment =
            document.createDocumentFragment();

        if (!dolls.length) {

            fragment.appendChild(
                makeElement(
                    "p",
                    "dolls-empty",
                    "NO PROFILES AVAILABLE."
                )
            );

        }

        for (const doll of dolls) {

            const card = makeElement(
                "article",
                "doll-card"
            );

            const top = makeElement(
                "div",
                "doll-card-top"
            );

            top.append(

                makeElement(
                    "span",
                    "doll-collection-label",
                    "THE DEN // COLLECTION"
                ),

                makeElement(
                    "span",
                    "doll-status",
                    doll.active === true
                        ? "RESERVATIONS OPEN"
                        : "UNAVAILABLE"
                )

            );

            card.appendChild(top);

            const frame = makeElement(
                "div",
                "doll-image-frame"
            );

            const url = await getImageUrl(
                doll.image_path
            );

            if (url) {

                const image =
                    document.createElement("img");

                image.className = "doll-image";
                image.src = url;
                image.alt = doll.name || "Profile image";
                image.loading = "lazy";

                frame.appendChild(image);

            } else {

                frame.appendChild(
                    makeElement(
                        "div",
                        "doll-image-placeholder",
                        "NO IMAGE AVAILABLE"
                    )
                );

            }

            card.append(

                frame,

                makeElement(
                    "h3",
                    "",
                    doll.name || "UNNAMED PROFILE"
                ),

                makeElement(
                    "p",
                    "doll-profile-label",
                    "PERSONAL COLLECTION"
                )

            );

            if (doll.description) {

                card.appendChild(
                    makeElement(
                        "p",
                        "doll-description",
                        doll.description
                    )
                );

            }

            if (doll.details) {

                card.appendChild(
                    makeElement(
                        "p",
                        "doll-details",
                        doll.details
                    )
                );

            }

            card.appendChild(
                createCustomizationOptions()
            );

            const actions = makeElement(
                "div",
                "doll-main-actions"
            );

            actions.appendChild(
                makeLink(
                    "EXPLORE AVAILABLE OPTIONS →",
                    "doll-explore-button",
                    "doll-details.html?id=" +
                    encodeURIComponent(doll.id)
                )
            );

            if (doll.active === true) {

                actions.appendChild(
                    makeLink(
                        "MAKE A RESERVATION",
                        "doll-reserve-button",
                        "doll-reservation.html?id=" +
                        encodeURIComponent(doll.id)
                    )
                );

            } else {

                const unavailable = makeButton(
                    "CURRENTLY UNAVAILABLE",
                    "doll-reserve-button"
                );

                unavailable.disabled = true;

                actions.appendChild(unavailable);

            }

            card.append(

                actions,

                makeElement(
                    "p",
                    "doll-card-footer",
                    "PRIVATE MEMBERS ONLY"
                )

            );

            if (isAdmin) {

                card.appendChild(
                    createDollAdminActions(doll)
                );

            }

            fragment.appendChild(card);

        }

        if (version !== dollLoadVersion) return;

        grid.replaceChildren(fragment);

    }

    /* =================================================
       DOLL ADMINISTRATION
    ================================================= */

    function resetForm() {

        form.reset();

        $("dollEditId").value = "";

        saveButton.textContent = "ADD DOLL";

        cancelEditButton.hidden = true;

        showMessage(formMessage, "");

    }

    function editDoll(doll) {

        if (!isAdmin || dollBusy) return;

        $("dollEditId").value = doll.id;
        $("dollName").value = doll.name || "";
        $("dollDescription").value = doll.description || "";
        $("dollDetails").value = doll.details || "";
        $("dollImage").value = "";

        saveButton.textContent = "SAVE CHANGES";

        cancelEditButton.hidden = false;

        showMessage(formMessage, "");

        adminPanel.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    }

    function createDollAdminActions(doll) {

        const actions = makeElement(
            "div",
            "dolls-admin-actions"
        );

        const edit = makeButton(
            "EDIT",
            "dolls-action-button"
        );

        const remove = makeButton(
            "DELETE",
            "dolls-action-button dolls-delete"
        );

        edit.addEventListener(
            "click",
            () => editDoll(doll)
        );

        remove.addEventListener(
            "click",
            () => deleteDoll(doll, remove)
        );

        actions.append(edit, remove);

        return actions;

    }

    /* =================================================
       DELETE DOLL
    ================================================= */

    async function deleteDoll(doll, button) {

        if (!isAdmin || dollBusy) return;

        if (!confirm(
            'Delete "' + doll.name + '"?'
        )) return;

        dollBusy = true;
        button.disabled = true;
        button.textContent = "DELETING...";

        try {

            const {
                data: gallery,
                error: galleryError
            } = await supabase
                .from("doll_gallery")
                .select("image_path")
                .eq("doll_id", doll.id);

            if (galleryError) throw galleryError;

            const {
                data: physicalGallery,
                error: physicalError
            } = await supabase
                .from("doll_physical_gallery")
                .select("image_path")
                .eq("doll_id", doll.id);

            if (physicalError) throw physicalError;

            const { error } = await supabase
                .from("dolls")
                .delete()
                .eq("id", doll.id)
                .select("id")
                .single();

            if (error) throw error;

            const files = [
                doll.image_path,
                ...(gallery || []).map(
                    item => item.image_path
                )
            ].filter(Boolean);

            const physicalFiles = (
                physicalGallery || []
            ).map(
                item => item.image_path
            ).filter(Boolean);

            const cleanupErrors = [];

            if (files.length) {

                const { error: storageError } =
                    await supabase.storage
                        .from(BUCKET)
                        .remove([...new Set(files)]);

                if (storageError) {
                    cleanupErrors.push(storageError.message);
                }

            }

            if (physicalFiles.length) {

                const { error: storageError } =
                    await supabase.storage
                        .from("doll-physical")
                        .remove([
                            ...new Set(physicalFiles)
                        ]);

                if (storageError) {
                    cleanupErrors.push(storageError.message);
                }

            }

            if (cleanupErrors.length) {

                alert(
                    "Profile deleted, but some storage files could not be removed: " +
                    cleanupErrors.join("; ")
                );

            }

            if ($("dollEditId").value === doll.id) {
                resetForm();
            }

            await loadDolls();
            await loadReservations();

        } catch (error) {

            console.error(error);

            alert(
                "Could not delete profile: " +
                error.message
            );

        } finally {

            dollBusy = false;
            button.disabled = false;
            button.textContent = "DELETE";

        }

    }

    /* =================================================
       SAVE DOLL
    ================================================= */

    if (isAdmin) {

        form.addEventListener(
            "submit",
            async event => {

                event.preventDefault();

                if (dollBusy) return;

                const editId = $("dollEditId").value;

                const oldDoll = findDoll(editId);

                const name = $("dollName")
                    .value.trim();

                const description = $("dollDescription")
                    .value.trim();

                const details = $("dollDetails")
                    .value.trim();

                const file = $("dollImage").files[0];

                const allowedTypes = [
                    "image/jpeg",
                    "image/png",
                    "image/webp",
                    "image/gif"
                ];

                if (!name) {

                    showMessage(
                        formMessage,
                        "PLEASE ENTER A PROFILE NAME.",
                        true
                    );

                    return;

                }

                if (file && (
                    !allowedTypes.includes(file.type) ||
                    file.size > 10 * 1024 * 1024
                )) {

                    showMessage(
                        formMessage,
                        "INVALID IMAGE TYPE OR FILE EXCEEDS 10 MB.",
                        true
                    );

                    return;

                }

                dollBusy = true;
                saveButton.disabled = true;
                cancelEditButton.disabled = true;

                saveButton.textContent = "SAVING...";

                let uploadedPath = null;
                let recordSaved = false;

                try {

                    if (file) {

                        const safeName = file.name.replace(
                            /[^a-zA-Z0-9._-]/g,
                            "_"
                        );

                        const path =
                            user.id + "/" +
                            crypto.randomUUID() +
                            "-" + safeName;

                        const { error: uploadError } =
                            await supabase.storage
                                .from(BUCKET)
                                .upload(path, file, {
                                    contentType: file.type,
                                    upsert: false
                                });

                        if (uploadError) {
                            throw uploadError;
                        }

                        uploadedPath = path;

                    }

                    const payload = {
                        name,
                        description,
                        details
                    };

                    if (uploadedPath) {

                        payload.image_path =
                            uploadedPath;

                    }

                    let result;

                    if (editId) {

                        result = await supabase
                            .from("dolls")
                            .update({
                                ...payload,
                                updated_at:
                                    new Date().toISOString()
                            })
                            .eq("id", editId)
                            .select("id")
                            .single();

                    } else {

                        result = await supabase
                            .from("dolls")
                            .insert({
                                ...payload,
                                created_by: user.id
                            })
                            .select("id")
                            .single();

                    }

                    if (result.error) {
                        throw result.error;
                    }

                    recordSaved = true;

                    if (
                        editId &&
                        uploadedPath &&
                        oldDoll?.image_path
                    ) {

                        const { error: cleanupError } =
                            await supabase.storage
                                .from(BUCKET)
                                .remove([
                                    oldDoll.image_path
                                ]);

                        if (cleanupError) {
                            console.error(cleanupError);
                        }

                    }

                    resetForm();

                    showMessage(
                        formMessage,
                        editId
                            ? "PROFILE UPDATED."
                            : "PROFILE ADDED."
                    );

                    await loadDolls();
                    await loadReservations();

                } catch (error) {

                    if (uploadedPath && !recordSaved) {

                        await supabase.storage
                            .from(BUCKET)
                            .remove([uploadedPath]);

                    }

                    console.error(error);

                    showMessage(
                        formMessage,
                        "SAVE FAILED: " + error.message,
                        true
                    );

                } finally {

                    dollBusy = false;
                    saveButton.disabled = false;
                    cancelEditButton.disabled = false;

                    saveButton.textContent =
                        $("dollEditId").value
                            ? "SAVE CHANGES"
                            : "ADD DOLL";

                }

            }
        );

        cancelEditButton.addEventListener(
            "click",
            resetForm
        );

    }

    /* =================================================
       LOAD RESERVATIONS
    ================================================= */

    async function loadReservations() {

        const version = ++reservationLoadVersion;

        let query = supabase
            .from("doll_reservations")
            .select("*")
            .order("start_date", {
                ascending: true
            });

        if (!isAdmin) {

            query = query.eq(
                "user_id",
                user.id
            );

        }

        const { data, error } = await query;

        if (version !== reservationLoadVersion) {
            return;
        }

        if (error) {

            console.error(error);

            $("myDollReservations").replaceChildren(
                makeElement(
                    "p",
                    "rm-message error",
                    "UNABLE TO LOAD RESERVATIONS: " +
                    error.message
                )
            );

            if (isAdmin) {

                $("allDollReservations").replaceChildren(
                    makeElement(
                        "p",
                        "rm-message error",
                        error.message
                    )
                );

            }

            return;

        }

        reservations = data || [];

        renderMyReservations();

        if (isAdmin) {
            renderAllReservations();
        }

    }

    /* =================================================
       RESERVATION INFORMATION
    ================================================= */

    function addInfo(container, label, value) {

        container.append(

            makeElement(
                "span",
                "rm-info-label",
                label
            ),

            makeElement(
                "span",
                "rm-info-value",
                value || "To be agreed privately"
            )

        );

    }

    function createLogistics(record) {

        const section = makeElement(
            "div",
            "rm-logistics"
        );

        const pickup = makeElement(
            "div",
            "rm-logistics-panel"
        );

        pickup.appendChild(
            makeElement("h4", "", "PICKUP")
        );

        addInfo(
            pickup,
            "DATE",
            formatDate(record.start_date)
        );

        addInfo(
            pickup,
            "TIME",
            formatTime(record.pickup_time)
        );

        addInfo(
            pickup,
            "LOCATION",
            record.pickup_location
        );

        addInfo(
            pickup,
            "INSTRUCTIONS",
            record.pickup_instructions ||
            "Awaiting further instructions."
        );

        const returned = makeElement(
            "div",
            "rm-logistics-panel"
        );

        returned.appendChild(
            makeElement("h4", "", "RETURN")
        );

        addInfo(
            returned,
            "DATE",
            formatDate(record.end_date)
        );

        addInfo(
            returned,
            "TIME",
            formatTime(record.return_time)
        );

        addInfo(
            returned,
            "LOCATION",
            record.return_location
        );

        addInfo(
            returned,
            "INSTRUCTIONS",
            record.return_instructions ||
            "Awaiting further instructions."
        );

        section.append(pickup, returned);

        return section;

    }

    /* =================================================
       SAVED PERSONAL CONFIGURATION
    ================================================= */

    /* =================================================
       RESERVED INVENTORY ACCESSORIES
    ================================================= */

    function createReservedInventory(record) {

        const section = makeElement(
            "section",
            "rm-inventory-accessories"
        );

        section.append(
            makeElement(
                "h4",
                "",
                "RESERVED INVENTORY ACCESSORIES"
            )
        );

        const grid = makeElement(
            "div",
            "rm-inventory-grid"
        );

        const message = makeElement(
            "p",
            "rm-inventory-message",
            "Loading reserved accessories..."
        );

        section.append(message, grid);

        async function loadAccessories() {

            try {

                const { data, error } = await supabase
                    .from("doll_reservation_accessories")
                    .select(
                        "id,inventory_item_id,item_name,item_category,image_path,booking_active"
                    )
                    .eq("reservation_id", record.id)
                    .order("item_name");

                if (error) throw error;

                const items = data || [];

                if (!items.length) {

                    message.textContent =
                        "No inventory accessories reserved.";

                    return;

                }

                message.textContent =
                    items.length + " RESERVED ACCESSORIES";

                for (const item of items) {

                    const card = makeElement(
                        "article",
                        "rm-inventory-card"
                    );

                    const imageFrame = makeElement(
                        "div",
                        "rm-inventory-image"
                    );

                    imageFrame.textContent =
                        "NO IMAGE";

                    if (item.image_path) {

                        const { data: imageData } =
                            await supabase.storage
                                .from("karolina-images")
                                .createSignedUrl(
                                    item.image_path,
                                    3600
                                );

                        if (imageData?.signedUrl) {

                            const image =
                                document.createElement("img");

                            image.src =
                                imageData.signedUrl;

                            image.alt =
                                item.item_name;

                            image.loading = "lazy";

                            image.addEventListener(
                                "error",
                                () => {
                                    imageFrame.textContent =
                                        "IMAGE UNAVAILABLE";
                                }
                            );

                            imageFrame.replaceChildren(image);

                        }

                    }

                    const info = makeElement(
                        "div",
                        "rm-inventory-info"
                    );

                    const status = makeElement(
                        "span",
                        item.booking_active
                            ? "rm-inventory-status active"
                            : "rm-inventory-status released",
                        item.booking_active
                            ? "RESERVED"
                            : "RELEASED"
                    );

                    info.append(

                        makeElement(
                            "strong",
                            "",
                            item.item_name
                        ),

                        makeElement(
                            "p",
                            "",
                            item.item_category || "ACCESSORY"
                        ),

                        status

                    );

                    if (!item.inventory_item_id) {

                        info.append(
                            makeElement(
                                "p",
                                "",
                                "HISTORICAL INVENTORY RECORD"
                            )
                        );

                    }

                    card.append(imageFrame, info);

                    grid.append(card);

                }

            } catch (error) {

                console.error(
                    "Reserved inventory loading failed:",
                    error
                );

                message.textContent =
                    "Unable to load reserved accessories.";

            }

        }

        loadAccessories();

        return section;

    }

    function createSavedOptions(record) {

        const section = makeElement(
            "div",
            "rm-configuration"
        );

        section.appendChild(
            makeElement(
                "h4",
                "",
                "PERSONAL CONFIGURATION"
            )
        );

        const options = record.reservation_options || {};

        const selections = Array.isArray(options)
            ? options
            : Array.isArray(options.selections)
                ? options.selections
                : [];

        for (const [category, label] of Object.entries(categories)) {

            const selected = selections.filter(
                item => item?.category === category
            );

            const names = selected.map(
                item =>
                    item.caption ||
                    item.name ||
                    "Selected option"
            );

            const line = makeElement("p");

            line.append(

                makeElement(
                    "strong",
                    "",
                    label + ": "
                ),

                document.createTextNode(
                    names.length
                        ? names.join(", ")
                        : "Default / no specific preference"
                )

            );

            section.appendChild(line);

        }

        section.appendChild(
            makeElement(
                "p",
                "",
                "ADDITIONAL NOTES: " +
                (options.notes || "None")
            )
        );

        return section;

    }

    /* =================================================
       RESERVATION CARDS
    ================================================= */

    function createReservationCard(
        record,
        adminMode = false
    ) {

        const card = makeElement(
            "details",
            "rm-card"
        );

        const recordKey =
            (adminMode ? "admin-" : "member-") +
            record.id;

        card.open = openRecords.has(recordKey);

        card.addEventListener(
            "toggle",
            () => {

                if (card.open) {

                    openRecords.add(recordKey);

                } else {

                    openRecords.delete(recordKey);

                }

            }
        );

        const summary = makeElement(
            "summary",
            "rm-card-summary"
        );

        const identity = makeElement(
            "div",
            "rm-card-identity"
        );

        identity.append(

            makeElement(
                "span",
                "rm-reference",
                reference(record)
            ),

            makeElement(
                "strong",
                "rm-profile-name",
                dollName(record.doll_id)
            ),

            makeElement(
                "span",
                "rm-date-range",
                formatDate(record.start_date) +
                " — " +
                formatDate(record.end_date)
            )

        );

        summary.append(

            identity,

            makeElement(
                "span",
                "rm-status " + record.status,
                statusLabel(record.status)
            ),

            makeElement(
                "span",
                "rm-chevron",
                "+"
            )

        );

        card.appendChild(summary);

        const content = makeElement(
            "div",
            "rm-card-content"
        );

        if (adminMode && isAdmin) {

            content.appendChild(
                makeElement(
                    "div",
                    "rm-member",
                    "MEMBER ID: " + record.user_id
                )
            );

        }

        if (record.status === "pending") {

            content.appendChild(
                makeElement(
                    "p",
                    "rm-message info",
                    "Awaiting administrator approval."
                )
            );

        }

         content.append(

            createLogistics(record),

            createSavedOptions(record),

            createReservedInventory(record)

        );

        if (record.admin_notes) {

            const notes = makeElement(
                "div",
                "rm-admin-notes"
            );

            notes.append(

                makeElement(
                    "h4",
                    "",
                    "ADMINISTRATOR MESSAGE"
                ),

                makeElement(
                    "p",
                    "",
                    record.admin_notes
                )

            );

            content.appendChild(notes);

        }

        if (adminMode && isAdmin) {

            content.appendChild(
                createAdminReservationForm(record)
            );

        } else {

            content.appendChild(
                createMemberActions(record)
            );

        }

        const footer = makeElement(
            "div",
            "rm-record-footer"
        );

        footer.append(

            makeElement(
                "div",
                "",
                "CREATED: " +
                formatTimestamp(record.created_at)
            ),

            makeElement(
                "div",
                "",
                "LAST UPDATED: " +
                formatTimestamp(
                    record.updated_at ||
                    record.created_at
                )
            ),

            makeElement(
                "div",
                "",
                "TIME ZONE: EUROPE/STOCKHOLM"
            )

        );

        content.appendChild(footer);

        card.appendChild(content);

        return card;

    }

    /* =================================================
       MEMBER ACTIONS
    ================================================= */

    function createMemberActions(record) {

        const wrapper = makeElement("div");

        const actions = makeElement(
            "div",
            "rm-actions"
        );

        const message = makeElement(
            "div",
            "rm-message"
        );

        message.setAttribute(
            "aria-live",
            "polite"
        );

        actions.appendChild(
            makeLink(
                "VIEW PROFILE →",
                "rm-button",
                "doll-details.html?id=" +
                encodeURIComponent(record.doll_id)
            )
        );

        if (
            record.user_id === user.id &&
            cancellableStatuses.includes(record.status)
        ) {

            const cancel = makeButton(
                "CANCEL RESERVATION",
                "rm-button danger"
            );

            cancel.addEventListener(
                "click",
                async () => {

                    if (cancel.disabled) return;

                    if (!confirm(
                        "Cancel reservation " +
                        reference(record) + "?"
                    )) return;

                    cancel.disabled = true;

                    reservationWrites++;

                    try {

                        const { error } = await supabase
                            .from("doll_reservations")
                            .update({
                                status: "cancelled"
                            })
                            .eq("id", record.id)
                            .eq("user_id", user.id)
                            .in(
                                "status",
                                cancellableStatuses
                            )
                            .select("id")
                            .single();

                        if (error) throw error;

                        await loadReservations();

                    } catch (error) {

                        showReservationMessage(
                            message,
                            "Cancellation failed: " +
                            error.message,
                            "error"
                        );

                    } finally {

                        reservationWrites--;

                        cancel.disabled = false;

                    }

                }
            );

            actions.appendChild(cancel);

        }

        wrapper.append(actions, message);

        return wrapper;

    }

    /* =================================================
       ADMINISTRATOR FORM FIELDS
    ================================================= */

    function createField(
        id,
        label,
        type,
        value = ""
    ) {

        const wrapper = makeElement(
            "div",
            "rm-field"
        );

        const fieldLabel = makeElement(
            "label",
            "",
            label
        );

        fieldLabel.htmlFor = id;

        let input;

        if (type === "textarea") {

            input = document.createElement(
                "textarea"
            );

            input.rows = 4;
            input.maxLength = 3000;

        } else if (type === "select") {

            input = document.createElement(
                "select"
            );

            for (const status of statuses) {

                const option =
                    document.createElement("option");

                option.value = status;
                option.textContent =
                    statusLabel(status);

                input.appendChild(option);

            }

        } else {

            input = document.createElement(
                "input"
            );

            input.type = type;

            if (type === "text") {
                input.maxLength = 500;
            }

        }

        input.id = id;
        input.value = value || "";

        wrapper.append(fieldLabel, input);

        return {
            wrapper,
            input
        };

    }

    /* =================================================
       ADMIN RESERVATION MANAGEMENT
    ================================================= */

    function createAdminReservationForm(record) {

        const form = makeElement(
            "form",
            "rm-admin-form"
        );

        form.appendChild(
            makeElement(
                "h4",
                "",
                "ADMINISTRATOR CONTROLS"
            )
        );

        const prefix = "rm-" + record.id + "-";

        const status = createField(
            prefix + "status",
            "RESERVATION STATUS",
            "select",
            record.status
        );

        const pickupDate = createField(
            prefix + "pickup-date",
            "PICKUP DATE",
            "date",
            record.start_date
        );

        const returnDate = createField(
            prefix + "return-date",
            "RETURN DATE",
            "date",
            record.end_date
        );

        pickupDate.input.required = true;
        returnDate.input.required = true;

        const pickupTime = createField(
            prefix + "pickup-time",
            "PICKUP TIME",
            "time",
            record.pickup_time
                ? record.pickup_time.slice(0, 5)
                : ""
        );

        const returnTime = createField(
            prefix + "return-time",
            "RETURN TIME",
            "time",
            record.return_time
                ? record.return_time.slice(0, 5)
                : ""
        );

        const pickupLocation = createField(
            prefix + "pickup-location",
            "FINAL PICKUP LOCATION",
            "text",
            record.pickup_location
        );

        const returnLocation = createField(
            prefix + "return-location",
            "FINAL RETURN LOCATION",
            "text",
            record.return_location
        );

        const pickupInstructions = createField(
            prefix + "pickup-instructions",
            "PRIVATE PICKUP INSTRUCTIONS",
            "textarea",
            record.pickup_instructions
        );

        const returnInstructions = createField(
            prefix + "return-instructions",
            "PRIVATE RETURN INSTRUCTIONS",
            "textarea",
            record.return_instructions
        );

        const adminNotes = createField(
            prefix + "admin-notes",
            "MESSAGE TO MEMBER",
            "textarea",
            record.admin_notes
        );

        const dateGrid = makeElement(
            "div",
            "rm-form-grid"
        );

        dateGrid.append(

            pickupDate.wrapper,
            returnDate.wrapper,
            pickupTime.wrapper,
            returnTime.wrapper

        );

        const locationGrid = makeElement(
            "div",
            "rm-form-grid"
        );

        locationGrid.append(
            pickupLocation.wrapper,
            returnLocation.wrapper
        );

        const instructionGrid = makeElement(
            "div",
            "rm-form-grid"
        );

        instructionGrid.append(
            pickupInstructions.wrapper,
            returnInstructions.wrapper
        );

        form.append(

            status.wrapper,

            dateGrid,

            locationGrid,

            instructionGrid,

            adminNotes.wrapper,

            makeElement(
                "p",
                "rm-field-hint",
                "Instructions and messages are visible to the reservation owner. All times are local Stockholm time."
            )

        );

        const actions = makeElement(
            "div",
            "rm-actions"
        );

        const save = makeButton(
            "SAVE RESERVATION DETAILS",
            "rm-button primary"
        );

        save.type = "submit";

        const approve = makeButton(
            "APPROVE REQUEST",
            "rm-button"
        );

        const decline = makeButton(
            "DECLINE REQUEST",
            "rm-button danger"
        );

        actions.appendChild(save);

        if (record.status === "pending") {

            actions.append(approve, decline);

        }

        const message = makeElement(
            "div",
            "rm-message"
        );

        message.setAttribute(
            "aria-live",
            "polite"
        );

        form.append(actions, message);

        /* Preserve unsaved form edits during realtime updates. */

        form.addEventListener(
            "input",
            () => {

                form.dataset.dirty = "true";

            }
        );

        form.addEventListener(
            "change",
            () => {

                form.dataset.dirty = "true";

            }
        );

        approve.addEventListener(
            "click",
            () => {

                status.input.value = "confirmed";

                form.dataset.dirty = "true";

                form.requestSubmit();

            }
        );

        decline.addEventListener(
            "click",
            () => {

                status.input.value = "declined";

                form.dataset.dirty = "true";

                form.requestSubmit();

            }
        );

        form.addEventListener(
            "submit",
            async event => {

                event.preventDefault();

                if (!isAdmin || save.disabled) return;

                const payload = {

                    status:
                        status.input.value,

                    start_date:
                        pickupDate.input.value,

                    end_date:
                        returnDate.input.value,

                    pickup_time:
                        pickupTime.input.value || null,

                    return_time:
                        returnTime.input.value || null,

                    pickup_location:
                        pickupLocation.input.value.trim(),

                    return_location:
                        returnLocation.input.value.trim(),

                    pickup_instructions:
                        pickupInstructions.input.value.trim(),

                    return_instructions:
                        returnInstructions.input.value.trim(),

                    admin_notes:
                        adminNotes.input.value.trim()

                };

                if (!statuses.includes(payload.status)) {

                    showReservationMessage(
                        message,
                        "Invalid reservation status.",
                        "error"
                    );

                    return;

                }

                if (
                    !payload.start_date ||
                    !payload.end_date ||
                    payload.end_date < payload.start_date
                ) {

                    showReservationMessage(
                        message,
                        "Invalid reservation date range.",
                        "error"
                    );

                    return;

                }

                if (
                    payload.start_date === payload.end_date &&
                    payload.pickup_time &&
                    payload.return_time &&
                    payload.return_time <= payload.pickup_time
                ) {

                    showReservationMessage(
                        message,
                        "Return time must be later than pickup time.",
                        "error"
                    );

                    return;

                }

                if (
                    payload.status !== record.status &&
                    !confirm(
                        "Change " +
                        reference(record) +
                        " to " +
                        statusLabel(payload.status) +
                        "?"
                    )
                ) return;

                const controls = [
                    ...form.querySelectorAll(
                        "input, textarea, select, button"
                    )
                ];

                controls.forEach(
                    control => control.disabled = true
                );

                reservationWrites++;

                save.textContent = "SAVING...";

                try {

                    let query = supabase
                        .from("doll_reservations")
                        .update(payload)
                        .eq("id", record.id);

                    if (record.updated_at) {

                        query = query.eq(
                            "updated_at",
                            record.updated_at
                        );

                    } else {

                        query = query.is(
                            "updated_at",
                            null
                        );

                    }

                    const { error } = await query
                        .select("id")
                        .single();

                    if (error) throw error;

                    form.dataset.dirty = "false";

                    await loadReservations();

                    alert(
                        reference(record) +
                        " UPDATED SUCCESSFULLY."
                    );

                } catch (error) {

                    console.error(error);

                    showReservationMessage(
                        message,
                        "SAVE FAILED: " +
                        error.message +
                        " If the record was changed elsewhere, refresh the page before trying again.",
                        "error"
                    );

                } finally {

                    reservationWrites--;

                    controls.forEach(
                        control => control.disabled = false
                    );

                    save.textContent =
                        "SAVE RESERVATION DETAILS";

                }

            }
        );

        return form;

    }

    /* =================================================
       RESERVATION HISTORY
    ================================================= */

    function createHistory(
        records,
        adminMode = false
    ) {

        const history = makeElement(
            "details",
            "rm-history"
        );

        history.appendChild(
            makeElement(
                "summary",
                "",
                "RESERVATION HISTORY (" +
                records.length + ")"
            )
        );

        const content = makeElement(
            "div",
            "rm-history-content rm-list"
        );

        if (!records.length) {

            content.appendChild(
                makeElement(
                    "p",
                    "dolls-empty",
                    "NO HISTORICAL RESERVATIONS."
                )
            );

        }

        for (const record of records) {

            content.appendChild(
                createReservationCard(
                    record,
                    adminMode
                )
            );

        }

        history.appendChild(content);

        return history;

    }

    /* =================================================
       MY RESERVATIONS
    ================================================= */

    function renderMyReservations() {

        const container = $("myDollReservations");

        container.replaceChildren();

        const mine = reservations.filter(
            record => record.user_id === user.id
        );

        if (!mine.length) {

            container.appendChild(
                makeElement(
                    "p",
                    "dolls-empty",
                    "YOU HAVE NO RESERVATIONS."
                )
            );

            return;

        }

        const current = mine.filter(
            record =>
                !closedStatuses.includes(record.status)
        );

        const history = mine.filter(
            record =>
                closedStatuses.includes(record.status)
        );

        const list = makeElement(
            "div",
            "rm-list"
        );

        if (!current.length) {

            list.appendChild(
                makeElement(
                    "p",
                    "dolls-empty",
                    "NO CURRENT RESERVATIONS."
                )
            );

        }

        for (const record of current) {

            list.appendChild(
                createReservationCard(record)
            );

        }

        container.append(

            list,

            createHistory(history)

        );

    }

    /* =================================================
       ADMINISTRATOR DASHBOARD
    ================================================= */

    function hasUnsavedChanges() {

        return Boolean(
            document.querySelector(
                '.rm-admin-form[data-dirty="true"]'
            )
        );

    }

    function allowDiscardChanges() {

        return !hasUnsavedChanges() ||
            confirm(
                "You have unsaved reservation changes. Discard them?"
            );

    }

    function renderAllReservations() {

        if (!isAdmin) return;

        const container = $("allDollReservations");

        container.replaceChildren();

        const dashboard = makeElement(
            "div",
            "rm-dashboard"
        );

        const toolbar = makeElement(
            "div",
            "rm-toolbar"
        );

        const list = makeElement(
            "div",
            "rm-list"
        );

        const count = makeElement(
            "span",
            "rm-result-count"
        );

        const filter = document.createElement(
            "select"
        );

        filter.setAttribute(
            "aria-label",
            "Filter reservations by status"
        );

        const allOption =
            document.createElement("option");

        allOption.value = "all";
        allOption.textContent = "ALL RESERVATIONS";

        filter.appendChild(allOption);

        for (const status of statuses) {

            const option =
                document.createElement("option");

            option.value = status;
            option.textContent = statusLabel(status);

            filter.appendChild(option);

        }

        filter.value = adminFilter;

        const search = document.createElement(
            "input"
        );

        search.type = "search";

        search.placeholder =
            "Search reference, profile or member...";

        search.setAttribute(
            "aria-label",
            "Search reservations"
        );

        search.value = adminSearch;

        const refresh = makeButton(
            "REFRESH",
            "rm-button"
        );

        refresh.addEventListener(
            "click",
            async () => {

                if (!allowDiscardChanges()) return;

                refresh.disabled = true;

                try {

                    await loadDolls();
                    await loadReservations();

                } finally {

                    refresh.disabled = false;

                }

            }
        );

        toolbar.append(
            filter,
            search,
            refresh,
            count
        );

        function renderFilteredRecords() {

            list.replaceChildren();

            const term = adminSearch
                .trim()
                .toLowerCase();

            const filtered = reservations.filter(
                record => {

                    const matchesStatus =
                        adminFilter === "all" ||
                        record.status === adminFilter;

                    const searchable = [

                        reference(record),
                        record.id,
                        record.user_id,
                        dollName(record.doll_id),
                        record.start_date,
                        record.end_date

                    ].join(" ").toLowerCase();

                    return matchesStatus &&
                        searchable.includes(term);

                }
            );

            count.textContent =
                filtered.length + " RECORD(S)";

            if (!filtered.length) {

                list.appendChild(
                    makeElement(
                        "p",
                        "dolls-empty",
                        "NO MATCHING RESERVATIONS."
                    )
                );

                return;

            }

            if (adminFilter === "all") {

                const current = filtered.filter(
                    record =>
                        !closedStatuses.includes(
                            record.status
                        )
                );

                const history = filtered.filter(
                    record =>
                        closedStatuses.includes(
                            record.status
                        )
                );

                for (const record of current) {

                    list.appendChild(
                        createReservationCard(
                            record,
                            true
                        )
                    );

                }

                if (history.length) {

                    list.appendChild(
                        createHistory(history, true)
                    );

                }

            } else {

                for (const record of filtered) {

                    list.appendChild(
                        createReservationCard(
                            record,
                            true
                        )
                    );

                }

            }

        }

        function updateFilter(value) {

            if (!allowDiscardChanges()) {

                filter.value = adminFilter;
                return;

            }

            adminFilter = value;

            filter.value = value;

            dashboard.querySelectorAll(
                ".rm-stat"
            ).forEach(button => {

                button.classList.toggle(
                    "selected",
                    button.dataset.status === value
                );

            });

            renderFilteredRecords();

        }

        for (const status of statuses) {

            const total = reservations.filter(
                record => record.status === status
            ).length;

            const tile = makeButton(
                "",
                "rm-stat"
            );

            tile.dataset.status = status;

            tile.classList.toggle(
                "selected",
                adminFilter === status
            );

            tile.append(

                makeElement(
                    "span",
                    "rm-stat-label",
                    statusLabel(status)
                ),

                makeElement(
                    "strong",
                    "rm-stat-value",
                    String(total).padStart(2, "0")
                )

            );

            tile.addEventListener(
                "click",
                () => {

                    updateFilter(
                        adminFilter === status
                            ? "all"
                            : status
                    );

                }
            );

            dashboard.appendChild(tile);

        }

        filter.addEventListener(
            "change",
            () => updateFilter(filter.value)
        );

        search.addEventListener(
            "input",
            () => {

                if (!allowDiscardChanges()) {

                    search.value = adminSearch;
                    return;

                }

                adminSearch = search.value;

                renderFilteredRecords();

            }
        );

        container.append(
            dashboard,
            toolbar,
            list
        );

        renderFilteredRecords();

    }

    /* =================================================
       REALTIME SYNCHRONIZATION
    ================================================= */

    function scheduleRefresh() {

        clearTimeout(refreshTimer);

        refreshTimer = setTimeout(
            async () => {

                if (
                    reservationWrites > 0 ||
                    dollBusy ||
                    hasUnsavedChanges()
                ) {

                    scheduleRefresh();
                    return;

                }

                try {

                    await loadDolls();
                    await loadReservations();

                } catch (error) {

                    console.error(error);

                }

            },
            500
        );

    }

    function connectRealtime() {

        realtimeChannel = supabase
            .channel("dolls-for-rent-live")

            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "dolls"
                },
                scheduleRefresh
            )

            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "doll_reservations"
                },
                scheduleRefresh
            )

            .subscribe(status => {

                if (status === "SUBSCRIBED") {

                    connection.textContent =
                        "CONNECTED // LIVE SYNCHRONIZATION ACTIVE";

                }

                if (
                    status === "CHANNEL_ERROR" ||
                    status === "TIMED_OUT"
                ) {

                    connection.textContent =
                        "DATABASE CONNECTED // LIVE SYNCHRONIZATION UNAVAILABLE";

                }

            });

    }

    /* =================================================
       INITIALIZATION
    ================================================= */

    async function initialize() {

        adminPanel.hidden = !isAdmin;

        adminReservations.hidden = !isAdmin;

        connection.textContent =
            "CONNECTING TO DATABASE...";

        try {

            await loadDolls();

            await loadReservations();

            connection.textContent =
                "CONNECTED TO SUPABASE";

            connectRealtime();

        } catch (error) {

            console.error(error);

            connection.textContent =
                "CONNECTION ERROR: " +
                error.message;

        }

    }

    window.addEventListener(
        "beforeunload",
        event => {

            if (hasUnsavedChanges()) {

                event.preventDefault();

                event.returnValue = "";

            }

        }
    );

    window.addEventListener(
        "pagehide",
        () => {

            clearTimeout(refreshTimer);

            if (realtimeChannel) {

                supabase.removeChannel(
                    realtimeChannel
                );

            }

        }
    );

    await initialize();

})();

/* =====================================================
   END OF FILE
   THE DEN © 2026
===================================================== */
