
/* =====================================================
   THE DEN — BODY MEASUREMENTS
   INTERACTIVE ANATOMICAL MAPPING SYSTEM
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

    const dollId = new URLSearchParams(
        window.location.search
    ).get("id");

    const root = document.getElementById(
        "bodyMeasurements"
    );

    if (!dollId || !root) return;

    const TABLE = "doll_body_measurements";

    /* =================================================
       MEASUREMENT DEFINITIONS
    ================================================= */

    const groups = {

        general: {
            label: "GENERAL",
            fields: [
                ["height_cm", "HEIGHT", 40, 205,
                    "Total height from the floor to the top of the head."],

                ["weight_kg", "WEIGHT", null, null,
                    "Total body weight.", "kg"]
            ]
        },

        head: {
            label: "HEAD & NECK",
            fields: [
                ["head_circumference_cm", "HEAD CIRCUMFERENCE", 180, 40,
                    "Measure around the widest part of the head."],

                ["head_length_cm", "HEAD LENGTH", 213, 45,
                    "Vertical distance from the top of the head to the chin."],

                ["head_width_cm", "HEAD WIDTH", 147, 49,
                    "Horizontal width of the head."],

                ["neck_circumference_cm", "NECK CIRCUMFERENCE", 180, 87,
                    "Circumference around the neck."],

                ["neck_length_cm", "NECK LENGTH", 207, 84,
                    "Distance from the base of the head to the base of the neck."]
            ]
        },

        torso: {
            label: "UPPER BODY",
            fields: [
                ["shoulder_width_cm", "SHOULDER WIDTH", 225, 111,
                    "Distance between the outer shoulder points."],

                ["chest_circumference_cm", "CHEST CIRCUMFERENCE", 180, 140,
                    "Circumference around the fullest part of the chest."],

                ["underbust_circumference_cm", "UNDERBUST CIRCUMFERENCE", 180, 163,
                    "Circumference directly below the chest."],

                ["waist_circumference_cm", "WAIST CIRCUMFERENCE", 180, 190,
                    "Circumference around the natural waist."],

                ["hip_circumference_cm", "HIP CIRCUMFERENCE", 180, 226,
                    "Circumference around the widest part of the hips."],

                ["torso_length_cm", "TORSO LENGTH", 140, 184,
                    "Distance from the shoulder to the waist."],

                ["back_length_cm", "BACK LENGTH", 180, 119,
                    "Distance from the base of the neck to the waist along the back."]
            ]
        },

        leftArm: {
            label: "LEFT ARM",
            fields: [
                ["left_arm_length_cm", "ARM LENGTH", 280, 174,
                    "Distance from the shoulder to the wrist."],

                ["left_upper_arm_circumference_cm", "UPPER ARM CIRCUMFERENCE", 237, 151,
                    "Circumference around the upper arm."],

                ["left_forearm_circumference_cm", "FOREARM CIRCUMFERENCE", 251, 199,
                    "Circumference around the widest part of the forearm."],

                ["left_wrist_circumference_cm", "WRIST CIRCUMFERENCE", 258, 235,
                    "Circumference around the wrist."],

                ["left_hand_length_cm", "HAND LENGTH", 262, 265,
                    "Distance from the wrist to the tip of the middle finger."]
            ]
        },

        rightArm: {
            label: "RIGHT ARM",
            fields: [
                ["right_arm_length_cm", "ARM LENGTH", 80, 174,
                    "Distance from the shoulder to the wrist."],

                ["right_upper_arm_circumference_cm", "UPPER ARM CIRCUMFERENCE", 123, 151,
                    "Circumference around the upper arm."],

                ["right_forearm_circumference_cm", "FOREARM CIRCUMFERENCE", 109, 199,
                    "Circumference around the widest part of the forearm."],

                ["right_wrist_circumference_cm", "WRIST CIRCUMFERENCE", 102, 235,
                    "Circumference around the wrist."],

                ["right_hand_length_cm", "HAND LENGTH", 98, 265,
                    "Distance from the wrist to the tip of the middle finger."]
            ]
        },

        leftLeg: {
            label: "LEFT LEG",
            fields: [
                ["left_leg_length_cm", "LEG LENGTH", 242, 340,
                    "Distance from the waist to the floor."],

                ["left_inseam_cm", "INSEAM LENGTH", 184, 345,
                    "Distance from the crotch to the floor along the inner leg."],

                ["left_thigh_circumference_cm", "THIGH CIRCUMFERENCE", 207, 268,
                    "Circumference around the widest part of the thigh."],

                ["left_knee_circumference_cm", "KNEE CIRCUMFERENCE", 203, 326,
                    "Circumference around the knee."],

                ["left_calf_circumference_cm", "CALF CIRCUMFERENCE", 203, 365,
                    "Circumference around the widest part of the calf."],

                ["left_ankle_circumference_cm", "ANKLE CIRCUMFERENCE", 202, 411,
                    "Circumference around the ankle."],

                ["left_foot_length_cm", "FOOT LENGTH", 205, 448,
                    "Distance from the heel to the longest toe."]
            ]
        },

        rightLeg: {
            label: "RIGHT LEG",
            fields: [
                ["right_leg_length_cm", "LEG LENGTH", 118, 340,
                    "Distance from the waist to the floor."],

                ["right_inseam_cm", "INSEAM LENGTH", 176, 345,
                    "Distance from the crotch to the floor along the inner leg."],

                ["right_thigh_circumference_cm", "THIGH CIRCUMFERENCE", 153, 268,
                    "Circumference around the widest part of the thigh."],

                ["right_knee_circumference_cm", "KNEE CIRCUMFERENCE", 157, 326,
                    "Circumference around the knee."],

                ["right_calf_circumference_cm", "CALF CIRCUMFERENCE", 157, 365,
                    "Circumference around the widest part of the calf."],

                ["right_ankle_circumference_cm", "ANKLE CIRCUMFERENCE", 158, 411,
                    "Circumference around the ankle."],

                ["right_foot_length_cm", "FOOT LENGTH", 155, 448,
                    "Distance from the heel to the longest toe."]
            ]
        }

    };

    const fields = Object.entries(groups).flatMap(
        ([group, config]) =>
            config.fields.map(
                ([key, label, x, y, description, unit]) => ({
                    key,
                    label,
                    x,
                    y,
                    description,
                    unit: unit || "cm",
                    group
                })
            )
    );

    const textFields = [
        "clothing_size",
        "shoe_size",
        "glove_size",
        "measurement_date",
        "notes"
    ];

    let savedData = {};
    let measurements = {};

    let selectedGroup = "torso";
    let selectedField = "waist_circumference_cm";

    let busy = false;
    let loaded = false;
    let dirty = false;

    const ui = {};

    /* =================================================
       HELPERS
    ================================================= */

    function element(tag, className, text) {

        const node = document.createElement(tag);

        if (className) node.className = className;

        if (text !== undefined) {
            node.textContent = text;
        }

        return node;

    }

    function button(label, className, action) {

        const node = element(
            "button",
            className,
            label
        );

        node.type = "button";

        if (action) {
            node.addEventListener("click", action);
        }

        return node;

    }

    function hasValue(value) {

        return value !== null &&
            value !== undefined &&
            value !== "";

    }

    function getField(key) {

        return fields.find(
            field => field.key === key
        );

    }

    function displayValue(key) {

        const value = measurements[key];

        if (!hasValue(value)) return "—";

        const number = Number(value);

        return Number.isFinite(number)
            ? String(number)
            : "—";

    }

    function today() {

        const parts = new Intl.DateTimeFormat(
            "en-CA",
            {
                timeZone: "Europe/Stockholm",
                year: "numeric",
                month: "2-digit",
                day: "2-digit"
            }
        ).formatToParts(new Date());

        const date = Object.fromEntries(
            parts.map(part => [
                part.type,
                part.value
            ])
        );

        return `${date.year}-${date.month}-${date.day}`;

    }

    function message(text, type = "") {

        ui.message.textContent = text;

        ui.message.className =
            "bm-message " + type;

    }

    function setDirty() {

        dirty = true;

        ui.unsaved.textContent =
            "UNSAVED CHANGES";

        updateProgress();
        renderOverview();

    }

    /* =================================================
       BUILD MODULE
    ================================================= */

    function buildModule() {

        root.replaceChildren();

        root.classList.add(
            "body-measurements"
        );

        const header = element(
            "div",
            "bm-header"
        );

        const heading = element("div");

        heading.append(

            element(
                "p",
                "bm-system-label",
                "THE DEN // ANATOMICAL DATABASE"
            ),

            element(
                "h2",
                "bm-title",
                "BODY MEASUREMENTS"
            ),

            element(
                "p",
                "bm-subtitle",
                "INTERACTIVE BODY MAPPING SYSTEM"
            )

        );

        header.append(

            heading,

            element(
                "span",
                "bm-access-label",
                isAdmin
                    ? "ADMINISTRATOR ACCESS"
                    : "READ ONLY"
            )

        );

        ui.overview = element(
            "div",
            "bm-overview"
        );

        const workspace = element(
            "div",
            "bm-workspace"
        );

        /* MANNEQUIN */

        const mannequinPanel = element(
            "div",
            "bm-mannequin-panel"
        );

        mannequinPanel.appendChild(
            element(
                "h3",
                "bm-panel-heading",
                "ANATOMICAL REFERENCE"
            )
        );

        ui.stage = element(
            "div",
            "bm-mannequin-stage"
        );

        const image = document.createElement("img");

        image.src = "images/body-mannequin.svg";
        image.alt = "Front anatomical reference mannequin";

        image.addEventListener("error", () => {

            message(
                "Mannequin image could not be loaded.",
                "error"
            );

        });

        ui.stage.appendChild(image);

        const svg = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "svg"
        );

        svg.setAttribute(
            "viewBox",
            "0 0 360 500"
        );

        svg.setAttribute(
            "class",
            "bm-svg-overlay"
        );

        svg.setAttribute(
            "aria-hidden",
            "true"
        );

        ui.overlay = svg;

        ui.stage.appendChild(svg);

        mannequinPanel.append(

            ui.stage,

            element(
                "p",
                "bm-mannequin-caption",
                "FRONT VIEW // R = RIGHT // L = LEFT"
            ),

            element(
                "p",
                "bm-mannequin-caption",
                "SELECT A MEASUREMENT POINT — NOT TO SCALE"
            )

        );

        /* CONTROL PANEL */

        const controls = element(
            "div",
            "bm-controls"
        );

        ui.categories = element(
            "div",
            "bm-categories"
        );

        ui.list = element(
            "div",
            "bm-measurement-list"
        );

        ui.editor = element(
            "div",
            "bm-editor"
        );

        controls.append(

            element(
                "h3",
                "bm-panel-heading",
                "ANATOMICAL CATEGORIES"
            ),

            ui.categories,
            ui.list,
            ui.editor

        );

        workspace.append(
            mannequinPanel,
            controls
        );

        root.append(
            header,
            ui.overview,
            workspace
        );

        buildProgress();
        buildSizes();
        buildDocumentation();
        buildActions();

        ui.message = element(
            "div",
            "bm-message"
        );

        ui.message.setAttribute(
            "aria-live",
            "polite"
        );

        root.appendChild(ui.message);

        ui.footer = element(
            "div",
            "bm-footer"
        );

        root.appendChild(ui.footer);

        renderAll();

    }

    /* =================================================
       GENERAL OVERVIEW
    ================================================= */

    function renderOverview() {

        ui.overview.replaceChildren();

        const items = [

            ["HEIGHT", "height_cm", "cm"],

            ["WEIGHT", "weight_kg", "kg"],

            ["WAIST", "waist_circumference_cm", "cm"],

            ["HIPS", "hip_circumference_cm", "cm"]

        ];

        for (const [label, key, unit] of items) {

            const card = element(
                "div",
                "bm-overview-card"
            );

            card.append(

                element(
                    "span",
                    "bm-overview-label",
                    label
                ),

                element(
                    "span",
                    "bm-overview-value",
                    displayValue(key)
                ),

                element(
                    "span",
                    "bm-overview-unit",
                    unit
                )

            );

            ui.overview.appendChild(card);

        }

    }

    /* =================================================
       CATEGORY NAVIGATION
    ================================================= */

    function renderCategories() {

        ui.categories.replaceChildren();

        for (const [key, group] of Object.entries(groups)) {

            const groupFields = fields.filter(
                field => field.group === key
            );

            const completed = groupFields.filter(
                field =>
                    hasValue(measurements[field.key])
            ).length;

            const tile = button(
                "",
                "bm-category",
                () => {

                    selectedGroup = key;

                    selectedField =
                        groupFields[0].key;

                    renderSelection();

                }
            );

            tile.classList.toggle(
                "active",
                selectedGroup === key
            );

            tile.setAttribute(
                "aria-pressed",
                String(selectedGroup === key)
            );

            tile.append(

                element(
                    "span",
                    "bm-category-name",
                    group.label
                ),

                element(
                    "span",
                    "bm-category-count",
                    completed + " / " +
                    groupFields.length + " RECORDED"
                )

            );

            ui.categories.appendChild(tile);

        }

    }

    /* =================================================
       MEASUREMENT LIST
    ================================================= */

    function renderMeasurementList() {

        ui.list.replaceChildren();

        const groupFields = fields.filter(
            field => field.group === selectedGroup
        );

        for (const field of groupFields) {

            const row = button(
                "",
                "bm-measurement-row",
                () => selectMeasurement(field.key)
            );

            row.classList.toggle(
                "active",
                selectedField === field.key
            );

            row.setAttribute(
                "aria-pressed",
                String(selectedField === field.key)
            );

            const value = element(
                "span",
                "bm-measurement-value",
                displayValue(field.key)
            );

            if (!hasValue(measurements[field.key])) {

                value.classList.add("empty");

            }

            value.appendChild(
                element(
                    "span",
                    "bm-measurement-unit",
                    " " + field.unit
                )
            );

            row.append(

                element(
                    "span",
                    "bm-measurement-name",
                    field.label
                ),

                value

            );

            ui.list.appendChild(row);

        }

    }

    /* =================================================
       SELECT MEASUREMENT
    ================================================= */

    function selectMeasurement(key) {

        const field = getField(key);

        if (!field) return;

        selectedField = field.key;
        selectedGroup = field.group;

        renderSelection();

    }

    /* =================================================
       MANNEQUIN POINTS
    ================================================= */

    function renderPoints() {

        ui.stage.querySelectorAll(
            ".bm-point"
        ).forEach(point => point.remove());

        const visibleFields = fields.filter(
            field =>
                field.group === selectedGroup &&
                field.x !== null &&
                field.y !== null
        );

        visibleFields.forEach((field, index) => {

            const point = button(
                String(index + 1),
                "bm-point",
                () => selectMeasurement(field.key)
            );

            point.style.left =
                (field.x / 360 * 100) + "%";

            point.style.top =
                (field.y / 500 * 100) + "%";

            point.title =
                field.label + ": " +
                displayValue(field.key) +
                " " + field.unit;

            point.setAttribute(
                "aria-label",
                point.title
            );

            point.setAttribute(
                "aria-pressed",
                String(selectedField === field.key)
            );

            point.classList.toggle(
                "active",
                selectedField === field.key
            );

            point.classList.toggle(
                "measured",
                hasValue(measurements[field.key])
            );

            if (field.x > 180) {

                point.classList.add("label-left");

            }

            const label = element(
                "span",
                "bm-point-label",
                displayValue(field.key) +
                " " + field.unit
            );

            point.appendChild(label);

            ui.stage.appendChild(point);

        });

        renderHighlight();

    }

    /* =================================================
       SVG HIGHLIGHT
    ================================================= */

    function renderHighlight() {

        ui.overlay.replaceChildren();

        const field = getField(selectedField);

        if (!field || field.x === null) return;

        const ns = "http://www.w3.org/2000/svg";

        const shapes = {

            height_cm: [
                "path",
                {
                    d: "M40 14V445 M33 14H47 M33 445H47"
                }
            ],

            head_circumference_cm: [
                "ellipse",
                { cx: 180, cy: 40, rx: 23, ry: 7 }
            ],

            head_width_cm: [
                "path",
                { d: "M157 49H203" }
            ],

            head_length_cm: [
                "path",
                { d: "M213 14V76 M207 14H219 M207 76H219" }
            ],

            neck_circumference_cm: [
                "ellipse",
                { cx: 180, cy: 87, rx: 16, ry: 4 }
            ],

            neck_length_cm: [
                "path",
                { d: "M207 71V96" }
            ],

            shoulder_width_cm: [
                "path",
                { d: "M135 111H225" }
            ],

            chest_circumference_cm: [
                "ellipse",
                { cx: 180, cy: 140, rx: 39, ry: 8 }
            ],

            underbust_circumference_cm: [
                "ellipse",
                { cx: 180, cy: 163, rx: 33, ry: 6 }
            ],

            waist_circumference_cm: [
                "ellipse",
                { cx: 180, cy: 190, rx: 30, ry: 6 }
            ],

            hip_circumference_cm: [
                "ellipse",
                { cx: 180, cy: 226, rx: 39, ry: 8 }
            ],

            torso_length_cm: [
                "path",
                { d: "M140 111V190" }
            ],

            left_arm_length_cm: [
                "path",
                { d: "M244 111L273 239" }
            ],

            right_arm_length_cm: [
                "path",
                { d: "M116 111L87 239" }
            ],

            left_leg_length_cm: [
                "path",
                { d: "M242 190V445" }
            ],

            right_leg_length_cm: [
                "path",
                { d: "M118 190V445" }
            ],

            left_inseam_cm: [
                "path",
                { d: "M184 260V445" }
            ],

            right_inseam_cm: [
                "path",
                { d: "M176 260V445" }
            ]

        };

        // Back length requires a separate rear illustration.

        if (field.key === "back_length_cm") {
            return;
        }

        let definition = shapes[field.key];

        if (!definition) {

            const radius = field.key.includes("thigh")
                ? 17
                : field.key.includes("calf")
                    ? 13
                    : 10;

            if (field.key.includes("circumference")) {

                definition = [
                    "ellipse",
                    {
                        cx: field.x,
                        cy: field.y,
                        rx: radius,
                        ry: 4
                    }
                ];

            } else {

                definition = [
                    "circle",
                    {
                        cx: field.x,
                        cy: field.y,
                        r: 12
                    }
                ];

            }

        }

        const [tag, attributes] = definition;

        const shape = document.createElementNS(
            ns,
            tag
        );

        for (const [key, value] of Object.entries(attributes)) {

            shape.setAttribute(key, value);

        }

        shape.setAttribute(
            "class",
            "bm-highlight"
        );

        ui.overlay.appendChild(shape);

    }

    /* =================================================
       MEASUREMENT EDITOR
    ================================================= */

    function renderEditor() {

        ui.editor.replaceChildren();

        const field = getField(selectedField);

        if (!field) return;

        ui.editor.append(

            element(
                "p",
                "bm-editor-label",
                groups[field.group].label
            ),

            element(
                "h3",
                "bm-editor-title",
                field.label
            ),

            element(
                "p",
                "bm-editor-description",
                field.description
            )

        );

        if (field.key === "back_length_cm") {

            ui.editor.appendChild(
                element(
                    "p",
                    "bm-field-hint",
                    "This measurement is taken from the back. The current mannequin is a front reference."
                )
            );

        }

        if (!isAdmin) {

            ui.editor.appendChild(
                element(
                    "div",
                    "bm-readonly-value",
                    displayValue(field.key) +
                    " " + field.unit
                )
            );

            return;

        }

        const inputGroup = element(
            "div",
            "bm-input-group"
        );

        const input = document.createElement(
            "input"
        );

        input.type = "number";
        input.min = "0.01";
        input.max = "9999.99";
        input.step = "0.01";

        input.placeholder = "Not recorded";

        input.value = hasValue(
            measurements[field.key]
        )
            ? measurements[field.key]
            : "";

        input.disabled = !loaded || busy;

        input.setAttribute(
            "aria-label",
            field.label
        );

        input.addEventListener("input", () => {

            if (input.validity.badInput) return;

            if (input.value === "") {

                measurements[field.key] = null;

            } else {

                const value = Number(input.value);

                if (
                    !Number.isFinite(value) ||
                    value <= 0 ||
                    value > 9999.99
                ) {

                    input.setCustomValidity(
                        "Enter a positive measurement up to 9999.99."
                    );

                    input.reportValidity();

                    return;

                }

                measurements[field.key] =
                    Math.round(value * 100) / 100;

            }

            input.setCustomValidity("");

            setDirty();

            renderCategories();
            renderMeasurementList();
            renderPoints();

        });

        input.addEventListener("blur", () => {

            input.value = hasValue(
                measurements[field.key]
            )
                ? measurements[field.key]
                : "";

            input.setCustomValidity("");

        });

        inputGroup.append(

            input,

            element(
                "span",
                "bm-input-unit",
                field.unit
            )

        );

        ui.editor.appendChild(inputGroup);

        const clear = button(
            "CLEAR MEASUREMENT",
            "bm-button",
            () => {

                if (!loaded || busy) return;

                measurements[field.key] = null;

                setDirty();

                renderSelection();

            }
        );

        clear.disabled = !loaded || busy;

        const actions = element(
            "div",
            "bm-actions"
        );

        actions.appendChild(clear);

        ui.editor.appendChild(actions);

        ui.editor.appendChild(
            element(
                "p",
                "bm-field-hint",
                "Changes are stored when you select SAVE BODY MEASUREMENTS."
            )
        );

    }

    /* =================================================
       COMPLETION PROGRESS
    ================================================= */

    function buildProgress() {

        const section = element(
            "div",
            "bm-progress"
        );

        const header = element(
            "div",
            "bm-progress-header"
        );

        ui.progressText = element("span");

        header.append(

            element(
                "span",
                "",
                "MEASUREMENT COMPLETENESS"
            ),

            ui.progressText

        );

        const track = element(
            "div",
            "bm-progress-track"
        );

        ui.progressFill = element(
            "div",
            "bm-progress-fill"
        );

        track.appendChild(ui.progressFill);

        section.append(header, track);

        root.appendChild(section);

    }

    function updateProgress() {

        const completed = fields.filter(
            field =>
                hasValue(measurements[field.key])
        ).length;

        const percent = Math.round(
            completed / fields.length * 100
        );

        ui.progressText.textContent =
            completed + " / " +
            fields.length +
            " — " + percent + "%";

        ui.progressFill.style.width =
            percent + "%";

    }

    /* =================================================
       CLOTHING SIZES
    ================================================= */

    function buildSizes() {

        const section = element(
            "div",
            "bm-sizes"
        );

        section.appendChild(
            element(
                "h3",
                "bm-panel-heading",
                "CLOTHING & ACCESSORY SIZES"
            )
        );

        const grid = element(
            "div",
            "bm-sizes-grid"
        );

        grid.append(

            createTextField(
                "clothing_size",
                "CLOTHING SIZE",
                "e.g. EU 36 / S"
            ),

            createTextField(
                "shoe_size",
                "SHOE SIZE",
                "e.g. EU 39"
            ),

            createTextField(
                "glove_size",
                "GLOVE SIZE",
                "e.g. S / 7"
            )

        );

        section.appendChild(grid);

        root.appendChild(section);

    }

    /* =================================================
       DOCUMENTATION
    ================================================= */

    function buildDocumentation() {

        const section = element(
            "div",
            "bm-documentation"
        );

        section.appendChild(
            element(
                "h3",
                "bm-panel-heading",
                "MEASUREMENT DOCUMENTATION"
            )
        );

        section.append(

            createTextField(
                "measurement_date",
                "MEASUREMENT DATE",
                "",
                "date"
            ),

            createTextField(
                "notes",
                "ADDITIONAL MEASUREMENT NOTES",
                "Measurement method, fit or other observations...",
                "textarea"
            )

        );

        section.appendChild(
            element(
                "p",
                "bm-field-hint",
                "These notes are visible to authenticated members."
            )
        );

        root.appendChild(section);

    }

    function createTextField(
        key,
        label,
        placeholder,
        type = "text"
    ) {

        const wrapper = element(
            "div",
            "bm-field"
        );

        const labelNode = element(
            "label",
            "",
            label
        );

        labelNode.htmlFor = "bm-" + key;

        let input;

        if (isAdmin) {

            input = document.createElement(
                type === "textarea"
                    ? "textarea"
                    : "input"
            );

            if (type !== "textarea") {

                input.type = type;

            }

            input.id = "bm-" + key;

            input.placeholder = placeholder;

            input.disabled = true;

            if (type === "date") {

                input.max = today();

            } else {

                input.maxLength =
                    type === "textarea"
                        ? 3000
                        : 100;

            }

            input.addEventListener("input", () => {

                measurements[key] = input.value;

                setDirty();

            });

        } else {

            input = element(
                "div",
                "bm-readonly-value",
                "NOT RECORDED"
            );

        }

        ui[key] = input;

        wrapper.append(
            labelNode,
            input
        );

        return wrapper;

    }

    function renderTextFields() {

        for (const key of textFields) {

            const value = measurements[key] || "";

            if (isAdmin) {

                ui[key].value = value;

                ui[key].disabled =
                    !loaded || busy;

            } else {

                ui[key].textContent =
                    value || "NOT RECORDED";

            }

        }

    }

    /* =================================================
       ACTIONS
    ================================================= */

    function buildActions() {

        const actions = element(
            "div",
            "bm-actions"
        );

        ui.unsaved = element(
            "p",
            "bm-unsaved"
        );

        if (isAdmin) {

            ui.save = button(
                "SAVE BODY MEASUREMENTS",
                "bm-button primary",
                saveMeasurements
            );

            ui.reset = button(
                "DISCARD UNSAVED CHANGES",
                "bm-button",
                () => {

                    if (!loaded || busy) return;

                    if (
                        dirty &&
                        !confirm("Discard unsaved changes?")
                    ) return;

                    measurements = {
                        ...savedData
                    };

                    dirty = false;

                    message("");

                    renderAll();

                }
            );

            actions.append(
                ui.save,
                ui.reset
            );

        }

        ui.refresh = button(
            "REFRESH DATA",
            "bm-button",
            () => {

                if (busy) return;

                if (
                    dirty &&
                    !confirm("Discard unsaved changes and reload?")
                ) return;

                loadMeasurements();

            }
        );

        actions.appendChild(ui.refresh);

        root.append(
            ui.unsaved,
            actions
        );

    }

    /* =================================================
       RENDERING
    ================================================= */

    function renderSelection() {

        renderCategories();
        renderMeasurementList();
        renderPoints();
        renderEditor();

    }

    function renderAll() {

        renderOverview();
        renderSelection();
        renderTextFields();
        updateProgress();

        ui.unsaved.textContent = dirty
            ? "UNSAVED CHANGES"
            : "";

        if (isAdmin) {

            ui.save.disabled =
                !loaded || busy;

            ui.reset.disabled =
                !loaded || busy;

        }

        ui.refresh.disabled = busy;

        ui.footer.replaceChildren(

            element(
                "span",
                "",
                "THE DEN // BODY MEASUREMENTS"
            ),

            element(
                "span",
                "",
                "LAST UPDATED: " +
                (
                    savedData.updated_at
                        ? new Date(
                            savedData.updated_at
                        ).toLocaleString(
                            "en-GB",
                            {
                                timeZone: "Europe/Stockholm"
                            }
                        )
                        : "NOT RECORDED"
                )
            )

        );

    }

    /* =================================================
       LOAD FROM SUPABASE
    ================================================= */

    async function loadMeasurements() {

        if (busy) return;

        busy = true;

        renderAll();

        message("LOADING BODY MEASUREMENTS...");

        try {

            const { data, error } = await supabase
                .from(TABLE)
                .select("*")
                .eq("doll_id", dollId)
                .maybeSingle();

            if (error) throw error;

            savedData = data || {};

            measurements = {
                ...savedData
            };

            loaded = true;
            dirty = false;

            message("");

        } catch (error) {

            console.error(error);

            message(
                "COULD NOT LOAD MEASUREMENTS: " +
                error.message,
                "error"
            );

        } finally {

            busy = false;

            renderAll();

        }

    }

    /* =================================================
       VALIDATE MEASUREMENTS
    ================================================= */

    function createPayload() {

        const payload = {};

        for (const field of fields) {

            const value = measurements[field.key];

            if (!hasValue(value)) {

                payload[field.key] = null;

                continue;

            }

            const number = Number(value);

            if (
                !Number.isFinite(number) ||
                number <= 0 ||
                number > 9999.99
            ) {

                throw new Error(
                    "Invalid measurement: " +
                    field.label
                );

            }

            payload[field.key] =
                Math.round(number * 100) / 100;

        }

        for (const key of textFields) {

            const value = String(
                measurements[key] || ""
            ).trim();

            payload[key] =
                key === "measurement_date"
                    ? value || null
                    : value;

        }

        if (
            payload.measurement_date &&
            payload.measurement_date > today()
        ) {

            throw new Error(
                "Measurement date cannot be in the future."
            );

        }

        return payload;

    }

    /* =================================================
       SAVE TO SUPABASE
    ================================================= */

    async function saveMeasurements() {

        if (!isAdmin || !loaded || busy) return;

        let payload;

        try {

            payload = createPayload();

        } catch (error) {

            message(
                error.message,
                "error"
            );

            return;

        }

        busy = true;

        renderAll();

        ui.save.textContent = "SAVING...";

        message("SAVING BODY MEASUREMENTS...");

        try {

            let result;

            if (savedData.doll_id) {

                let query = supabase
                    .from(TABLE)
                    .update(payload)
                    .eq("doll_id", dollId);

                if (savedData.updated_at) {

                    query = query.eq(
                        "updated_at",
                        savedData.updated_at
                    );

                }

                result = await query
                    .select("*")
                    .single();

            } else {

                result = await supabase
                    .from(TABLE)
                    .insert({
                        ...payload,
                        doll_id: dollId
                    })
                    .select("*")
                    .single();

            }

            if (result.error) {

                throw result.error;

            }

            savedData = result.data;

            measurements = {
                ...savedData
            };

            dirty = false;

            message(
                "BODY MEASUREMENTS SAVED SUCCESSFULLY.",
                "success"
            );

        } catch (error) {

            console.error(error);

            message(
                "SAVE FAILED: " +
                error.message +
                " If another session changed this record, reload the data before saving again.",
                "error"
            );

        } finally {

            busy = false;

            ui.save.textContent =
                "SAVE BODY MEASUREMENTS";

            renderAll();

        }

    }

    /* =================================================
       UNSAVED CHANGES PROTECTION
    ================================================= */

    window.addEventListener(
        "beforeunload",
        event => {

            if (!dirty) return;

            event.preventDefault();

            event.returnValue = "";

        }
    );

    /* =================================================
       INITIALIZATION
    ================================================= */

    buildModule();

    await loadMeasurements();

})();

/* =====================================================
   END OF FILE
   THE DEN © 2026
===================================================== */
