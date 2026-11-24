
/* =====================================================
   THE DEN
   RESERVATION CENTER
   MODULE 09.02 / 09.03
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

    const DOLL_BUCKET = "dolls-for-rent";
    const WISHLIST_BUCKET = "doll-wishlist";

    const dollId = new URLSearchParams(
        window.location.search
    ).get("id");

    const $ = id => document.getElementById(id);

    const categoryConfig = {
        clothing: {
            container: "reservationClothing",
            label: "CLOTHING",
            multiple: false
        },
        makeup: {
            container: "reservationMakeup",
            label: "MAKE-UP",
            multiple: false
        },
        hairstyle: {
            container: "reservationHairstyle",
            label: "HAIRSTYLE",
            multiple: false
        },
        nails: {
            container: "reservationNails",
            label: "NAILS",
            multiple: false
        },
        accessories: {
            container: "reservationAccessories",
            label: "ACCESSORIES",
            multiple: true
        }
    };

    const wishlistStatuses = [
        "pending",
        "under_review",
        "approved",
        "declined",
        "completed"
    ];

    const allowedImageTypes = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp"
    };

    let doll = null;
    let galleryOptions = [];
    let reviewedSignature = null;
    let reservationBusy = false;
    let reservationSubmitted = false;
    let wishlistBusy = false;
    let previewUrl = null;
    let wishlistLoadVersion = 0;

    /* =================================================
       HELPERS
    ================================================= */

    function element(tag, className, content) {

        const node = document.createElement(tag);

        if (className) {
            node.className = className;
        }

        if (content !== undefined) {
            node.textContent = content;
        }

        return node;

    }

    function showMessage(id, message, type = "info") {

        const target = $(id);

        if (!target) return;

        target.textContent = message;

        target.className = message
            ? "reservation-message " + type
            : "reservation-message";

    }

    function stockholmToday() {

        const parts = new Intl.DateTimeFormat(
            "en-GB",
            {
                timeZone: "Europe/Stockholm",
                year: "numeric",
                month: "2-digit",
                day: "2-digit"
            }
        ).formatToParts(new Date());

        const values = Object.fromEntries(
            parts.map(part => [
                part.type,
                part.value
            ])
        );

        return (
            values.year + "-" +
            values.month + "-" +
            values.day
        );

    }

    function formatDate(value) {

        if (!value) return "NOT SPECIFIED";

        return new Intl.DateTimeFormat(
            "en-GB",
            {
                day: "2-digit",
                month: "long",
                year: "numeric",
                timeZone: "UTC"
            }
        ).format(
            new Date(value + "T12:00:00Z")
        );

    }

    function formatTimestamp(value) {

        if (!value) return "";

        return new Intl.DateTimeFormat(
            "en-GB",
            {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Europe/Stockholm"
            }
        ).format(new Date(value));

    }

    function statusLabel(status) {

        return String(status || "")
            .replace(/_/g, " ")
            .toUpperCase();

    }

    function categoryLabel(category) {

        return categoryConfig[category]?.label
            || statusLabel(category);

    }

    function scrollToElement(target) {

        if (!target) return;

        const reducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;

        target.scrollIntoView({
            behavior: reducedMotion ? "auto" : "smooth",
            block: "start"
        });

    }

    async function getSignedImage(
        bucket,
        path,
        expires = 3600
    ) {

        if (!path) return null;

        const { data, error } = await supabase
            .storage
            .from(bucket)
            .createSignedUrl(path, expires);

        if (error) {
            console.error(error);
            return null;
        }

        return data?.signedUrl || null;

    }

    /* =================================================
       LOAD SELECTED DOLL
    ================================================= */

    async function loadDoll() {

        if (!dollId) {

            $("reservationDollName").textContent =
                "NO PROFILE SELECTED";

            $("reservationDollDescription").textContent =
                "You can still submit an independent wishlist request.";

            return false;

        }

        const { data, error } = await supabase
            .from("dolls")
            .select("*")
            .eq("id", dollId)
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            throw new Error("Selected profile was not found.");
        }

        doll = data;

        $("reservationDollName").textContent =
            doll.name || "UNNAMED PROFILE";

        $("reservationDollDescription").textContent =
            doll.description || "";

        if (doll.image_path) {

            const url = await getSignedImage(
                DOLL_BUCKET,
                doll.image_path
            );

            if (url) {

                $("reservationDollImage").src = url;
                $("reservationDollImage").hidden = false;

            }

        }

        if (doll.active !== true) {

            showMessage(
                "reservationConnection",
                "This profile is currently unavailable for reservations. Wishlist requests remain available.",
                "info"
            );

            return false;

        }

        return true;

    }

    /* =================================================
       LOAD CUSTOMIZATION OPTIONS
    ================================================= */

    async function loadGalleryOptions() {

        const { data, error } = await supabase
            .from("doll_gallery")
            .select(
                "id,doll_id,image_path,caption,category"
            )
            .eq("doll_id", doll.id)
            .order("created_at", {
                ascending: false
            });

        if (error) throw error;

        galleryOptions = data || [];

        for (
            const [category, config]
            of Object.entries(categoryConfig)
        ) {

            const items = galleryOptions.filter(
                item => item.category === category
            );

            await renderCategory(
                category,
                config,
                items
            );

        }

    }

    async function renderCategory(
        category,
        config,
        items
    ) {

        const container = $(config.container);

        container.replaceChildren();

        if (!items.length) {

            container.appendChild(
                element(
                    "p",
                    "reservation-empty",
                    "No options available in this category."
                )
            );

            updateCategoryCount(category);
            return;

        }

        if (!config.multiple) {

            const defaultOption = element(
                "label",
                "reservation-option selected"
            );

            const defaultInput =
                document.createElement("input");

            defaultInput.type = "radio";
            defaultInput.name = "reservation-" + category;
            defaultInput.value = "";
            defaultInput.checked = true;

            const defaultText = element(
                "div",
                "reservation-option-info",
                "DEFAULT / NO SPECIFIC PREFERENCE"
            );

            defaultText.style.paddingTop = "42px";

            defaultOption.append(
                defaultInput,
                defaultText
            );

            container.appendChild(defaultOption);

        }

        for (const item of items) {

            const card = element(
                "label",
                "reservation-option"
            );

            const input = document.createElement("input");

            input.type = config.multiple
                ? "checkbox"
                : "radio";

            input.name = "reservation-" + category;
            input.value = item.id;

            card.appendChild(input);

            const url = await getSignedImage(
                DOLL_BUCKET,
                item.image_path
            );

            if (url) {

                const image = document.createElement("img");

                image.src = url;
                image.alt = item.caption || config.label;
                image.loading = "lazy";

                card.appendChild(image);

            }

            const info = element(
                "div",
                "reservation-option-info",
                item.caption || "Unnamed option"
            );

            if (!url) {
                info.style.paddingTop = "42px";
            }

            card.appendChild(info);

            container.appendChild(card);

        }

        container.addEventListener("change", () => {

            updateCategoryCount(category);
            invalidateReview();

        });

        updateCategoryCount(category);

    }

    function updateCategoryCount(category) {

        const config = categoryConfig[category];
        const container = $(config.container);

        let count = 0;

        container.querySelectorAll(
            ".reservation-option"
        ).forEach(card => {

            const input = card.querySelector("input");

            card.classList.toggle(
                "selected",
                Boolean(input?.checked)
            );

            if (input?.checked && input.value) {
                count++;
            }

        });

        const counter = $(category + "SelectedCount");

        if (counter) {

            counter.textContent = count
                ? count + " SELECTED"
                : "OPTIONAL";

        }

    }

    function getSelectedOptions() {

        const selections = [];

        for (
            const [category, config]
            of Object.entries(categoryConfig)
        ) {

            const checked = $(config.container)
                .querySelectorAll("input:checked");

            for (const input of checked) {

                if (!input.value) continue;

                const item = galleryOptions.find(
                    option =>
                        String(option.id) === input.value
                        && option.category === category
                );

                if (!item) continue;

                selections.push({
                    id: item.id,
                    category: category,
                    caption: item.caption || "Unnamed option",
                    image_path: item.image_path
                });

            }

        }

        return selections;

    }

    /* =================================================
       RESERVATION DATES AND LOGISTICS
    ================================================= */

    function getCalendarDays(start, end) {

        if (!start || !end || end < start) {
            return 0;
        }

        const startDate = Date.parse(
            start + "T00:00:00Z"
        );

        const endDate = Date.parse(
            end + "T00:00:00Z"
        );

        return Math.round(
            (endDate - startDate) / 86400000
        ) + 1;

    }

    function updateDuration() {

        const start = $("reservationStart").value;
        const end = $("reservationEnd").value;

        const days = getCalendarDays(start, end);

        $("reservationDuration").textContent =
            days > 0
                ? days + (
                    days === 1
                        ? " CALENDAR DAY"
                        : " CALENDAR DAYS"
                )
                : "NOT SELECTED";

    }

    function updateDates() {

        const today = stockholmToday();

        const start = $("reservationStart");
        const end = $("reservationEnd");

        start.min = today;
        end.min = start.value || today;

        if (
            start.value &&
            end.value &&
            end.value < start.value
        ) {
            end.value = start.value;
        }

        updateDuration();

    }

    function syncReturnLocation() {

        const same = $("reservationSameLocation").checked;

        const pickup = $("reservationPickupLocation");
        const returnLocation = $("reservationReturnLocation");

        returnLocation.readOnly = same;

        if (same) {
            returnLocation.value = pickup.value;
        }

    }

    function getReservationData() {

        return {

            start_date:
                $("reservationStart").value,

            end_date:
                $("reservationEnd").value,

            pickup_time:
                $("reservationPickupTime").value,

            return_time:
                $("reservationReturnTime").value,

            pickup_location:
                $("reservationPickupLocation")
                    .value.trim(),

            return_location:
                $("reservationSameLocation").checked
                    ? $("reservationPickupLocation")
                        .value.trim()
                    : $("reservationReturnLocation")
                        .value.trim(),

            reservation_options: {

                selections: getSelectedOptions(),

                notes:
                    $("reservationNotes").value.trim()

            }

        };

    }

    function validateReservation(data) {

        if (!doll || doll.active !== true) {
            return "This profile is unavailable.";
        }

        if (!data.start_date || !data.end_date) {
            return "Please select pickup and return dates.";
        }

        if (data.start_date < stockholmToday()) {
            return "Pickup date cannot be in the past.";
        }

        if (data.end_date < data.start_date) {
            return "Return date cannot be before pickup date.";
        }

        if (!data.pickup_time || !data.return_time) {
            return "Please select pickup and return times.";
        }

        if (
            data.start_date === data.end_date &&
            data.return_time <= data.pickup_time
        ) {
            return "Return time must be later than pickup time.";
        }

        return null;

    }

    /* =================================================
       RESERVATION REVIEW
    ================================================= */

    function invalidateReview() {

        reviewedSignature = null;

        $("reservationConfirmButton").disabled = true;

        $("reservationAgreement").checked = false;

        if (!reservationSubmitted) {

            $("reservationSummary").replaceChildren(
                element(
                    "p",
                    "",
                    "Review your reservation to update the summary."
                )
            );

        }

        showMessage("reservationMessage", "");

    }

    function updateConfirmButton() {

        $("reservationConfirmButton").disabled =

            reservationBusy ||
            reservationSubmitted ||
            !reviewedSignature ||
            !$("reservationAgreement").checked;

    }

    function addSummaryItem(
        container,
        label,
        value
    ) {

        const item = element(
            "div",
            "reservation-summary-item"
        );

        item.append(
            element("span", "", label),
            element("strong", "", value)
        );

        container.appendChild(item);

    }

    function addSummaryLine(
        container,
        label,
        value
    ) {

        const line = document.createElement("p");

        line.append(
            element("strong", "", label + ": "),
            document.createTextNode(value)
        );

        container.appendChild(line);

    }

    function reviewReservation() {

        if (reservationBusy || reservationSubmitted) {
            return;
        }

        const data = getReservationData();

        const error = validateReservation(data);

        $("reservationReviewSection").open = true;

        if (error) {

            invalidateReview();

            document.querySelector(
                ".reservation-section"
            ).open = true;

            showMessage(
                "reservationMessage",
                error,
                "error"
            );

            scrollToElement(
                $("reservationReviewSection")
            );

            return;

        }

        const summary = $("reservationSummary");

        summary.replaceChildren();

        summary.appendChild(
            element(
                "h3",
                "",
                "RESERVATION SUMMARY"
            )
        );

        const grid = element(
            "div",
            "reservation-summary-grid"
        );

        addSummaryItem(
            grid,
            "SELECTED PROFILE",
            doll.name
        );

        addSummaryItem(
            grid,
            "RESERVATION DURATION",
            getCalendarDays(
                data.start_date,
                data.end_date
            ) + " calendar day(s)"
        );

        addSummaryItem(
            grid,
            "PICKUP",
            formatDate(data.start_date)
                + " · " + data.pickup_time
        );

        addSummaryItem(
            grid,
            "RETURN",
            formatDate(data.end_date)
                + " · " + data.return_time
        );

        addSummaryItem(
            grid,
            "PICKUP LOCATION",
            data.pickup_location
                || "To be agreed privately"
        );

        addSummaryItem(
            grid,
            "RETURN LOCATION",
            data.return_location
                || "To be agreed privately"
        );

        summary.appendChild(grid);

        summary.appendChild(
            element(
                "h3",
                "",
                "PERSONAL CONFIGURATION"
            )
        );

        for (
            const [category, config]
            of Object.entries(categoryConfig)
        ) {

            const selected =
                data.reservation_options.selections
                    .filter(
                        item => item.category === category
                    );

            addSummaryLine(
                summary,
                config.label,
                selected.length
                    ? selected.map(
                        item => item.caption
                    ).join(", ")
                    : "Default / no specific preference"
            );

        }

        addSummaryLine(
            summary,
            "ADDITIONAL NOTES",
            data.reservation_options.notes || "None"
        );

        addSummaryLine(
            summary,
            "TIME ZONE",
            "Europe/Stockholm"
        );

        addSummaryLine(
            summary,
            "WISHLIST",
            "Separate requests require individual approval."
        );

        reviewedSignature = JSON.stringify(data);

        $("reservationAgreement").checked = false;

        updateConfirmButton();

        showMessage(
            "reservationMessage",
            "Please review the information and accept the confirmation statement.",
            "info"
        );

        scrollToElement(
            $("reservationReviewSection")
        );

    }

    /* =================================================
       SUBMIT RESERVATION
    ================================================= */

    $("reservationForm").addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            if (
                reservationBusy ||
                reservationSubmitted
            ) return;

            const data = getReservationData();

            const validationError =
                validateReservation(data);

            if (validationError) {

                showMessage(
                    "reservationMessage",
                    validationError,
                    "error"
                );

                return;

            }

            if (
                !reviewedSignature ||
                reviewedSignature !== JSON.stringify(data)
            ) {

                reviewReservation();
                return;

            }

            if (!$("reservationAgreement").checked) {

                showMessage(
                    "reservationMessage",
                    "Please accept the confirmation statement.",
                    "error"
                );

                return;

            }

            reservationBusy = true;

            $("reservationFields").disabled = true;
            $("reservationQuickReview").disabled = true;

            $("reservationConfirmButton").textContent =
                "SUBMITTING REQUEST...";

            showMessage(
                "reservationMessage",
                "Submitting your reservation...",
                "info"
            );

            try {

                const { data: saved, error } =
                    await supabase
                        .from("doll_reservations")
                        .insert({

                            doll_id: doll.id,
                            user_id: user.id,

                            ...data,

                            status: "pending"

                        })
                        .select("id,status")
                        .single();

                if (error) throw error;

                reservationSubmitted = true;

                const reference = String(saved.id)
                    .slice(0, 8)
                    .toUpperCase();

                $("reservationSummary").appendChild(
                    element(
                        "p",
                        "",
                        "RESERVATION REFERENCE: RES-" +
                        reference
                    )
                );

                $("reservationConfirmButton").textContent =
                    "REQUEST SUBMITTED";

                showMessage(
                    "reservationMessage",
                    "Reservation RES-" + reference +
                    " has been submitted successfully. Status: PENDING ADMINISTRATOR APPROVAL.",
                    "success"
                );

            } catch (error) {

                console.error(error);

                showMessage(
                    "reservationMessage",
                    error.message ||
                    "Unable to submit reservation.",
                    "error"
                );

            } finally {

                reservationBusy = false;

                $("reservationFields").disabled =
                    reservationSubmitted;

                $("reservationQuickReview").disabled =
                    reservationSubmitted;

                if (!reservationSubmitted) {

                    $("reservationConfirmButton").textContent =
                        "SUBMIT RESERVATION REQUEST";

                }

                updateConfirmButton();

            }

        }
    );

    /* =================================================
       RESERVATION EVENTS
    ================================================= */

    $("reservationStart").addEventListener(
        "change",
        updateDates
    );

    $("reservationEnd").addEventListener(
        "change",
        updateDuration
    );

    $("reservationSameLocation").addEventListener(
        "change",
        syncReturnLocation
    );

    $("reservationPickupLocation").addEventListener(
        "input",
        syncReturnLocation
    );

    $("reservationForm").addEventListener(
        "input",
        event => {

            if (
                event.target.id === "reservationAgreement"
            ) return;

            invalidateReview();

        }
    );

    $("reservationForm").addEventListener(
        "change",
        event => {

            if (
                event.target.id === "reservationAgreement"
            ) return;

            invalidateReview();

        }
    );

    $("reservationAgreement").addEventListener(
        "change",
        updateConfirmButton
    );

    $("reservationReviewButton").addEventListener(
        "click",
        reviewReservation
    );

    $("reservationQuickReview").addEventListener(
        "click",
        reviewReservation
    );

    /* =================================================
       PRIVATE WISHLIST
    ================================================= */

    async function openWishlist() {

        $("privateWishlist").hidden = false;

        scrollToElement($("privateWishlist"));

        await loadWishlist();

    }

    $("openWishlistButton").addEventListener(
        "click",
        openWishlist
    );

    $("independentWishlistButton").addEventListener(
        "click",
        openWishlist
    );

    $("closeWishlistButton").addEventListener(
        "click",
        () => {

            $("privateWishlist").hidden = true;

            scrollToElement(
                $("independentWishlistButton")
            );

        }
    );

    function clearImagePreview() {

        if (previewUrl) {

            URL.revokeObjectURL(previewUrl);
            previewUrl = null;

        }

        $("wishlistImagePreview").hidden = true;

        $("wishlistImagePreview").removeAttribute(
            "src"
        );

    }

    function validateImage(file) {

        if (!file) return null;

        if (!allowedImageTypes[file.type]) {

            return "Only JPG, PNG and WEBP images are supported.";

        }

        if (file.size > 10 * 1024 * 1024) {

            return "Reference image cannot exceed 10 MB.";

        }

        return null;

    }

    $("wishlistImage").addEventListener(
        "change",
        () => {

            clearImagePreview();

            const file =
                $("wishlistImage").files[0];

            if (!file) return;

            const error = validateImage(file);

            if (error) {

                $("wishlistImage").value = "";

                showMessage(
                    "wishlistMessage",
                    error,
                    "error"
                );

                return;

            }

            previewUrl = URL.createObjectURL(file);

            $("wishlistImagePreview").src = previewUrl;

            $("wishlistImagePreview").hidden = false;

            showMessage("wishlistMessage", "");

        }
    );

    /* =================================================
       SUBMIT PRIVATE WISHLIST REQUEST
    ================================================= */

    $("wishlistForm").addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            if (wishlistBusy) return;

            const category =
                $("wishlistCategory").value;

            const title =
                $("wishlistTitle").value.trim();

            const description =
                $("wishlistDescription").value.trim();

            const file =
                $("wishlistImage").files[0];

            const allowedCategories = [
                ...Object.keys(categoryConfig),
                "other"
            ];

            if (
                !allowedCategories.includes(category) ||
                !title ||
                !description
            ) {

                showMessage(
                    "wishlistMessage",
                    "Please complete all required fields.",
                    "error"
                );

                return;

            }

            const imageError = validateImage(file);

            if (imageError) {

                showMessage(
                    "wishlistMessage",
                    imageError,
                    "error"
                );

                return;

            }

            wishlistBusy = true;

            const submitButton =
                $("wishlistSubmitButton");

            submitButton.disabled = true;

            submitButton.textContent =
                "SENDING PRIVATE REQUEST...";

            let uploadedPath = null;
            let requestSaved = false;

            try {

                if (file) {

                    const extension =
                        allowedImageTypes[file.type];

                    const path =

                        user.id + "/" +
                        crypto.randomUUID() +
                        "." + extension;

                    const { error: uploadError } =
                        await supabase.storage
                            .from(WISHLIST_BUCKET)
                            .upload(path, file, {

                                contentType: file.type,
                                upsert: false

                            });

                    if (uploadError) {
                        throw uploadError;
                    }

                    uploadedPath = path;

                }

                const { error } = await supabase
                    .from("doll_wishlist")
                    .insert({

                        doll_id: doll?.id || null,
                        user_id: user.id,
                        category: category,
                        title: title,
                        description: description,
                        image_path: uploadedPath,
                        status: "pending",
                        admin_response: ""

                    });

                if (error) throw error;

                requestSaved = true;

                $("wishlistForm").reset();

                clearImagePreview();

                showMessage(
                    "wishlistMessage",
                    "Your private request has been submitted successfully.",
                    "success"
                );

                await loadWishlist();

            } catch (error) {

                if (uploadedPath && !requestSaved) {

                    const { error: cleanupError } =
                        await supabase.storage
                            .from(WISHLIST_BUCKET)
                            .remove([uploadedPath]);

                    if (cleanupError) {
                        console.error(cleanupError);
                    }

                }

                console.error(error);

                showMessage(
                    "wishlistMessage",
                    error.message ||
                    "Unable to submit wishlist request.",
                    "error"
                );

            } finally {

                wishlistBusy = false;

                submitButton.disabled = false;

                submitButton.textContent =
                    "SEND PRIVATE REQUEST";

            }

        }
    );

    /* =================================================
       LOAD PRIVATE REQUEST HISTORY
    ================================================= */

    async function loadWishlist() {

        const version = ++wishlistLoadVersion;

        const memberContainer = $("wishlistRequests");

        const adminContainer =
            $("wishlistAdminRequests");

        memberContainer.replaceChildren(
            element("p", "", "Loading requests...")
        );

        try {

            let query = supabase
                .from("doll_wishlist")
                .select("*")
                .order("created_at", {
                    ascending: false
                });

            if (!isAdmin) {

                query = query.eq(
                    "user_id",
                    user.id
                );

            }

            const { data, error } = await query;

            if (error) throw error;

            if (version !== wishlistLoadVersion) {
                return;
            }

            const records = data || [];

            const memberFragment =
                document.createDocumentFragment();

            const adminFragment =
                document.createDocumentFragment();

            const ownRequests = records.filter(
                record => record.user_id === user.id
            );

            if (!ownRequests.length) {

                memberFragment.appendChild(
                    element(
                        "p",
                        "reservation-empty",
                        "No private requests submitted yet."
                    )
                );

            }

            for (const record of ownRequests) {

                memberFragment.appendChild(
                    await createWishlistCard(
                        record,
                        false
                    )
                );

            }

            if (isAdmin) {

                if (!records.length) {

                    adminFragment.appendChild(
                        element(
                            "p",
                            "reservation-empty",
                            "No member requests available."
                        )
                    );

                }

                for (const record of records) {

                    adminFragment.appendChild(
                        await createWishlistCard(
                            record,
                            true
                        )
                    );

                }

            }

            if (version !== wishlistLoadVersion) {
                return;
            }

            memberContainer.replaceChildren(
                memberFragment
            );

            if (isAdmin) {

                adminContainer.replaceChildren(
                    adminFragment
                );

            }

        } catch (error) {

            if (version !== wishlistLoadVersion) {
                return;
            }

            console.error(error);

            memberContainer.replaceChildren(
                element(
                    "p",
                    "reservation-empty",
                    "Unable to load wishlist requests."
                )
            );

            if (isAdmin) {

                showMessage(
                    "wishlistAdminMessage",
                    error.message ||
                    "Unable to load member requests.",
                    "error"
                );

            }

        }

    }

    /* =================================================
       WISHLIST REQUEST CARDS
    ================================================= */

    async function createWishlistCard(
        record,
        adminMode
    ) {

        const card = element(
            "article",
            "wishlist-card"
        );

        const header = element(
            "div",
            "wishlist-card-header"
        );

        const reference =

            "WL-" +
            String(record.id)
                .slice(0, 8)
                .toUpperCase();

        const status = element(
            "span",
            "wishlist-status " + record.status,
            statusLabel(record.status)
        );

        header.append(
            element(
                "span",
                "wishlist-meta",
                reference
            ),
            status
        );

        card.appendChild(header);

        card.appendChild(
            element(
                "p",
                "wishlist-meta",
                categoryLabel(record.category)
            )
        );

        card.appendChild(
            element(
                "h3",
                "",
                record.title
            )
        );

        card.appendChild(
            element(
                "p",
                "",
                record.description
            )
        );

        if (record.image_path) {

            const url = await getSignedImage(
                WISHLIST_BUCKET,
                record.image_path,
                300
            );

            if (url) {

                const image =
                    document.createElement("img");

                image.src = url;
                image.alt = "Private reference image";
                image.loading = "lazy";

                card.appendChild(image);

            } else {

                card.appendChild(
                    element(
                        "p",
                        "wishlist-meta",
                        "REFERENCE IMAGE UNAVAILABLE"
                    )
                );

            }

        }

        card.appendChild(
            element(
                "p",
                "wishlist-meta",
                "SUBMITTED: " +
                formatTimestamp(record.created_at)
            )
        );

        if (record.doll_id) {

            card.appendChild(
                element(
                    "p",
                    "wishlist-meta",
                    "PROFILE: " +
                    (
                        doll?.id === record.doll_id
                            ? doll.name
                            : String(record.doll_id)
                                .slice(0, 8)
                                .toUpperCase()
                    )
                )
            );

        }

        const response = element(
            "div",
            "wishlist-response"
        );

        response.append(

            element(
                "strong",
                "",
                "ADMINISTRATOR RESPONSE"
            ),

            element(
                "p",
                "",
                record.admin_response ||
                "Awaiting administrator response."
            )

        );

        card.appendChild(response);

        if (adminMode && isAdmin) {

            card.appendChild(
                element(
                    "p",
                    "wishlist-meta",
                    "MEMBER ID: " +
                    String(record.user_id)
                        .slice(0, 8)
                        .toUpperCase()
                )
            );

            card.appendChild(
                createAdminWishlistForm(record)
            );

        }

        return card;

    }

    /* =================================================
       ADMINISTRATOR WISHLIST MANAGEMENT
    ================================================= */

    function createAdminWishlistForm(record) {

        const form = element(
            "form",
            "wishlist-admin-form"
        );

        const statusId =
            "wishlist-status-" + record.id;

        const responseId =
            "wishlist-response-" + record.id;

        const statusLabelElement = element(
            "label",
            "",
            "REQUEST STATUS"
        );

        statusLabelElement.htmlFor = statusId;

        const statusSelect =
            document.createElement("select");

        statusSelect.id = statusId;

        for (const value of wishlistStatuses) {

            const option =
                document.createElement("option");

            option.value = value;

            option.textContent =
                statusLabel(value);

            option.selected =
                value === record.status;

            statusSelect.appendChild(option);

        }

        const responseLabel = element(
            "label",
            "",
            "PRIVATE RESPONSE TO MEMBER"
        );

        responseLabel.htmlFor = responseId;

        const responseInput =
            document.createElement("textarea");

        responseInput.id = responseId;
        responseInput.rows = 5;
        responseInput.maxLength = 3000;

        responseInput.value =
            record.admin_response || "";

        responseInput.placeholder =
            "Write your private response here...";

        const saveButton = element(
            "button",
            "reservation-button reservation-primary",
            "SAVE STATUS & RESPONSE"
        );

        saveButton.type = "submit";

        form.append(
            statusLabelElement,
            statusSelect,
            responseLabel,
            responseInput,
            saveButton
        );

        form.addEventListener(
            "submit",
            async event => {

                event.preventDefault();

                if (!isAdmin || saveButton.disabled) {
                    return;
                }

                if (
                    !wishlistStatuses.includes(
                        statusSelect.value
                    )
                ) return;

                saveButton.disabled = true;
                statusSelect.disabled = true;
                responseInput.disabled = true;

                saveButton.textContent = "SAVING...";

                try {

                    const { error } = await supabase
                        .from("doll_wishlist")
                        .update({

                            status: statusSelect.value,

                            admin_response:
                                responseInput.value.trim(),

                            updated_at:
                                new Date().toISOString()

                        })
                        .eq("id", record.id)
                        .select("id")
                        .single();

                    if (error) throw error;

                    showMessage(
                        "wishlistAdminMessage",
                        "Request updated successfully.",
                        "success"
                    );

                    await loadWishlist();

                } catch (error) {

                    console.error(error);

                    showMessage(
                        "wishlistAdminMessage",
                        error.message ||
                        "Unable to update request.",
                        "error"
                    );

                } finally {

                    saveButton.disabled = false;
                    statusSelect.disabled = false;
                    responseInput.disabled = false;

                    saveButton.textContent =
                        "SAVE STATUS & RESPONSE";

                }

            }
        );

        return form;

    }

    /* =================================================
       INITIALIZATION
    ================================================= */

    async function initialize() {

        $("reservationFields").disabled = true;

        $("reservationQuickReview").disabled = true;

        $("reservationConfirmButton").disabled = true;

        $("wishlistSubmitButton").disabled = false;

        $("wishlistAdminPanel").hidden = !isAdmin;

        updateDates();

        showMessage(
            "reservationConnection",
            "Loading reservation service...",
            "info"
        );

        try {

            const available = await loadDoll();

            if (available) {

                await loadGalleryOptions();

                $("reservationFields").disabled = false;

                $("reservationQuickReview").disabled = false;

                showMessage(
                    "reservationConnection",
                    "Reservation service connected.",
                    "success"
                );

            } else if (!dollId) {

                showMessage(
                    "reservationConnection",
                    "Select a profile from the collection to make a reservation. Private wishlist requests are available.",
                    "info"
                );

            }

        } catch (error) {

            console.error(error);

            showMessage(
                "reservationConnection",
                error.message ||
                "Unable to load reservation service.",
                "error"
            );

        }

        if (isAdmin) {

            await loadWishlist();

        }

    }

    window.addEventListener(
        "beforeunload",
        () => {

            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }

        }
    );

    await initialize();

})();
