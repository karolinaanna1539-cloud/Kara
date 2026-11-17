
/* =========================================
   KAROLINA ARCHIVE
   DOLLS FOR RENT
   Supabase + Reservations + Admin
   Personal Archive Integration
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
    // LOAD DOLLS
    // =====================================

    async function loadDolls() {
        const { data, error } = await supabase
            .from("dolls")
            .select("*")
            .order("created_at", { ascending: false });

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
            const card = makeElement("article", "doll-card");

            // IMAGE
            if (doll.image_path) {
                const imageUrl = await getImageUrl(doll.image_path);

                if (imageUrl) {
                    const image = makeElement("img", "doll-image");

                    image.src = imageUrl;
                    image.alt = doll.name || "Doll";
                    image.loading = "lazy";

                    card.append(image);
                } else {
                    card.append(
                        makeElement(
                            "div",
                            "doll-image-placeholder",
                            "IMAGE UNAVAILABLE"
                        )
                    );
                }
            } else {
                card.append(
                    makeElement(
                        "div",
                        "doll-image-placeholder",
                        "NO IMAGE"
                    )
                );
            }

            // NAME
            card.append(
                makeElement("h3", "", doll.name || "UNNAMED DOLL")
            );

            // PERSONAL ARCHIVE BUTTON
            const profileButton = makeElement(
                "button",
                "dolls-action-button",
                "OPEN PERSONAL ARCHIVE →"
            );

            profileButton.type = "button";

            profileButton.addEventListener("click", () => {
                window.location.href =
                    `doll-details.html?id=${encodeURIComponent(doll.id)}`;
            });

            card.append(profileButton);

            // STATUS
            card.append(
                makeElement(
                    "span",
                    "doll-status",
                    "AVAILABLE FOR RESERVATION"
                )
            );

            // DESCRIPTION
            if (doll.description) {
                card.append(
                    makeElement(
                        "p",
                        "doll-description",
                        doll.description
                    )
                );
            }

            // ADDITIONAL DETAILS
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
            // RESERVATION FORM
            // =================================

            const bookingForm = makeElement(
                "form",
                "dolls-booking-form"
            );

            const startLabel = makeElement(
                "label",
                "",
                "START DATE"
            );

            const startInput = makeElement("input");

            startInput.type = "date";
            startInput.required = true;
            startInput.min = today();

            const endLabel = makeElement(
                "label",
                "",
                "END DATE"
            );

            const endInput = makeElement("input");

            endInput.type = "date";
            endInput.required = true;
            endInput.min = today();

            startInput.addEventListener("change", () => {
                endInput.min = startInput.value || today();

                if (
                    endInput.value &&
                    endInput.value < startInput.value
                ) {
                    endInput.value = startInput.value;
                }
            });

            const reserveButton = makeElement(
                "button",
                "",
                "RESERVE"
            );

            reserveButton.type = "submit";

            bookingForm.append(
                startLabel,
                startInput,
                endLabel,
                endInput,
                reserveButton
            );

            const bookingMessage = makeElement(
                "p",
                "dolls-form-message"
            );

            bookingForm.addEventListener("submit", async event => {
                event.preventDefault();

                const startDate = startInput.value;
                const endDate = endInput.value;

                if (!startDate || !endDate) {
                    showMessage(
                        bookingMessage,
                        "PLEASE SELECT BOTH DATES.",
                        true
                    );

                    return;
                }

                if (startDate < today()) {
                    showMessage(
                        bookingMessage,
                        "START DATE CANNOT BE IN THE PAST.",
                        true
                    );

                    return;
                }

                if (endDate < startDate) {
                    showMessage(
                        bookingMessage,
                        "END DATE MUST NOT BE BEFORE START DATE.",
                        true
                    );

                    return;
                }

                reserveButton.disabled = true;
                reserveButton.textContent = "RESERVING...";

                const { error } = await supabase
                    .from("doll_reservations")
                    .insert({
                        doll_id: doll.id,
                        user_id: user.id,
                        start_date: startDate,
                        end_date: endDate,
                        status: "confirmed"
                    });

                reserveButton.disabled = false;
                reserveButton.textContent = "RESERVE";

                if (error) {
                    console.error("Reservation error:", error);

                    const errorText = error.message.toLowerCase();

                    showMessage(
                        bookingMessage,
                        errorText.includes("already reserved")
                            ? "THIS DATE RANGE IS ALREADY RESERVED."
                            : "RESERVATION FAILED: " + error.message,
                        true
                    );

                    return;
                }

                showMessage(
                    bookingMessage,
                    "RESERVATION CONFIRMED."
                );

                startInput.value = "";
                endInput.value = "";

                await loadReservations();
            });

            card.append(bookingForm, bookingMessage);

            // =================================
            // ADMIN CONTROLS
            // =================================

            if (isAdmin) {
                const actions = makeElement(
                    "div",
                    "dolls-admin-actions"
                );

                // EDIT
                const editButton = makeElement(
                    "button",
                    "dolls-action-button",
                    "EDIT"
                );

                editButton.type = "button";

                editButton.addEventListener("click", () => {
                    $("dollEditId").value = doll.id;

                    $("dollName").value = doll.name || "";
                    $("dollDescription").value =
                        doll.description || "";
                    $("dollDetails").value =
                        doll.details || "";

                    saveButton.textContent = "SAVE CHANGES";
                    cancelEditButton.hidden = false;

                    adminPanel.scrollIntoView({
                        behavior: "smooth"
                    });
                });

                // DELETE
                const deleteButton = makeElement(
                    "button",
                    "dolls-action-button dolls-delete",
                    "DELETE"
                );

                deleteButton.type = "button";

                deleteButton.addEventListener("click", async () => {
                    if (!confirm(`Delete "${doll.name}"?`)) {
                        return;
                    }

                    deleteButton.disabled = true;
                    deleteButton.textContent = "DELETING...";

                    const { error } = await supabase
                        .from("dolls")
                        .delete()
                        .eq("id", doll.id);

                    if (error) {
                        console.error("Delete error:", error);

                        alert(
                            "Could not delete doll: " + error.message
                        );

                        deleteButton.disabled = false;
                        deleteButton.textContent = "DELETE";

                        return;
                    }

                    // Remove main image
                    if (doll.image_path) {
                        await supabase.storage
                            .from(BUCKET)
                            .remove([doll.image_path]);
                    }

                    // Gallery records are deleted automatically
                    // by ON DELETE CASCADE. Remove their files too.
                    const { data: galleryFiles } = await supabase
                        .from("doll_gallery")
                        .select("image_path")
                        .eq("doll_id", doll.id);

                    if (galleryFiles && galleryFiles.length) {
                        await supabase.storage
                            .from(BUCKET)
                            .remove(
                                galleryFiles.map(item => item.image_path)
                            );
                    }

                    await loadDolls();
                    await loadReservations();
                });

                actions.append(editButton, deleteButton);
                card.append(actions);
            }

            grid.append(card);
        }
    }

    // =====================================
    // ADD / EDIT DOLL
    // =====================================

    if (isAdmin) {
        form.addEventListener("submit", async event => {
            event.preventDefault();

            const editId = $("dollEditId").value;
            const name = $("dollName").value.trim();

            const description =
                $("dollDescription").value.trim();

            const details =
                $("dollDetails").value.trim();

            const file = $("dollImage").files[0];

            if (!name) return;

            if (file && file.size > 10 * 1024 * 1024) {
                showMessage(
                    formMessage,
                    "IMAGE IS LARGER THAN 10 MB.",
                    true
                );

                return;
            }

            if (
                file &&
                ![
                    "image/jpeg",
                    "image/png",
                    "image/webp",
                    "image/gif"
                ].includes(file.type)
            ) {
                showMessage(
                    formMessage,
                    "UNSUPPORTED IMAGE FORMAT.",
                    true
                );

                return;
            }

            saveButton.disabled = true;
            saveButton.textContent = "SAVING...";

            let imagePath = null;

            const oldDoll = editId
                ? dolls.find(item => item.id === editId)
                : null;

            // UPLOAD IMAGE
            if (file) {
                const safeName = file.name.replace(
                    /[^a-zA-Z0-9._-]/g,
                    "_"
                );

                imagePath =
                    `${user.id}/${crypto.randomUUID()}-${safeName}`;

                const { error: uploadError } = await supabase.storage
                    .from(BUCKET)
                    .upload(imagePath, file, {
                        contentType: file.type,
                        upsert: false
                    });

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
                        updated_at: new Date().toISOString()
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

            if (result.error) {
                console.error("Save error:", result.error);

                showMessage(
                    formMessage,
                    "SAVE FAILED: " + result.error.message,
                    true
                );

                if (imagePath) {
                    await supabase.storage
                        .from(BUCKET)
                        .remove([imagePath]);
                }
            } else {
                // Remove previous image after successful update
                if (
                    editId &&
                    imagePath &&
                    oldDoll &&
                    oldDoll.image_path
                ) {
                    await supabase.storage
                        .from(BUCKET)
                        .remove([oldDoll.image_path]);
                }

                showMessage(
                    formMessage,
                    editId
                        ? "DOLL UPDATED."
                        : "DOLL ADDED."
                );

                resetForm();

                await loadDolls();
            }

            saveButton.disabled = false;

            saveButton.textContent = "ADD DOLL";
        });

        cancelEditButton.addEventListener("click", resetForm);
    }

    // =====================================
    // LOAD RESERVATIONS
    // =====================================

    async function loadReservations() {
        const { data, error } = await supabase
            .from("doll_reservations")
            .select("*")
            .order("start_date", { ascending: true });

        if (error) {
            console.error("Reservations loading error:", error);
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
        const container = $("myDollReservations");

        container.replaceChildren();

        const mine = reservations.filter(
            reservation => reservation.user_id === user.id
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
                item => item.id === reservation.doll_id
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
                name.title = "OPEN PERSONAL ARCHIVE";

                name.addEventListener("click", () => {
                    window.location.href =
                        `doll-details.html?id=${encodeURIComponent(doll.id)}`;
                });
            }

            item.append(name);

            item.append(
                makeElement(
                    "p",
                    "",
                    `${formatDate(reservation.start_date)} — ${formatDate(reservation.end_date)}`
                )
            );

            item.append(
                makeElement(
                    "p",
                    "",
                    `STATUS: ${reservation.status.toUpperCase()}`
                )
            );

            if (reservation.status === "confirmed") {
                const cancelButton = makeElement(
                    "button",
                    "dolls-action-button dolls-delete",
                    "CANCEL RESERVATION"
                );

                cancelButton.addEventListener("click", async () => {
                    if (!confirm("Cancel this reservation?")) return;

                    cancelButton.disabled = true;

                    const { error } = await supabase
                        .from("doll_reservations")
                        .update({ status: "cancelled" })
                        .eq("id", reservation.id);

                    if (error) {
                        alert(
                            "Cancellation failed: " + error.message
                        );

                        cancelButton.disabled = false;
                        return;
                    }

                    await loadReservations();
                });

                item.append(cancelButton);
            }

            container.append(item);
        }
    }

    // =====================================
    // ADMIN: ALL RESERVATIONS
    // =====================================

    async function renderAllReservations() {
        const container = $("allDollReservations");

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
                item => item.id === reservation.doll_id
            );

            const item = makeElement(
                "div",
                "dolls-reservation"
            );

            item.append(
                makeElement(
                    "strong",
                    "",
                    doll ? doll.name : "DOLL"
                )
            );

            item.append(
                makeElement(
                    "p",
                    "",
                    `USER: ${reservation.user_id.slice(-6).toUpperCase()}`
                )
            );

            item.append(
                makeElement(
                    "p",
                    "",
                    `${formatDate(reservation.start_date)} — ${formatDate(reservation.end_date)}`
                )
            );

            item.append(
                makeElement(
                    "p",
                    "",
                    `STATUS: ${reservation.status.toUpperCase()}`
                )
            );

            if (reservation.status === "confirmed") {
                const cancelButton = makeElement(
                    "button",
                    "dolls-action-button dolls-delete",
                    "CANCEL RESERVATION"
                );

                cancelButton.addEventListener("click", async () => {
                    if (!confirm("Cancel this reservation?")) return;

                    cancelButton.disabled = true;

                    const { error } = await supabase
                        .from("doll_reservations")
                        .update({ status: "cancelled" })
                        .eq("id", reservation.id);

                    if (error) {
                        alert(
                            "Could not cancel: " + error.message
                        );

                        cancelButton.disabled = false;
                        return;
                    }

                    await loadReservations();
                });

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

    connection.textContent = "CONNECTED TO SUPABASE";

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

            if (status === "CHANNEL_ERROR") {
                connection.textContent =
                    "DATABASE CONNECTED // REALTIME ERROR";
            }
        });

})();
