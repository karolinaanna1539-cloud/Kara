
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


    /* =================================================
       CONNECTED INVENTORY ACCESSORIES
       TOYS & TOOLS INTEGRATION
    ================================================= */

    let inventoryItems = [];

    const inventorySelected = new Set();

    let inventoryAvailability = new Map();

    let inventoryVersion = 0;

    let inventoryReady = false;

    let inventoryDateKey = "";


    function inventoryDates() {

        return [
            $("reservationStart").value,
            $("reservationEnd").value
        ];

    }


    /* =================================================
       RENDER INVENTORY ACCESSORIES
    ================================================= */

    function renderInventory() {

        const container =
            $("reservationInventoryOptions");

        const search =
            $("reservationInventorySearch")
                .value.trim().toLowerCase();

        const category =
            $("reservationInventoryCategory").value;

        container.replaceChildren();

        $("reservationInventoryCount").textContent =
            inventorySelected.size + " SELECTED";

        const items = inventoryItems.filter(item =>

            (!category || item.category === category)

            &&

            [
                item.name,
                item.category,
                item.description
            ]
                .join(" ")
                .toLowerCase()
                .includes(search)

        );

        if (!items.length) {

            container.append(

                element(
                    "p",
                    "reservation-empty",
                    "No matching accessories."
                )

            );

        }

        for (const item of items) {

            const available =

                inventoryReady

                &&

                inventoryAvailability.get(item.id) === true;

            const card = element(
                "label",
                "reservation-option"
            );

            const input =
                document.createElement("input");

            input.type = "checkbox";

            input.checked =
                inventorySelected.has(item.id);

            input.disabled = !available;

            card.classList.toggle(
                "selected",
                input.checked
            );

            card.append(input);

            if (item.url) {

                const img =
                    document.createElement("img");

                img.src = item.url;
                img.alt = item.name;
                img.loading = "lazy";

                card.append(img);

            }

            const info = element(
                "div",
                "reservation-option-info"
            );

            info.append(

                element(
                    "strong",
                    "",
                    item.name
                ),

                element(
                    "p",
                    "",
                    item.category || ""
                ),

                element(
                    "p",
                    "",
                    item.description || ""
                ),

                element(
                    "p",
                    "",
                    inventoryReady
                        ? (
                            available
                                ? "AVAILABLE"
                                : "UNAVAILABLE"
                        )
                        : "SELECT DATES / CHECKING"
                )

            );

            card.append(info);

            input.addEventListener("change", () => {

                if (input.checked && available) {

                    inventorySelected.add(item.id);

                } else {

                    inventorySelected.delete(item.id);

                }

                card.classList.toggle(
                    "selected",
                    input.checked
                );

                $("reservationInventoryCount").textContent =
                    inventorySelected.size + " SELECTED";

                invalidateReview();

            });

            container.append(card);

        }

    }


    /* =================================================
       CHECK ACCESSORY AVAILABILITY
    ================================================= */

    async function refreshInventoryAvailability() {

        const version = ++inventoryVersion;

        const [start, end] = inventoryDates();

        inventoryReady = false;

        inventoryDateKey = "";

        inventoryAvailability = new Map();

        invalidateReview();

        renderInventory();

        if (
            !start ||
            !end ||
            end < start ||
            start < stockholmToday()
        ) {

            showMessage(
                "reservationInventoryMessage",
                "Select valid pickup and return dates first."
            );

            return;

        }

        showMessage(
            "reservationInventoryMessage",
            "Checking availability..."
        );

        try {

            const { data, error } =
                await supabase.rpc(

                    "get_inventory_availability",

                    {

                        p_doll_id: doll.id,

                        p_start_date: start,

                        p_end_date: end

                    }

                );

            if (version !== inventoryVersion) {
                return;
            }

            if (error) throw error;

            inventoryAvailability = new Map(

                (data || []).map(row => [

                    row.inventory_item_id,

                    row.available

                ])

            );

            let removed = false;

            for (const id of inventorySelected) {

                if (
                    inventoryAvailability.get(id) !== true
                ) {

                    inventorySelected.delete(id);

                    removed = true;

                }

            }

            inventoryReady = true;

            inventoryDateKey =
                start + "/" + end;

            showMessage(

                "reservationInventoryMessage",

                removed

                    ? "Unavailable selections were removed. Please review your choices."

                    : "Availability checked. Final availability is verified when submitting."

            );

        } catch (error) {

            if (version !== inventoryVersion) {
                return;
            }

            showMessage(

                "reservationInventoryMessage",

                "Unable to check availability: "
                    + error.message,

                "error"

            );

        }

        renderInventory();

    }


    /* =================================================
       LOAD ASSIGNED INVENTORY ACCESSORIES
    ================================================= */

    async function loadInventoryAccessories() {

        const {

            data: links,

            error: linkError

        } = await supabase

            .from("doll_inventory_accessories")

            .select("inventory_item_id")

            .eq("doll_id", doll.id);

        if (linkError) throw linkError;

        const ids = (links || []).map(

            row => row.inventory_item_id

        );

        if (ids.length) {

            const { data, error } = await supabase

                .from("inventory_items")

                .select(
                    "id,name,category,description,status,image_path"
                )

                .in("id", ids)

                .order("name");

            if (error) throw error;

            inventoryItems = await Promise.all(

                (data || []).map(async item => ({

                    ...item,

                    url: await getSignedImage(

                        "karolina-images",

                        item.image_path

                    )

                }))

            );

        }

        const select =
            $("reservationInventoryCategory");

        const categories = [

            ...new Set(

                inventoryItems

                    .map(item => item.category)

                    .filter(Boolean)

            )

        ].sort();

        for (const category of categories) {

            const option = element(

                "option",

                "",

                category

            );

            option.value = category;

            select.append(option);

        }

        $("reservationInventorySearch")
            .addEventListener(
                "input",
                renderInventory
            );

        select.addEventListener(

            "change",

            renderInventory

        );

        for (const id of [

            "reservationStart",

            "reservationEnd"

        ]) {

            $(id).addEventListener(

                "change",

                refreshInventoryAvailability

            );

        }

        await refreshInventoryAvailability();

    }


    /* =================================================
       GET SELECTED CUSTOMIZATION OPTIONS
    ================================================= */

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

                    caption:
                        item.caption || "Unnamed option",

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

        const same =
            $("reservationSameLocation").checked;

        const pickup =
            $("reservationPickupLocation");

        const returnLocation =
            $("reservationReturnLocation");

        returnLocation.readOnly = same;

        if (same) {

            returnLocation.value = pickup.value;

        }

    }


    /* =================================================
       PREPARE RESERVATION DATA
    ================================================= */

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

                inventory_accessories: [

                    ...inventorySelected

                ].sort(),

                notes:
                    $("reservationNotes").value.trim()

            }

        };

    }


    /* =================================================
       VALIDATE RESERVATION
    ================================================= */

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

        if (

            inventorySelected.size

            &&

            (

                !inventoryReady

                ||

                inventoryDateKey !==
                    data.start_date + "/" + data.end_date

                ||

                [...inventorySelected].some(

                    id =>
                        inventoryAvailability.get(id) !== true

                )

            )

        ) {

            return "Please check inventory accessory availability before submitting.";

        }

        return null;

    }

    /* =================================================
       RESERVATION REVIEW
    ================================================= */

    function invalidateReview() {

        reviewedSignature = null;

        $("reservationAgreement").checked = false;

        updateConfirmButton();

    }


    function updateConfirmButton() {

        const data = getReservationData();

        const signature = JSON.stringify(data);

        const valid =

            reviewedSignature !== null

            && reviewedSignature === signature

            && $("reservationAgreement").checked

            && !reservationBusy

            && !reservationSubmitted;

        $("reservationConfirmButton").disabled = !valid;

    }


    function addSummaryRow(container, label, value) {

        const row = element(
            "div",
            "reservation-summary-row"
        );

        const labelNode = element(
            "span",
            "reservation-summary-label",
            label
        );

        const valueNode = element(
            "strong",
            "reservation-summary-value",
            value || "NOT SPECIFIED"
        );

        row.append(
            labelNode,
            valueNode
        );

        container.append(row);

        return row;

    }


    function createSummarySection(title) {

        const section = element(
            "section",
            "reservation-summary-section"
        );

        section.append(

            element(
                "h3",
                "reservation-summary-heading",
                title
            )

        );

        return section;

    }


    /* =================================================
       REVIEW SELECTED INVENTORY ACCESSORIES
    ================================================= */

    function renderInventorySummary(container) {

        const section = createSummarySection(
            "INVENTORY ACCESSORIES"
        );

        const selectedItems = inventoryItems.filter(

            item => inventorySelected.has(item.id)

        );

        if (!selectedItems.length) {

            section.append(

                element(
                    "p",
                    "reservation-hint",
                    "No additional inventory accessories selected."
                )

            );

            container.append(section);

            return;

        }

        const grid = element(
            "div",
            "reservation-inventory-summary-grid"
        );

        for (const item of selectedItems) {

            const card = element(
                "div",
                "reservation-inventory-summary-card"
            );

            if (item.url) {

                const image =
                    document.createElement("img");

                image.src = item.url;

                image.alt = item.name;

                image.loading = "lazy";

                card.append(image);

            }

            const info = element(
                "div",
                "reservation-inventory-summary-info"
            );

            info.append(

                element(
                    "strong",
                    "",
                    item.name
                ),

                element(
                    "p",
                    "",
                    item.category || "ACCESSORY"
                ),

                element(
                    "span",
                    "reservation-inventory-summary-status",
                    "SELECTED"
                )

            );

            card.append(info);

            grid.append(card);

        }

        section.append(

            element(
                "p",
                "reservation-hint",
                selectedItems.length
                    + " inventory accessories selected."
            ),

            grid

        );

        container.append(section);

    }


    /* =================================================
       GENERATE COMPLETE RESERVATION SUMMARY
    ================================================= */

    function reviewReservation() {

        if (reservationBusy || reservationSubmitted) {

            return false;

        }

        const data = getReservationData();

        const validationError =
            validateReservation(data);

        if (validationError) {

            invalidateReview();

            $("reservationReviewSection").open = true;

            showMessage(

                "reservationMessage",

                validationError,

                "error"

            );

            scrollToElement(
                $("reservationReviewSection")
            );

            return false;

        }

        const summary = $("reservationSummary");

        summary.replaceChildren();


        /* SELECTED PROFILE */

        const profileSection = createSummarySection(
            "01 // SELECTED PROFILE"
        );

        addSummaryRow(

            profileSection,

            "PROFILE",

            doll.name

        );

        summary.append(profileSection);


        /* RESERVATION PERIOD */

        const periodSection = createSummarySection(
            "02 // RESERVATION PERIOD"
        );

        addSummaryRow(

            periodSection,

            "PICKUP DATE",

            formatDate(data.start_date)

        );

        addSummaryRow(

            periodSection,

            "PICKUP TIME",

            data.pickup_time

        );

        addSummaryRow(

            periodSection,

            "RETURN DATE",

            formatDate(data.end_date)

        );

        addSummaryRow(

            periodSection,

            "RETURN TIME",

            data.return_time

        );

        const duration = getCalendarDays(

            data.start_date,

            data.end_date

        );

        addSummaryRow(

            periodSection,

            "DURATION",

            duration + (

                duration === 1

                    ? " CALENDAR DAY"

                    : " CALENDAR DAYS"

            )

        );

        summary.append(periodSection);


        /* PICKUP AND RETURN */

        const logisticsSection = createSummarySection(
            "03 // PICKUP & RETURN"
        );

        addSummaryRow(

            logisticsSection,

            "PICKUP LOCATION",

            data.pickup_location
                || "TO BE AGREED PRIVATELY"

        );

        addSummaryRow(

            logisticsSection,

            "RETURN LOCATION",

            data.return_location
                || "TO BE AGREED PRIVATELY"

        );

        logisticsSection.append(

            element(

                "p",

                "reservation-hint",

                "Final arrangements will be confirmed by the administrator."

            )

        );

        summary.append(logisticsSection);


        /* PERSONAL CONFIGURATION */

        const configurationSection =
            createSummarySection(
                "04 // PERSONAL CONFIGURATION"
            );

        const selections =
            data.reservation_options.selections;

        for (

            const [category, config]

            of Object.entries(categoryConfig)

        ) {

            const selected = selections.filter(

                item => item.category === category

            );

            const value = selected.length

                ? selected.map(

                    item => item.caption

                ).join(", ")

                : "NO SPECIFIC PREFERENCE";

            addSummaryRow(

                configurationSection,

                config.label,

                value

            );

        }

        summary.append(configurationSection);


        /* CONNECTED INVENTORY */

        renderInventorySummary(summary);


        /* ADDITIONAL INFORMATION */

        const notesSection = createSummarySection(
            "05 // ADDITIONAL INFORMATION"
        );

        const notes =
            data.reservation_options.notes;

        notesSection.append(

            element(

                "p",

                "reservation-summary-notes",

                notes || "No additional information."

            )

        );

        summary.append(notesSection);


        /* RESERVATION STATUS */

        const statusSection = createSummarySection(
            "06 // REQUEST STATUS"
        );

        addSummaryRow(

            statusSection,

            "INITIAL STATUS",

            "PENDING"

        );

        statusSection.append(

            element(

                "p",

                "reservation-hint",

                "Your reservation will be submitted for administrator approval."

            )

        );

        summary.append(statusSection);


        /* CONFIRM REVIEW */

        reviewedSignature = JSON.stringify(data);

        $("reservationAgreement").checked = false;

        $("reservationReviewSection").open = true;

        showMessage(

            "reservationMessage",

            "Review your configuration and confirm the agreement before submitting.",

            "success"

        );

        updateConfirmButton();

        scrollToElement(
            $("reservationReviewSection")
        );

        return true;

    }


    /* =================================================
       RESERVATION BUSY STATE
    ================================================= */

    function setReservationBusy(busy) {

        reservationBusy = busy;

        $("reservationFields").disabled =

            busy || reservationSubmitted;

        $("reservationQuickReview").disabled =

            busy || reservationSubmitted;

        $("reservationReviewButton").disabled =

            busy || reservationSubmitted;

        $("reservationConfirmButton").textContent =

            busy

                ? "SUBMITTING REQUEST..."

                : reservationSubmitted

                    ? "RESERVATION SUBMITTED"

                    : "SUBMIT RESERVATION REQUEST";

        updateConfirmButton();

    }


    /* =================================================
       RESERVATION ERROR HANDLING
    ================================================= */

    function reservationErrorMessage(error) {

        const message = String(

            error?.message || ""

        );

        if (

            error?.code === "23P01"

            ||

            message.includes(
                "accessory_booking_no_overlap"
            )

        ) {

            return (

                "One or more selected accessories have " +

                "already been reserved for these dates. " +

                "Please review the available accessories."

            );

        }

        if (

            message.includes(
                "This date range is already reserved"
            )

        ) {

            return (

                "This profile is already reserved " +

                "for the selected dates."

            );

        }

        if (

            message.includes(
                "Accessory is unavailable"
            )

            ||

            message.includes(
                "Accessory is not assigned"
            )

        ) {

            return (

                "An accessory is no longer available. " +

                "Please review your configuration."

            );

        }

        return message ||

            "Unable to submit the reservation. Please try again.";

    }


    /* =================================================
       SUBMIT RESERVATION
    ================================================= */

    async function submitReservation(event) {

        event.preventDefault();

        if (

            reservationBusy

            ||

            reservationSubmitted

        ) {

            return;

        }

        const data = getReservationData();

        const validationError =
            validateReservation(data);

        if (validationError) {

            invalidateReview();

            showMessage(

                "reservationMessage",

                validationError,

                "error"

            );

            return;

        }

        if (

            reviewedSignature !== JSON.stringify(data)

        ) {

            invalidateReview();

            showMessage(

                "reservationMessage",

                "Your reservation details have changed. Please review them again.",

                "error"

            );

            return;

        }

        if (!$("reservationAgreement").checked) {

            showMessage(

                "reservationMessage",

                "Please confirm the reservation agreement.",

                "error"

            );

            return;

        }

        setReservationBusy(true);

        showMessage(

            "reservationMessage",

            "Submitting your reservation request..."

        );

        try {

            const payload = {

                doll_id: doll.id,

                user_id: user.id,

                start_date: data.start_date,

                end_date: data.end_date,

                pickup_time: data.pickup_time,

                return_time: data.return_time,

                pickup_location:

                    data.pickup_location

                    || "To be agreed privately",

                return_location:

                    data.return_location

                    || "To be agreed privately",

                status: "pending",

                reservation_options: {

                    selections:

                        data.reservation_options.selections,

                    inventory_accessories:

                        data.reservation_options
                            .inventory_accessories,

                    notes:

                        data.reservation_options.notes

                }

            };

            const {

                data: reservation,

                error

            } = await supabase

                .from("doll_reservations")

                .insert(payload)

                .select("id,status")

                .single();

            if (error) throw error;


            /* RESERVATION CREATED */

            reservationSubmitted = true;

            reviewedSignature = null;

            const reference =

                "RES-" +

                String(reservation.id)

                    .slice(0, 8)

                    .toUpperCase();

            const summary = $("reservationSummary");

            summary.replaceChildren();

            const confirmation = element(

                "section",

                "reservation-success-panel"

            );

            confirmation.append(

                element(

                    "p",

                    "system-label",

                    "THE DEN // REQUEST RECEIVED"

                ),

                element(

                    "h2",

                    "",

                    "RESERVATION SUBMITTED"

                ),

                element(

                    "p",

                    "",

                    "Your reservation request has been successfully registered."

                )

            );

            addSummaryRow(

                confirmation,

                "REFERENCE",

                reference

            );

            addSummaryRow(

                confirmation,

                "PROFILE",

                doll.name

            );

            addSummaryRow(

                confirmation,

                "STATUS",

                "PENDING ADMINISTRATOR APPROVAL"

            );

            addSummaryRow(

                confirmation,

                "INVENTORY ACCESSORIES",

                String(

                    data.reservation_options
                        .inventory_accessories.length

                )

            );

            confirmation.append(

                element(

                    "p",

                    "reservation-hint",

                    "Your selected inventory accessories are reserved for the requested dates while the reservation is pending."

                )

            );

            const returnLink = element(

                "a",

                "reservation-button reservation-primary",

                "VIEW MY RESERVATIONS →"

            );

            returnLink.href =

                "dolls-for-rent.html#memberReservationSection";

            confirmation.append(returnLink);

            summary.append(confirmation);

            showMessage(

                "reservationMessage",

                "Reservation submitted successfully. Reference: "
                    + reference,

                "success"

            );

            scrollToElement(

                $("reservationReviewSection")

            );

        } catch (error) {

            console.error(

                "Reservation submission failed:",

                error

            );

            invalidateReview();

            if (inventoryItems.length) {

                await refreshInventoryAvailability();

            }

            showMessage(

                "reservationMessage",

                reservationErrorMessage(error),

                "error"

            );

        } finally {

            setReservationBusy(false);

        }

    }

    /* =================================================
       PRIVATE WISHLIST
    ================================================= */

    function openWishlist() {

        $("privateWishlist").hidden = false;

        scrollToElement(
            $("privateWishlist")
        );

    }


    function closeWishlist() {

        $("privateWishlist").hidden = true;

    }


    /* =================================================
       REFERENCE IMAGE PREVIEW
    ================================================= */

    function clearWishlistPreview() {

        if (previewUrl) {

            URL.revokeObjectURL(previewUrl);

            previewUrl = null;

        }

        const preview = $("wishlistImagePreview");

        preview.hidden = true;

        preview.removeAttribute("src");

    }


    function validateWishlistImage(file) {

        if (!file) return null;

        if (!allowedImageTypes[file.type]) {

            return "Only JPG, PNG and WEBP images are supported.";

        }

        if (file.size > 10 * 1024 * 1024) {

            return "Maximum image size is 10 MB.";

        }

        return null;

    }


    function previewWishlistImage() {

        clearWishlistPreview();

        const file =
            $("wishlistImage").files[0];

        if (!file) return;

        const error =
            validateWishlistImage(file);

        if (error) {

            $("wishlistImage").value = "";

            showMessage(

                "wishlistMessage",

                error,

                "error"

            );

            return;

        }

        previewUrl =
            URL.createObjectURL(file);

        const preview =
            $("wishlistImagePreview");

        preview.src = previewUrl;

        preview.hidden = false;

        showMessage(
            "wishlistMessage",
            ""
        );

    }


    /* =================================================
       UPLOAD PRIVATE REFERENCE IMAGE
    ================================================= */

    async function uploadWishlistImage(file) {

        if (!file) return null;

        const validationError =
            validateWishlistImage(file);

        if (validationError) {

            throw new Error(validationError);

        }

        const extension =
            allowedImageTypes[file.type];

        const path =

            user.id +

            "/" +

            crypto.randomUUID() +

            "." +

            extension;

        const { error } = await supabase

            .storage

            .from(WISHLIST_BUCKET)

            .upload(path, file, {

                contentType: file.type,

                upsert: false

            });

        if (error) throw error;

        return path;

    }


    /* =================================================
       WISHLIST BUSY STATE
    ================================================= */

    function setWishlistBusy(busy) {

        wishlistBusy = busy;

        $("wishlistSubmitButton").disabled = busy;

        $("wishlistSubmitButton").textContent =

            busy

                ? "SENDING REQUEST..."

                : "SEND PRIVATE REQUEST";

        for (const id of [

            "wishlistCategory",

            "wishlistTitle",

            "wishlistDescription",

            "wishlistImage"

        ]) {

            $(id).disabled = busy;

        }

    }


    /* =================================================
       SUBMIT PRIVATE WISHLIST REQUEST
    ================================================= */

    async function submitWishlist(event) {

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

            "clothing",

            "makeup",

            "hairstyle",

            "nails",

            "accessories",

            "other"

        ];

        if (

            !allowedCategories.includes(category)

            ||

            !title

            ||

            !description

        ) {

            showMessage(

                "wishlistMessage",

                "Please complete all required fields.",

                "error"

            );

            return;

        }

        const imageError =
            validateWishlistImage(file);

        if (imageError) {

            showMessage(

                "wishlistMessage",

                imageError,

                "error"

            );

            return;

        }

        setWishlistBusy(true);

        let uploadedPath = null;

        let committed = false;

        showMessage(

            "wishlistMessage",

            "Sending your private request..."

        );

        try {

            if (file) {

                uploadedPath =
                    await uploadWishlistImage(file);

            }

            const payload = {

                doll_id: doll?.id || null,

                user_id: user.id,

                category: category,

                title: title,

                description: description,

                image_path: uploadedPath,

                status: "pending",

                admin_response: ""

            };

            const {

                data,

                error

            } = await supabase

                .from("doll_wishlist")

                .insert(payload)

                .select("id")

                .single();

            if (error) throw error;

            committed = true;

            const reference =

                "WL-" +

                String(data.id)

                    .slice(0, 8)

                    .toUpperCase();

            $("wishlistForm").reset();

            clearWishlistPreview();

            showMessage(

                "wishlistMessage",

                "Private request submitted successfully. Reference: "
                    + reference,

                "success"

            );

            await loadWishlistRequests();

        } catch (error) {

            console.error(

                "Wishlist submission failed:",

                error

            );

            if (uploadedPath && !committed) {

                const { error: cleanupError } =
                    await supabase

                        .storage

                        .from(WISHLIST_BUCKET)

                        .remove([uploadedPath]);

                if (cleanupError) {

                    console.error(cleanupError);

                }

            }

            showMessage(

                "wishlistMessage",

                committed

                    ? "Request saved, but the request list could not be refreshed."

                    : error.message
                        || "Unable to submit your request.",

                committed ? "info" : "error"

            );

        } finally {

            setWishlistBusy(false);

        }

    }


    /* =================================================
       WISHLIST STATUS
    ================================================= */

    function createWishlistStatus(status) {

        const badge = element(

            "span",

            "wishlist-status",

            statusLabel(status)

        );

        badge.dataset.status = status;

        return badge;

    }


    /* =================================================
       PRIVATE REQUEST CARD
    ================================================= */

    async function createWishlistCard(
        request,
        adminMode = false
    ) {

        const card = element(

            "article",

            "wishlist-request-card"

        );

        const reference =

            "WL-" +

            String(request.id)

                .slice(0, 8)

                .toUpperCase();

        const header = element(

            "div",

            "wishlist-request-header"

        );

        const identity = element(

            "div",

            "wishlist-request-identity"

        );

        identity.append(

            element(

                "p",

                "system-label",

                reference

            ),

            element(

                "h3",

                "",

                request.title

            )

        );

        header.append(

            identity,

            createWishlistStatus(request.status)

        );

        card.append(header);


        /* REQUEST INFORMATION */

        const information = element(

            "div",

            "wishlist-request-information"

        );

        addSummaryRow(

            information,

            "CATEGORY",

            categoryLabel(request.category)

        );

        addSummaryRow(

            information,

            "CREATED",

            formatTimestamp(request.created_at)

        );

        if (request.doll_id) {

            addSummaryRow(

                information,

                "PROFILE",

                request.dolls?.name
                    || "LINKED PROFILE"

            );

        } else {

            addSummaryRow(

                information,

                "PROFILE",

                "INDEPENDENT REQUEST"

            );

        }

        if (adminMode) {

            addSummaryRow(

                information,

                "MEMBER",

                request.user_id === ADMIN_ID

                    ? "ADMINISTRATOR"

                    : request.user_id ===
                        "167a9314-92b5-42a1-8bad-d6e4a7d78198"

                        ? "JOHNNIE DILLINGER"

                        : request.user_id

            );

        }

        card.append(information);


        /* REQUEST DESCRIPTION */

        const description = element(

            "div",

            "wishlist-request-description"

        );

        description.append(

            element(

                "p",

                "system-label",

                "REQUEST DESCRIPTION"

            ),

            element(

                "p",

                "",

                request.description

            )

        );

        card.append(description);


        /* REFERENCE IMAGE */

        if (request.image_path) {

            const url = await getSignedImage(

                WISHLIST_BUCKET,

                request.image_path,

                300

            );

            if (url) {

                const imageSection = element(

                    "div",

                    "wishlist-reference-image"

                );

                imageSection.append(

                    element(

                        "p",

                        "system-label",

                        "REFERENCE IMAGE"

                    )

                );

                const image =
                    document.createElement("img");

                image.src = url;

                image.alt = "Private reference image";

                image.loading = "lazy";

                image.style.cursor = "zoom-in";

                image.addEventListener(

                    "click",

                    () => openWishlistImage(url)

                );

                imageSection.append(image);

                card.append(imageSection);

            }

        }


        /* ADMINISTRATOR RESPONSE */

        const response = element(

            "div",

            "wishlist-admin-response"

        );

        response.append(

            element(

                "p",

                "system-label",

                "ADMINISTRATOR RESPONSE"

            ),

            element(

                "p",

                "",

                request.admin_response

                    || "Awaiting administrator review."

            )

        );

        card.append(response);


        /* ADMIN MANAGEMENT */

        if (adminMode && isAdmin) {

            card.append(

                createWishlistAdminForm(request)

            );

        }

        return card;

    }


    /* =================================================
       PRIVATE IMAGE LIGHTBOX
    ================================================= */

    function openWishlistImage(url) {

        const dialog =
            document.createElement("dialog");

        dialog.className =
            "wishlist-image-dialog";

        dialog.style.maxWidth = "90vw";

        dialog.style.maxHeight = "90vh";

        dialog.style.background = "#07110b";

        dialog.style.border = "1px solid #294332";

        dialog.style.padding = "15px";

        const close = element(

            "button",

            "reservation-button",

            "CLOSE ×"

        );

        close.type = "button";

        close.addEventListener(

            "click",

            () => dialog.close()

        );

        const image =
            document.createElement("img");

        image.src = url;

        image.alt = "Private reference image";

        image.style.display = "block";

        image.style.maxWidth = "80vw";

        image.style.maxHeight = "75vh";

        image.style.objectFit = "contain";

        image.style.marginTop = "12px";

        dialog.append(

            close,

            image

        );

        dialog.addEventListener(

            "close",

            () => dialog.remove(),

            { once: true }

        );

        document.body.append(dialog);

        dialog.showModal();

    }


    /* =================================================
       ADMIN WISHLIST MANAGEMENT FORM
    ================================================= */

    function createWishlistAdminForm(request) {

        const form = element(

            "form",

            "wishlist-admin-form"

        );

        form.append(

            element(

                "p",

                "system-label",

                "ADMINISTRATOR MANAGEMENT"

            )

        );

        const statusField = element(

            "label",

            "reservation-field"

        );

        statusField.append(

            element(

                "span",

                "",

                "REQUEST STATUS"

            )

        );

        const statusSelect =
            document.createElement("select");

        for (const status of wishlistStatuses) {

            const option = element(

                "option",

                "",

                statusLabel(status)

            );

            option.value = status;

            statusSelect.append(option);

        }

        statusSelect.value = request.status;

        statusField.append(statusSelect);


        /* PRIVATE RESPONSE FIELD */

        const responseField = element(

            "label",

            "reservation-field"

        );

        responseField.append(

            element(

                "span",

                "",

                "PRIVATE RESPONSE TO MEMBER"

            )

        );

        const responseInput =
            document.createElement("textarea");

        responseInput.rows = 5;

        responseInput.maxLength = 3000;

        responseInput.value =
            request.admin_response || "";

        responseInput.placeholder =

            "Write a private response to this request...";

        responseField.append(responseInput);


        /* SAVE BUTTON */

        const saveButton = element(

            "button",

            "reservation-button reservation-primary",

            "SAVE REQUEST UPDATE"

        );

        saveButton.type = "submit";

        const message = element(

            "div",

            "reservation-message"

        );

        message.setAttribute(

            "role",

            "status"

        );

        form.append(

            statusField,

            responseField,

            saveButton,

            message

        );

        let saving = false;

        form.addEventListener(

            "submit",

            async event => {

                event.preventDefault();

                if (!isAdmin || saving) return;

                saving = true;

                saveButton.disabled = true;

                statusSelect.disabled = true;

                responseInput.disabled = true;

                saveButton.textContent = "SAVING...";

                message.textContent = "";

                try {

                    const {

                        error

                    } = await supabase

                        .from("doll_wishlist")

                        .update({

                            status: statusSelect.value,

                            admin_response:
                                responseInput.value.trim(),

                            updated_at:
                                new Date().toISOString()

                        })

                        .eq("id", request.id)

                        .select("id")

                        .single();

                    if (error) throw error;

                    showMessage(

                        "wishlistAdminMessage",

                        "Wishlist request updated successfully.",

                        "success"

                    );

                    await loadWishlistRequests();

                } catch (error) {

                    message.textContent =

                        error.message

                        || "Unable to update request.";

                    message.className =

                        "reservation-message error";

                } finally {

                    saving = false;

                    saveButton.disabled = false;

                    statusSelect.disabled = false;

                    responseInput.disabled = false;

                    saveButton.textContent =

                        "SAVE REQUEST UPDATE";

                }

            }

        );

        return form;

    }


    /* =================================================
       LOAD PRIVATE WISHLIST REQUESTS
    ================================================= */

    async function loadWishlistRequests() {

        const version = ++wishlistLoadVersion;

        const memberContainer =
            $("wishlistRequests");

        const adminContainer =
            $("wishlistAdminRequests");

        try {

            let query = supabase

                .from("doll_wishlist")

                .select("*,dolls(name)")

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

            if (version !== wishlistLoadVersion) {

                return;

            }

            if (error) throw error;

            const requests = data || [];

            const ownRequests = requests.filter(

                request => request.user_id === user.id

            );

            const memberCards = await Promise.all(

                ownRequests.map(

                    request => createWishlistCard(

                        request,

                        false

                    )

                )

            );

            if (version !== wishlistLoadVersion) {

                return;

            }

            memberContainer.replaceChildren();

            if (!memberCards.length) {

                memberContainer.append(

                    element(

                        "p",

                        "reservation-empty",

                        "You have not submitted any private requests yet."

                    )

                );

            } else {

                memberContainer.append(

                    ...memberCards

                );

            }


            /* ADMINISTRATOR REQUEST LIST */

            if (isAdmin) {

                $("wishlistAdminPanel").hidden = false;

                const adminCards = await Promise.all(

                    requests.map(

                        request => createWishlistCard(

                            request,

                            true

                        )

                    )

                );

                if (version !== wishlistLoadVersion) {

                    return;

                }

                adminContainer.replaceChildren();

                if (!adminCards.length) {

                    adminContainer.append(

                        element(

                            "p",

                            "reservation-empty",

                            "No private wishlist requests."

                        )

                    );

                } else {

                    adminContainer.append(

                        ...adminCards

                    );

                }

            }

        } catch (error) {

            if (version !== wishlistLoadVersion) {

                return;

            }

            console.error(

                "Wishlist loading failed:",

                error

            );

            memberContainer.replaceChildren(

                element(

                    "p",

                    "reservation-message error",

                    "Unable to load private requests."

                )

            );

            if (isAdmin) {

                showMessage(

                    "wishlistAdminMessage",

                    error.message

                    || "Unable to load wishlist requests.",

                    "error"

                );

            }

        }

    }

    /* =================================================
       RESERVATION EVENT LISTENERS
    ================================================= */

    function bindReservationEvents() {

        $("reservationForm").addEventListener(

            "submit",

            submitReservation

        );

        $("reservationReviewButton").addEventListener(

            "click",

            reviewReservation

        );

        $("reservationQuickReview").addEventListener(

            "click",

            reviewReservation

        );

        $("reservationAgreement").addEventListener(

            "change",

            updateConfirmButton

        );


        /* RESERVATION DATES */

        for (const id of [

            "reservationStart",

            "reservationEnd"

        ]) {

            $(id).addEventListener(

                "change",

                () => {

                    updateDates();

                    invalidateReview();

                }

            );

        }


        /* PICKUP AND RETURN TIMES */

        for (const id of [

            "reservationPickupTime",

            "reservationReturnTime"

        ]) {

            $(id).addEventListener(

                "change",

                invalidateReview

            );

        }


        /* PICKUP LOCATION */

        $("reservationPickupLocation").addEventListener(

            "input",

            () => {

                syncReturnLocation();

                invalidateReview();

            }

        );


        /* RETURN LOCATION */

        $("reservationReturnLocation").addEventListener(

            "input",

            invalidateReview

        );


        /* SAME LOCATION */

        $("reservationSameLocation").addEventListener(

            "change",

            () => {

                syncReturnLocation();

                invalidateReview();

            }

        );


        /* ADDITIONAL NOTES */

        $("reservationNotes").addEventListener(

            "input",

            invalidateReview

        );

    }


    /* =================================================
       PRIVATE WISHLIST EVENT LISTENERS
    ================================================= */

    function bindWishlistEvents() {

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

            closeWishlist

        );

        $("wishlistImage").addEventListener(

            "change",

            previewWishlistImage

        );

        $("wishlistForm").addEventListener(

            "submit",

            submitWishlist

        );

        window.addEventListener(

            "pagehide",

            () => {

                if (previewUrl) {

                    URL.revokeObjectURL(previewUrl);

                    previewUrl = null;

                }

            }

        );

    }


    /* =================================================
       VALIDATE REQUIRED HTML ELEMENTS
    ================================================= */

    function validatePageElements() {

        const requiredElements = [

            "reservationConnection",

            "reservationDollName",

            "reservationDollDescription",

            "reservationDollImage",

            "reservationForm",

            "reservationFields",

            "reservationStart",

            "reservationEnd",

            "reservationPickupTime",

            "reservationReturnTime",

            "reservationPickupLocation",

            "reservationReturnLocation",

            "reservationSameLocation",

            "reservationDuration",

            "reservationClothing",

            "reservationMakeup",

            "reservationHairstyle",

            "reservationNails",

            "reservationAccessories",

            "reservationInventorySection",

            "reservationInventorySearch",

            "reservationInventoryCategory",

            "reservationInventoryCount",

            "reservationInventoryMessage",

            "reservationInventoryOptions",

            "reservationNotes",

            "reservationAgreement",

            "reservationReviewSection",

            "reservationReviewButton",

            "reservationQuickReview",

            "reservationConfirmButton",

            "reservationSummary",

            "reservationMessage",

            "privateWishlist",

            "openWishlistButton",

            "independentWishlistButton",

            "closeWishlistButton",

            "wishlistForm",

            "wishlistCategory",

            "wishlistTitle",

            "wishlistDescription",

            "wishlistImage",

            "wishlistImagePreview",

            "wishlistMessage",

            "wishlistSubmitButton",

            "wishlistRequests",

            "wishlistAdminPanel",

            "wishlistAdminRequests",

            "wishlistAdminMessage"

        ];

        const missing = requiredElements.filter(

            id => !$(id)

        );

        if (missing.length) {

            throw new Error(

                "Missing HTML elements: "

                + missing.join(", ")

            );

        }

    }


    /* =================================================
       INITIALIZE PRIVATE WISHLIST
    ================================================= */

    async function initializeWishlist() {

        bindWishlistEvents();

        $("wishlistSubmitButton").disabled = false;

        $("wishlistAdminPanel").hidden = !isAdmin;

        await loadWishlistRequests();

    }


    /* =================================================
       INITIALIZE RESERVATION SYSTEM
    ================================================= */

    async function initializeReservation() {

        $("reservationFields").disabled = true;

        $("reservationQuickReview").disabled = true;

        $("reservationConfirmButton").disabled = true;

        showMessage(

            "reservationConnection",

            "CONNECTING TO RESERVATION DATABASE..."

        );

        bindReservationEvents();

        updateDates();

        syncReturnLocation();


        /* LOAD SELECTED PROFILE */

        const available = await loadDoll();

        if (!available) {

            $("reservationInventorySection").hidden = true;

            if (!dollId) {

                showMessage(

                    "reservationConnection",

                    "PRIVATE WISHLIST SERVICE AVAILABLE",

                    "success"

                );

            }

            return;

        }


        /* LOAD PERSONAL CONFIGURATION */

        showMessage(

            "reservationConnection",

            "LOADING PERSONAL CONFIGURATION..."

        );

        await loadGalleryOptions();


        /* LOAD CONNECTED INVENTORY */

        showMessage(

            "reservationConnection",

            "LOADING CONNECTED INVENTORY..."

        );

        try {

            await loadInventoryAccessories();

        } catch (error) {

            console.error(

                "Inventory loading failed:",

                error

            );

            inventoryReady = false;

            showMessage(

                "reservationInventoryMessage",

                "Unable to load connected accessories. "

                + "You can still make a reservation without them.",

                "error"

            );

        }


        /* ENABLE RESERVATION FORM */

        $("reservationFields").disabled = false;

        $("reservationQuickReview").disabled = false;

        $("reservationReviewButton").disabled = false;

        $("reservationConfirmButton").disabled = true;

        updateDuration();

        showMessage(

            "reservationConnection",

            "● RESERVATION SYSTEM ONLINE",

            "success"

        );

    }


    /* =================================================
       MAIN INITIALIZATION
    ================================================= */

    async function initialize() {

        try {

            validatePageElements();

        } catch (error) {

            console.error(

                "Page validation failed:",

                error

            );

            showMessage(

                "reservationConnection",

                error.message,

                "error"

            );

            return;

        }


        /* START RESERVATION SYSTEM */

        try {

            await initializeReservation();

        } catch (error) {

            console.error(

                "Reservation initialization failed:",

                error

            );

            $("reservationFields").disabled = true;

            $("reservationQuickReview").disabled = true;

            $("reservationConfirmButton").disabled = true;

            showMessage(

                "reservationConnection",

                error.message

                || "Unable to initialize reservation system.",

                "error"

            );

        }


        /* START INDEPENDENT WISHLIST SERVICE */

        try {

            await initializeWishlist();

        } catch (error) {

            console.error(

                "Wishlist initialization failed:",

                error

            );

            showMessage(

                "wishlistMessage",

                error.message

                || "Unable to initialize private wishlist.",

                "error"

            );

        }

    }


    /* =================================================
       START APPLICATION
    ================================================= */

    await initialize();

})();

/* =====================================================
   THE DEN
   END OF RESERVATION CENTER
===================================================== */
