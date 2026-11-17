
/* =========================================
   KAROLINA ARCHIVE
   DOLLS FOR RENT
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

    const $ = (id) => document.getElementById(id);

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

    function today() {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    function showMessage(element, message, error = false) {
        if (!element) return;

        element.textContent = message;
        element.classList.toggle("error", error);
    }

    function makeElement(tag, className, text) {
        const element = document.createElement(tag);

        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;

        return element;
    }

    function formatDate(date) {
        if (!date) return "";

        return new Date(date + "T12:00:00").toLocaleDateString();
    }

    function resetForm() {
        form.reset();
        $("dollEditId").value = "";
        saveButton.textContent = "ADD DOLL";
        cancelEditButton.hidden = true;
        showMessage(formMessage, "");
    }

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
            console.error(error);
            connection.textContent = "DATABASE ERROR: " + error.message;
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

            card.append(makeElement("h3", "", doll.name));

            card.append(
                makeElement(
                    "span",
                    "doll-status",
                    "AVAILABLE FOR RESERVATION"
                )
            );

            if (doll.description) {
                card.append(
                    makeElement(
                        "p",
                        "doll-description",
                        doll.description
                    )
                );
            }

            if (doll.details) {
                card.append(
                    makeElement(
                        "p",
                        "doll-details",
                        doll.details
                    )
                );
            }

            // Reservation form
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

                if (endInput.value && endInput.value < startInput.value) {
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

            bookingForm.addEventListener("submit", async (event) => {
                event.preventDefault();

                const startDate = startInput.value;
                const endDate = endInput.value;

                if (startDate < today()) {
                    showMessage(
                        bookingMessage,
                        "Start date cannot be in the past.",
                        true
                    );
                    return;
                }

                if (endDate < startDate) {
                    showMessage(
                        bookingMessage,
                        "End date must be after start date.",
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
                    console.error(error);

                    showMessage(
                        bookingMessage,
                        error.message.includes("already reserved")
                            ? "This date range is already reserved."
                            : "Reservation failed: " + error.message,
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

            // Admin controls
            if (isAdmin) {
                const actions = makeElement(
                    "div",
                    "dolls-admin-actions"
                );

                const editButton = makeElement(
                    "button",
                    "dolls-action-button",
                    "EDIT"
                );

                editButton.type = "button";
                editButton.addEventListener("click", () => {
                    $("dollEditId").value = doll.id;
                    $("dollName").value = doll.name || "";
                    $("dollDescription").value = doll.description || "";
                    $("dollDetails").value = doll.details || "";

                    saveButton.textContent = "SAVE CHANGES";
                    cancelEditButton.hidden = false;

                    adminPanel.scrollIntoView({
                        behavior: "smooth"
                    });
                });

                const deleteButton = makeElement(
                    "button",
                    "dolls-action-button dolls-delete",
                    "DELETE"
                );

                deleteButton.type = "button";
                deleteButton.addEventListener("click", async () => {
                    if (!confirm(`Delete "${doll.name}"?`)) return;

                    const { error } = await supabase
                        .from("dolls")
                        .delete()
                        .eq("id", doll.id);

                    if (error) {
                        alert("Could not delete doll: " + error.message);
                        return;
                    }

                    if (doll.image_path) {
                        await supabase.storage
                            .from(BUCKET)
                            .remove([doll.image_path]);
                    }

                    await loadDolls();
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
        form.addEventListener("submit", async (event) => {
            event.preventDefault();

            const editId = $("dollEditId").value;
            const name = $("dollName").value.trim();
            const description = $("dollDescription").value.trim();
            const details = $("dollDetails").value.trim();
            const file = $("dollImage").files[0];

            if (!name) return;

            if (file && file.size > 10 * 1024 * 1024) {
                showMessage(
                    formMessage,
                    "Image is larger than 10 MB.",
                    true
                );
                return;
            }

            if (
                file &&
                !["image/jpeg", "image/png", "image/webp", "image/gif"]
                    .includes(file.type)
            ) {
                showMessage(
                    formMessage,
                    "Unsupported image format.",
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

            if (file) {
                const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

                imagePath = `${user.id}/${crypto.randomUUID()}-${safeName}`;

                const { error: uploadError } = await supabase.storage
                    .from(BUCKET)
                    .upload(imagePath, file, {
                        contentType: file.type,
                        upsert: false
                    });

                if (uploadError) {
                    showMessage(
                        formMessage,
                        "Image upload failed: " + uploadError.message,
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
                showMessage(
                    formMessage,
                    "Save failed: " + result.error.message,
                    true
                );

                if (imagePath) {
                    await supabase.storage
                        .from(BUCKET)
                        .remove([imagePath]);
                }
            } else {
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
                    editId ? "DOLL UPDATED." : "DOLL ADDED."
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
            console.error(error);
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

                    const { error } = await supabase
                        .from("doll_reservations")
                        .update({ status: "cancelled" })
                        .eq("id", reservation.id);

                    if (error) {
                        alert("Cancellation failed: " + error.message);
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

                    const { error } = await supabase
                        .from("doll_reservations")
                        .update({ status: "cancelled" })
                        .eq("id", reservation.id);

                    if (error) {
                        alert("Could not cancel: " + error.message);
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

    // Realtime updates
    supabase
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
        .subscribe();

})();
