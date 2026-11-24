
/* =========================================
   THE DEN
   DOLLS FOR RENT
   PRIVATE COLLECTION
   Supabase + Reservations + Admin
========================================= */

(async function () {
    "use strict";

    const supabase = window.archiveSupabase;
    const session = await window.archiveAuthReady;

    if (!session || !supabase) return;

    const user = session.user;

    const ADMIN_ID = "3d4c3c65-3956-46b3-a83d-aae7e671c0ff";
    const isAdmin = user.id === ADMIN_ID;

    const BUCKET = "dolls-for-rent";

    const $ = id => document.getElementById(id);

    const connection = $("dollsConnection");
    const grid = $("dollsGrid");
    const count = $("dollsCount");

    const adminPanel = $("dollsAdminPanel");
    const adminReservations = $("dollsAdminReservations");

    const form = $("dollForm");
    const formMessage = $("dollAdminMessage");
    const saveButton = $("dollSaveButton");
    const cancelEditButton = $("dollCancelEdit");

    let dolls = [];
    let reservations = [];
    let realtimeChannel = null;

    // =====================================
    // DATE HELPERS
    // =====================================

    function today() {
        const date = new Date();

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    function formatDate(date) {
        if (!date) return "";

        return new Date(date + "T12:00:00").toLocaleDateString();
    }

    // =====================================
    // GENERAL HELPERS
    // =====================================

    function showMessage(element, message, error = false) {
        if (!element) return;

        element.textContent = message;
        element.classList.toggle("error", error);
    }

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

    function resetForm() {
        form.reset();

        $("dollEditId").value = "";

        saveButton.textContent = "ADD DOLL";
        saveButton.disabled = false;

        cancelEditButton.hidden = true;

        showMessage(formMessage, "");
    }

    // =====================================
    // STORAGE
    // =====================================

    async function getImageUrl(path) {
        if (!path) return null;

        const { data, error } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(path, 3600);

        if (error) {
            console.error("Image URL error:", error);
            return null;
        }

        return data.signedUrl;
    }

    // =====================================
    // RESERVATION OPTIONS HISTORY
    // =====================================

    function renderSavedOptions(reservation, container) {
        if (!container) return;

        const saved = reservation.reservation_options;

        if (!saved) return;

        let selections = [];
        let notes = "";

        if (Array.isArray(saved)) {
            selections = saved;

        } else if (typeof saved === "object") {

            selections = Array.isArray(saved.selections)
                ? saved.selections
                : [];

            notes = typeof saved.notes === "string"
                ? saved.notes
                : "";
        }

        if (!selections.length && !notes) return;

        const details = makeElement(
            "div",
            "reservation-saved-options"
        );

        details.style.marginTop = "12px";
        details.style.padding = "12px";
        details.style.border = "1px solid #34533a";
        details.style.background = "#0b140d";

        const heading = makeElement(
            "strong",
            "",
            "RESERVATION CONFIGURATION"
        );

        heading.style.display = "block";
        heading.style.marginBottom = "8px";
        heading.style.color = "#8fce9c";

        details.append(heading);

        const categoryNames = {
            clothing: "CLOTHING",
            makeup: "MAKE-UP",
            hairstyle: "HAIRSTYLE",
            nails: "NAILS",
            accessories: "ACCESSORIES"
        };

        if (selections.length) {

            for (const option of selections) {

                if (!option) continue;

                const category =
                    categoryNames[option.category]
                    || String(
                        option.category || "OPTION"
                    ).toUpperCase();

                const caption =
                    option.caption || "Unnamed option";

                const line = makeElement(
                    "p",
                    "",
                    `${category}: ${caption}`
                );

                line.style.margin = "5px 0";
                line.style.fontSize = "12px";
                line.style.color = "#c5d2c7";

                details.append(line);
            }

        } else {

            const empty = makeElement(
                "p",
                "",
                "No configuration options selected."
            );

            empty.style.fontSize = "12px";

            details.append(empty);
        }

        if (notes) {

            const notesHeading = makeElement(
                "p",
                "",
                "ADDITIONAL NOTES:"
            );

            notesHeading.style.marginTop = "12px";
            notesHeading.style.color = "#8fce9c";
            notesHeading.style.fontSize = "12px";

            const notesText = makeElement(
                "p",
                "",
                notes
            );

            notesText.style.whiteSpace = "pre-wrap";
            notesText.style.fontSize = "12px";
            notesText.style.color = "#c5d2c7";

            details.append(notesHeading, notesText);
        }

        container.append(details);
    }

    // =====================================
    // LOAD DOLLS
    // =====================================

    async function loadDolls() {

        const { data, error } = await supabase
            .from("dolls")
            .select("*")
            .order("created_at", {
                ascending: false
            });

        if (error) {

            console.error("Dolls loading error:", error);

            connection.textContent =
                "DATABASE ERROR: " + error.message;

            return;
        }

        dolls = data || [];

        count.textContent = `${dolls.length} DOLLS`;

        await renderDolls();
    }

    // =====================================
    // CUSTOMIZATION ICONS
    // =====================================

    function createCustomizationOptions() {

        const customization = makeElement(
            "div",
            "doll-customization"
        );

        customization.append(
            makeElement(
                "p",
                "doll-customization-title",
                "CUSTOMIZATION OPTIONS"
            )
        );

        const options = makeElement(
            "div",
            "doll-options-grid"
        );

        const categories = [

            {
                name: "CLOTHING",
                icon: `
                    <path d="
                        M8 3
                        L3 6
                        L1 11
                        L6 13
                        V21
                        H18
                        V13
                        L23 11
                        L21 6
                        L16 3
                        A4 4 0 0 1 8 3
                        Z
                    "/>
                `
            },

            {
                name: "MAKE-UP",
                icon: `
                    <path d="M14 6l4-4 4 4-4 4"/>
                    <path d="M14 6l-7 7 4 4 7-7"/>
                    <path d="
                        M7 13
                        C2 13 5 19 1 21
                        C7 23 11 20 11 17
                    "/>
                `
            },

            {
                name: "HAIRSTYLE",
                icon: `
                    <circle cx="6" cy="6" r="3"/>
                    <circle cx="6" cy="18" r="3"/>
                    <path d="M8 8L21 21"/>
                    <path d="M8 16L21 3"/>
                `
            },

            {
                name: "NAILS",
                icon: `
                    <path d="
                        M8 21
                        V9
                        A4 4 0 0 1 16 9
                        V21
                        Z
                    "/>
                    <path d="M8 12H16"/>
                `
            },

            {
                name: "ACCESSORIES",
                icon: `
                    <path d="
                        M3 8
                        L7 3
                        H17
                        L21 8
                        L12 21
                        Z
                    "/>
                    <path d="M3 8H21"/>
                    <path d="M7 3L12 21L17 3"/>
                `
            }

        ];

        for (const category of categories) {

            const option = makeElement(
                "div",
                "doll-option"
            );

            const icon = makeElement(
                "span",
                "doll-option-icon"
            );

            icon.setAttribute("aria-hidden", "true");

            icon.innerHTML = `
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                >
                    ${category.icon}
                </svg>
            `;

            const name = makeElement(
                "span",
                "doll-option-name",
                category.name
            );

            option.append(icon, name);

            options.append(option);
        }

        customization.append(options);

        return customization;
    }

    // =====================================
    // RENDER CATALOG
    // =====================================

    async function renderDolls() {

        grid.replaceChildren();

        if (!dolls.length) {

            grid.append(
                makeElement(
                    "p",
                    "dolls-empty",
                    "NO DOLLS IN THE COLLECTION YET."
                )
            );

            return;
        }

        for (const doll of dolls) {

            const card = makeElement(
                "article",
                "doll-card"
            );

            // =================================
            // CARD HEADER
            // =================================

            const cardTop = makeElement(
                "div",
                "doll-card-top"
            );

            const collectionLabel = makeElement(
                "span",
                "doll-collection-label",
                "THE DEN // COLLECTION"
            );

            const status = makeElement(
                "span",
                "doll-status",
                "RESERVATIONS OPEN"
            );

            cardTop.append(
                collectionLabel,
                status
            );

            card.append(cardTop);

            // =================================
            // PROFILE IMAGE
            // =================================

            const imageFrame = makeElement(
                "div",
                "doll-image-frame"
            );

            if (doll.image_path) {

                const imageUrl = await getImageUrl(
                    doll.image_path
                );

                if (imageUrl) {

                    const image = makeElement(
                        "img",
                        "doll-image"
                    );

                    image.src = imageUrl;
                    image.alt = doll.name || "Doll";
                    image.loading = "lazy";

                    imageFrame.append(image);

                } else {

                    imageFrame.append(
                        makeElement(
                            "div",
                            "doll-image-placeholder",
                            "IMAGE UNAVAILABLE"
                        )
                    );
                }

            } else {

                imageFrame.append(
                    makeElement(
                        "div",
                        "doll-image-placeholder",
                        "NO IMAGE"
                    )
                );
            }

            card.append(imageFrame);

            // =================================
            // DOLL NAME
            // =================================

            card.append(
                makeElement(
                    "h3",
                    "",
                    doll.name || "UNNAMED DOLL"
                )
            );

            card.append(
                makeElement(
                    "p",
                    "doll-profile-label",
                    "PERSONAL COLLECTION"
                )
            );

            // =================================
            // DESCRIPTION
            // =================================

            if (doll.description) {

                card.append(
                    makeElement(
                        "p",
                        "doll-description",
                        doll.description
                    )
                );
            }

            // =================================
            // ADDITIONAL DETAILS
            // =================================

            if (doll.details) {

                card.append(
                    makeElement(
                        "p",
                        "doll-details",
                        doll.details
                    )
                );
            }

            // =================================
            // CUSTOMIZATION OPTIONS
            // =================================

            card.append(
                createCustomizationOptions()
            );

            // =================================
            // MAIN ACTIONS
            // =================================

            const mainActions = makeElement(
                "div",
                "doll-main-actions"
            );

            // EXPLORE AVAILABLE OPTIONS

            const profileButton = makeElement(
                "button",
                "doll-explore-button",
                "EXPLORE AVAILABLE OPTIONS →"
            );

            profileButton.type = "button";

            profileButton.addEventListener(
                "click",
                () => {

                    window.location.href =
                        `doll-details.html?id=${encodeURIComponent(doll.id)}`;
                }
            );

            // MAKE A RESERVATION

            const reserveButton = makeElement(
                "button",
                "doll-reserve-button",
                "MAKE A RESERVATION"
            );

            reserveButton.type = "button";

            reserveButton.addEventListener(
                "click",
                () => {

                    window.location.href =
                        `doll-reservation.html?id=${encodeURIComponent(doll.id)}`;
                }
            );

            mainActions.append(
                profileButton,
                reserveButton
            );

            card.append(mainActions);

            // =================================
            // CARD FOOTER
            // =================================

            card.append(
                makeElement(
                    "p",
                    "doll-card-footer",
                    "PRIVATE MEMBERS ONLY"
                )
            );

            // =================================
            // ADMIN CONTROLS
            // =================================

            if (isAdmin) {

                const actions = makeElement(
                    "div",
                    "dolls-admin-actions"
                );

                // EDIT DOLL

                const editButton = makeElement(
                    "button",
                    "dolls-action-button",
                    "EDIT"
                );

                editButton.type = "button";

                editButton.addEventListener(
                    "click",
                    () => {

                        $("dollEditId").value =
                            doll.id;

                        $("dollName").value =
                            doll.name || "";

                        $("dollDescription").value =
                            doll.description || "";

                        $("dollDetails").value =
                            doll.details || "";

                        saveButton.textContent =
                            "SAVE CHANGES";

                        cancelEditButton.hidden = false;

                        adminPanel.scrollIntoView({
                            behavior: "smooth"
                        });
                    }
                );

                // DELETE DOLL

                const deleteButton = makeElement(
                    "button",
                    "dolls-action-button dolls-delete",
                    "DELETE"
                );

                deleteButton.type = "button";

                deleteButton.addEventListener(
                    "click",
                    async () => {

                        if (!confirm(`Delete "${doll.name}"?`)) {
                            return;
                        }

                        deleteButton.disabled = true;

                        deleteButton.textContent =
                            "DELETING...";

                        // Read gallery paths before cascade deletion.

                        const {
                            data: galleryFiles,
                            error: galleryError
                        } = await supabase
                            .from("doll_gallery")
                            .select("image_path")
                            .eq("doll_id", doll.id);

                        if (galleryError) {

                            alert(
                                "Could not read gallery: " +
                                galleryError.message
                            );

                            deleteButton.disabled = false;
                            deleteButton.textContent = "DELETE";

                            return;
                        }

                        const { error } = await supabase
                            .from("dolls")
                            .delete()
                            .eq("id", doll.id);

                        if (error) {

                            console.error(
                                "Delete error:",
                                error
                            );

                            alert(
                                "Could not delete doll: " +
                                error.message
                            );

                            deleteButton.disabled = false;
                            deleteButton.textContent = "DELETE";

                            return;
                        }

                        const filesToRemove = [];

                        if (doll.image_path) {

                            filesToRemove.push(
                                doll.image_path
                            );
                        }

                        if (galleryFiles && galleryFiles.length) {

                            filesToRemove.push(
                                ...galleryFiles
                                    .map(item => item.image_path)
                                    .filter(Boolean)
                            );
                        }

                        if (filesToRemove.length) {

                            const {
                                error: storageError
                            } = await supabase.storage
                                .from(BUCKET)
                                .remove(
                                    [...new Set(filesToRemove)]
                                );

                            if (storageError) {

                                console.error(
                                    "Storage cleanup error:",
                                    storageError
                                );

                                alert(
                                    "Doll deleted, but storage cleanup failed: " +
                                    storageError.message
                                );
                            }
                        }

                        await loadDolls();
                        await loadReservations();
                    }
                );

                actions.append(
                    editButton,
                    deleteButton
                );

                card.append(actions);
            }

            grid.append(card);
        }
    }

    // =====================================
    // ADD / EDIT DOLL
    // =====================================

    if (isAdmin) {

        form.addEventListener(
            "submit",
            async event => {

                event.preventDefault();

                const editId =
                    $("dollEditId").value;

                const name =
                    $("dollName").value.trim();

                const description =
                    $("dollDescription").value.trim();

                const details =
                    $("dollDetails").value.trim();

                const file =
                    $("dollImage").files[0];

                if (!name) return;

                // FILE SIZE VALIDATION

                if (
                    file &&
                    file.size > 10 * 1024 * 1024
                ) {

                    showMessage(
                        formMessage,
                        "IMAGE IS LARGER THAN 10 MB.",
                        true
                    );

                    return;
                }

                // FILE TYPE VALIDATION

                const allowedTypes = [
                    "image/jpeg",
                    "image/png",
                    "image/webp",
                    "image/gif"
                ];

                if (
                    file &&
                    !allowedTypes.includes(file.type)
                ) {

                    showMessage(
                        formMessage,
                        "UNSUPPORTED IMAGE FORMAT.",
                        true
                    );

                    return;
                }

                saveButton.disabled = true;

                saveButton.textContent =
                    "SAVING...";

                let imagePath = null;

                const oldDoll = editId
                    ? dolls.find(
                        item => item.id === editId
                    )
                    : null;

                // =================================
                // UPLOAD IMAGE
                // =================================

                if (file) {

                    const safeName = file.name.replace(
                        /[^a-zA-Z0-9._-]/g,
                        "_"
                    );

                    imagePath =
                        `${user.id}/${crypto.randomUUID()}-${safeName}`;

                    const {
                        error: uploadError
                    } = await supabase.storage
                        .from(BUCKET)
                        .upload(
                            imagePath,
                            file,
                            {
                                contentType: file.type,
                                upsert: false
                            }
                        );

                    if (uploadError) {

                        showMessage(
                            formMessage,
                            "IMAGE UPLOAD FAILED: " +
                            uploadError.message,
                            true
                        );

                        saveButton.disabled = false;

                        saveButton.textContent = editId
                            ? "SAVE CHANGES"
                            : "ADD DOLL";

                        return;
                    }
                }

                // =================================
                // SAVE DATABASE RECORD
                // =================================

                const dollData = {
                    name,
                    description,
                    details
                };

                if (imagePath) {

                    dollData.image_path = imagePath;
                }

                let result;

                if (editId) {

                    result = await supabase
                        .from("dolls")
                        .update({
                            ...dollData,
                            updated_at:
                                new Date().toISOString()
                        })
                        .eq("id", editId);

                } else {

                    result = await supabase
                        .from("dolls")
                        .insert({
                            ...dollData,
                            created_by: user.id
                        });
                }

                // =================================
                // HANDLE SAVE RESULT
                // =================================

                if (result.error) {

                    console.error(
                        "Save error:",
                        result.error
                    );

                    showMessage(
                        formMessage,
                        "SAVE FAILED: " +
                        result.error.message,
                        true
                    );

                    if (imagePath) {

                        await supabase.storage
                            .from(BUCKET)
                            .remove([imagePath]);
                    }

                } else {

                    // Remove previous image.

                    if (
                        editId &&
                        imagePath &&
                        oldDoll &&
                        oldDoll.image_path
                    ) {

                        await supabase.storage
                            .from(BUCKET)
                            .remove([
                                oldDoll.image_path
                            ]);
                    }

                    resetForm();

                    showMessage(
                        formMessage,
                        editId
                            ? "DOLL UPDATED."
                            : "DOLL ADDED."
                    );

                    await loadDolls();
                }

                saveButton.disabled = false;

                saveButton.textContent =
                    $("dollEditId").value
                        ? "SAVE CHANGES"
                        : "ADD DOLL";
            }
        );

        cancelEditButton.addEventListener(
            "click",
            resetForm
        );
    }

    // =====================================
    // LOAD RESERVATIONS
    // =====================================

    async function loadReservations() {

        const { data, error } = await supabase
            .from("doll_reservations")
            .select("*")
            .order(
                "start_date",
                {
                    ascending: true
                }
            );

        if (error) {

            console.error(
                "Reservations loading error:",
                error
            );

            return;
        }

        reservations = data || [];

        await renderMyReservations();

        if (isAdmin) {

            await renderAllReservations();
        }
    }

    // =====================================
    // MY RESERVATIONS
    // =====================================

    async function renderMyReservations() {

        const container =
            $("myDollReservations");

        container.replaceChildren();

        const mine = reservations.filter(
            reservation =>
                reservation.user_id === user.id
        );

        if (!mine.length) {

            container.append(
                makeElement(
                    "p",
                    "dolls-empty",
                    "YOU HAVE NO RESERVATIONS."
                )
            );

            return;
        }

        for (const reservation of mine) {

            const doll = dolls.find(
                item =>
                    item.id === reservation.doll_id
            );

            const item = makeElement(
                "div",
                "dolls-reservation"
            );

            const name = makeElement(
                "strong",
                "",
                doll ? doll.name : "DOLL"
            );

            if (doll) {

                name.style.cursor = "pointer";

                name.title =
                    "EXPLORE AVAILABLE OPTIONS";

                name.addEventListener(
                    "click",
                    () => {

                        window.location.href =
                            `doll-details.html?id=${encodeURIComponent(doll.id)}`;
                    }
                );
            }

            item.append(name);

            // RESERVATION DATES

            item.append(
                makeElement(
                    "p",
                    "",
                    `${formatDate(reservation.start_date)} — ${formatDate(reservation.end_date)}`
                )
            );

            // RESERVATION STATUS

            item.append(
                makeElement(
                    "p",
                    "",
                    `STATUS: ${reservation.status.toUpperCase()}`
                )
            );

            // SAVED CONFIGURATION

            renderSavedOptions(
                reservation,
                item
            );

            // CANCEL RESERVATION

            if (reservation.status === "confirmed") {

                const cancelButton = makeElement(
                    "button",
                    "dolls-action-button dolls-delete",
                    "CANCEL RESERVATION"
                );

                cancelButton.type = "button";

                cancelButton.addEventListener(
                    "click",
                    async () => {

                        if (!confirm("Cancel this reservation?")) {
                            return;
                        }

                        cancelButton.disabled = true;

                        const { error } = await supabase
                            .from("doll_reservations")
                            .update({
                                status: "cancelled"
                            })
                            .eq(
                                "id",
                                reservation.id
                            )
                            .eq(
                                "user_id",
                                user.id
                            );

                        if (error) {

                            alert(
                                "Cancellation failed: " +
                                error.message
                            );

                            cancelButton.disabled = false;

                            return;
                        }

                        await loadReservations();
                    }
                );

                item.append(cancelButton);
            }

            container.append(item);
        }
    }

    // =====================================
    // ADMIN — ALL RESERVATIONS
    // =====================================

    async function renderAllReservations() {

        if (!isAdmin) return;

        const container =
            $("allDollReservations");

        container.replaceChildren();

        if (!reservations.length) {

            container.append(
                makeElement(
                    "p",
                    "dolls-empty",
                    "NO RESERVATIONS."
                )
            );

            return;
        }

        for (const reservation of reservations) {

            const doll = dolls.find(
                item =>
                    item.id === reservation.doll_id
            );

            const item = makeElement(
                "div",
                "dolls-reservation"
            );

            // DOLL NAME

            item.append(
                makeElement(
                    "strong",
                    "",
                    doll ? doll.name : "DOLL"
                )
            );

            // MEMBER IDENTIFICATION

            item.append(
                makeElement(
                    "p",
                    "",
                    `USER: ${reservation.user_id.slice(-6).toUpperCase()}`
                )
            );

            // RESERVATION DATES

            item.append(
                makeElement(
                    "p",
                    "",
                    `${formatDate(reservation.start_date)} — ${formatDate(reservation.end_date)}`
                )
            );

            // RESERVATION STATUS

            item.append(
                makeElement(
                    "p",
                    "",
                    `STATUS: ${reservation.status.toUpperCase()}`
                )
            );

            // SAVED CONFIGURATION

            renderSavedOptions(
                reservation,
                item
            );

            // ADMIN CANCELLATION

            if (reservation.status === "confirmed") {

                const cancelButton = makeElement(
                    "button",
                    "dolls-action-button dolls-delete",
                    "CANCEL RESERVATION"
                );

                cancelButton.type = "button";

                cancelButton.addEventListener(
                    "click",
                    async () => {

                        if (!confirm("Cancel this reservation?")) {
                            return;
                        }

                        cancelButton.disabled = true;

                        const { error } = await supabase
                            .from("doll_reservations")
                            .update({
                                status: "cancelled"
                            })
                            .eq(
                                "id",
                                reservation.id
                            );

                        if (error) {

                            alert(
                                "Could not cancel: " +
                                error.message
                            );

                            cancelButton.disabled = false;

                            return;
                        }

                        await loadReservations();
                    }
                );

                item.append(cancelButton);
            }

            container.append(item);
        }
    }

    // =====================================
    // INITIALIZATION
    // =====================================

    if (isAdmin) {

        adminPanel.hidden = false;

        adminReservations.hidden = false;
    }

    connection.textContent =
        "CONNECTED TO SUPABASE";

    await loadDolls();

    await loadReservations();

    // =====================================
    // REALTIME UPDATES
    // =====================================

    realtimeChannel = supabase

        .channel("dolls-for-rent-live")

        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "dolls"
            },
            async () => {

                await loadDolls();

                await loadReservations();
            }
        )

        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "doll_reservations"
            },
            async () => {

                await loadReservations();
            }
        )

        .subscribe(status => {

            if (status === "SUBSCRIBED") {

                connection.textContent =
                    "CONNECTED TO SUPABASE // REALTIME ACTIVE";
            }

            if (
                status === "CHANNEL_ERROR" ||
                status === "TIMED_OUT"
            ) {

                connection.textContent =
                    "DATABASE CONNECTED // REALTIME ERROR";
            }
        });

    // =====================================
    // CONNECTION CLEANUP
    // =====================================

    window.addEventListener(
        "beforeunload",
        () => {

            if (realtimeChannel) {

                supabase.removeChannel(
                    realtimeChannel
                );
            }
        }
    );

})();
