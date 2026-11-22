
/* =====================================================
   THE DEN
   DOLL RESERVATION CONFIGURATOR
===================================================== */

(function () {
    "use strict";

    const ADMIN_ID = "3d4c3c65-3956-46b3-a83d-aae7e671c0ff";
    const BUCKET = "dolls-for-rent";

    const params = new URLSearchParams(window.location.search);
    const dollId = params.get("id");

    const elements = {
        dollImage: document.getElementById("reservationDollImage"),
        dollName: document.getElementById("reservationDollName"),
        dollDescription: document.getElementById("reservationDollDescription"),

        start: document.getElementById("reservationStart"),
        end: document.getElementById("reservationEnd"),

        clothing: document.getElementById("reservationClothing"),
        makeup: document.getElementById("reservationMakeup"),
        hairstyle: document.getElementById("reservationHairstyle"),
        nails: document.getElementById("reservationNails"),
        accessories: document.getElementById("reservationAccessories"),

        notes: document.getElementById("reservationNotes"),
        summary: document.getElementById("reservationSummary"),

        reviewButton: document.getElementById("reservationReviewButton"),
        confirmButton: document.getElementById("reservationConfirmButton"),

        message: document.getElementById("reservationMessage"),
        connection: document.getElementById("reservationConnection"),
        form: document.getElementById("reservationForm")
    };

    const categoryConfig = {
        clothing: {
            element: elements.clothing,
            title: "Clothing",
            multiple: false
        },
        makeup: {
            element: elements.makeup,
            title: "Make-up",
            multiple: false
        },
        hairstyle: {
            element: elements.hairstyle,
            title: "Hairstyle",
            multiple: false
        },
        nails: {
            element: elements.nails,
            title: "Nails",
            multiple: false
        },
        accessories: {
            element: elements.accessories,
            title: "Accessories",
            multiple: true
        }
    };

    let supabase = null;
    let currentUser = null;
    let currentDoll = null;
    let galleryOptions = [];
    let isSubmitting = false;

    function showMessage(element, message, type) {
        if (!element) return;

        element.textContent = message;
        element.className = "reservation-message " + type;
    }

    function clearMessage(element) {
        if (!element) return;

        element.textContent = "";
        element.className = "reservation-message";
    }

    function localDateString(date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    function setDateLimits() {
        const today = localDateString();

        elements.start.min = today;
        elements.end.min = today;

        elements.start.addEventListener("change", function () {
            elements.end.min = elements.start.value || today;

            if (
                elements.end.value &&
                elements.end.value < elements.start.value
            ) {
                elements.end.value = elements.start.value;
            }

            updateSummary();
        });

        elements.end.addEventListener("change", updateSummary);
    }

    function validateDates() {
        const start = elements.start.value;
        const end = elements.end.value;
        const today = localDateString();

        if (!start || !end) {
            return "Please select both reservation dates.";
        }

        if (start < today) {
            return "The start date cannot be in the past.";
        }

        if (end < start) {
            return "The end date cannot be earlier than the start date.";
        }

        return null;
    }

    async function loadDoll() {
        const { data, error } = await supabase
            .from("dolls")
            .select("*")
            .eq("id", dollId)
            .single();

        if (error) throw error;

        currentDoll = data;

        elements.dollName.textContent = data.name || "Unnamed doll";
        elements.dollDescription.textContent = data.description || "";

        if (data.image_path) {
            const { data: imageData } = await supabase
                .storage
                .from(BUCKET)
                .createSignedUrl(data.image_path, 3600);

            if (imageData?.signedUrl) {
                elements.dollImage.src = imageData.signedUrl;
                elements.dollImage.hidden = false;
            }
        }
    }

    async function loadGallery() {
        const { data, error } = await supabase
            .from("doll_gallery")
            .select("id, doll_id, image_path, caption, category")
            .eq("doll_id", dollId)
            .order("created_at", { ascending: true });

        if (error) throw error;

        galleryOptions = data || [];

        for (const category of Object.keys(categoryConfig)) {
            const config = categoryConfig[category];

            const categoryItems = galleryOptions.filter(item => {
                return item.category === category;
            });

            await renderCategory(category, categoryItems, config);
        }
    }

    async function renderCategory(category, items, config) {
        const container = config.element;

        if (!container) return;

        container.innerHTML = "";

        if (!items.length) {
            container.innerHTML =
                '<p class="reservation-empty">No options available in this category.</p>';
            return;
        }

        for (const item of items) {
            const option = document.createElement("label");
            option.className = "reservation-option";

            const input = document.createElement("input");

            input.type = config.multiple ? "checkbox" : "radio";
            input.name = "reservation-" + category;
            input.value = item.id;

            input.addEventListener("change", function () {
                if (!config.multiple) {
                    container
                        .querySelectorAll(".reservation-option")
                        .forEach(card => card.classList.remove("selected"));
                }

                option.classList.toggle("selected", input.checked);

                updateSummary();
            });

            const image = document.createElement("img");
            image.alt = item.caption || config.title;

            const { data: imageData, error } = await supabase
                .storage
                .from(BUCKET)
                .createSignedUrl(item.image_path, 3600);

            if (!error && imageData?.signedUrl) {
                image.src = imageData.signedUrl;
            }

            const info = document.createElement("div");
            info.className = "reservation-option-info";
            info.textContent = item.caption || "Unnamed option";

            option.appendChild(input);
            option.appendChild(image);
            option.appendChild(info);

            container.appendChild(option);
        }
    }

    function getSelectedOptions() {
        const selected = [];

        for (const category of Object.keys(categoryConfig)) {
            const config = categoryConfig[category];

            const checked = config.element.querySelectorAll(
                'input:checked'
            );

            checked.forEach(input => {
                const item = galleryOptions.find(option => {
                    return String(option.id) === String(input.value);
                });

                if (!item) return;

                selected.push({
                    id: item.id,
                    category: category,
                    caption: item.caption || "",
                    image_path: item.image_path
                });
            });
        }

        return selected;
    }

    function updateSummary() {
        const selected = getSelectedOptions();

        const start = elements.start.value || "Not selected";
        const end = elements.end.value || "Not selected";

        let html = `
            <h3>RESERVATION SUMMARY</h3>
            <p><strong>Doll:</strong> ${escapeHTML(currentDoll?.name || "Loading...")}</p>
            <p><strong>Start:</strong> ${escapeHTML(start)}</p>
            <p><strong>End:</strong> ${escapeHTML(end)}</p>
        `;

        for (const category of Object.keys(categoryConfig)) {
            const config = categoryConfig[category];

            const categorySelections = selected.filter(item => {
                return item.category === category;
            });

            const names = categorySelections.length
                ? categorySelections.map(item => escapeHTML(item.caption || "Unnamed option")).join(", ")
                : "Not selected";

            html += `
                <p><strong>${escapeHTML(config.title)}:</strong> ${names}</p>
            `;
        }

        const notes = elements.notes.value.trim();

        html += `
            <p><strong>Additional notes:</strong> ${
                notes ? escapeHTML(notes) : "None"
            }</p>
        `;

        elements.summary.innerHTML = html;
        elements.confirmButton.disabled = !currentDoll || !elements.start.value || !elements.end.value;

        clearMessage(elements.message);
    }

    function escapeHTML(value) {
        return String(value).replace(/[&<>"']/g, character => {
            const entities = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            };

            return entities[character];
        });
    }

    async function confirmReservation(event) {
        event.preventDefault();

        if (isSubmitting) return;

        clearMessage(elements.message);

        const dateError = validateDates();

        if (dateError) {
            showMessage(elements.message, dateError, "error");
            return;
        }

        if (!currentDoll || !currentUser) {
            showMessage(
                elements.message,
                "Your session or selected doll could not be verified. Please reload the page.",
                "error"
            );
            return;
        }

        const selectedOptions = getSelectedOptions();
        const notes = elements.notes.value.trim();

        const reservationOptions = {
            selections: selectedOptions,
            notes: notes
        };

        isSubmitting = true;
        elements.confirmButton.disabled = true;
        elements.confirmButton.textContent = "SAVING...";

        try {
            const { error } = await supabase
                .from("doll_reservations")
                .insert({
                    doll_id: dollId,
                    user_id: currentUser.id,
                    start_date: elements.start.value,
                    end_date: elements.end.value,
                    status: "confirmed",
                    reservation_options: reservationOptions
                });

            if (error) throw error;

            showMessage(
                elements.message,
                "Reservation confirmed successfully.",
                "success"
            );

            elements.confirmButton.textContent = "CONFIRMED";
            elements.confirmButton.disabled = true;

            elements.reviewButton.disabled = true;
            elements.form.querySelectorAll("input, textarea").forEach(input => {
                input.disabled = true;
            });

        } catch (error) {
            console.error("Reservation error:", error);

            let message =
                error.message || "Could not save your reservation.";

            if (
                message.toLowerCase().includes("already reserved") ||
                message.toLowerCase().includes("overlap")
            ) {
                message =
                    "This doll is already reserved for some or all of the selected dates. Please choose another period.";
            }

            showMessage(elements.message, message, "error");

            elements.confirmButton.disabled = false;
            elements.confirmButton.textContent = "CONFIRM RESERVATION";

        } finally {
            isSubmitting = false;
        }
    }

    async function init() {
        if (!dollId) {
            showMessage(
                elements.connection,
                "No doll was selected. Please return to the doll catalogue.",
                "error"
            );
            return;
        }

        try {
            await window.archiveAuthReady;

            supabase = window.archiveSupabase;

            if (!supabase) {
                throw new Error("Supabase connection is unavailable.");
            }

            const {
                data: { session },
                error: sessionError
            } = await supabase.auth.getSession();

            if (sessionError) throw sessionError;

            if (!session?.user) {
                throw new Error("You must be logged in to make a reservation.");
            }

            currentUser = session.user;

            setDateLimits();

            await loadDoll();
            await loadGallery();

            elements.reviewButton.addEventListener("click", function () {
                const dateError = validateDates();

                if (dateError) {
                    showMessage(elements.message, dateError, "error");
                    return;
                }

                updateSummary();

                showMessage(
                    elements.message,
                    "Please check your reservation details before confirming.",
                    "success"
                );
            });

            elements.notes.addEventListener("input", updateSummary);

            elements.form.addEventListener("submit", confirmReservation);

            updateSummary();

            showMessage(
                elements.connection,
                "Connected. You can now configure your reservation.",
                "success"
            );

        } catch (error) {
            console.error("Reservation setup error:", error);

            showMessage(
                elements.connection,
                error.message || "Could not load the reservation page.",
                "error"
            );
        }
    }

    init();

})();
