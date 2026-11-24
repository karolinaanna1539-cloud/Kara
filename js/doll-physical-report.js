
/* =====================================================
   THE DEN
   PHYSICAL REPORT — ANATOMICAL DOCUMENTATION
===================================================== */

(async function () {
    "use strict";

    const ADMIN_ID = "3d4c3c65-3956-46b3-a83d-aae7e671c0ff";
    const BUCKET = "doll-physical";
    const TABLE = "doll_physical_gallery";

    const supabase = window.archiveSupabase;
    const session = await window.archiveAuthReady;

    if (!supabase || !session) return;

    const isAdmin = session.user.id === ADMIN_ID;

    const dollId = new URLSearchParams(
        window.location.search
    ).get("id");

    const medicalSection = document.getElementById("medical");

    if (!dollId || !medicalSection || !isAdmin) return;

    const categories = [
        ["face", "FACE"],
        ["chest", "CHEST"],
        ["abdomen", "ABDOMEN"],
        ["back", "BACK"],
        ["hands", "HANDS"],
        ["feet", "FEET"],
        ["armpits", "ARMPITS"],
        ["arms", "ARMS"],
        ["legs", "LEGS"],
        ["scars", "SCARS"],
        ["skin", "SKIN"],
        ["other", "OTHER"]
    ];

    let activeCategory = null;
    let editingRecord = null;
    let loadVersion = 0;
    let busy = false;

    const root = document.createElement("section");

    root.className = "anatomical-documentation";

    root.innerHTML = `
        <div class="anatomical-header">
            <p class="system-label">
                PRIVATE // ADMINISTRATOR ACCESS
            </p>

            <h3>ANATOMICAL DOCUMENTATION</h3>

            <p class="profile-note">
                Photographic records and physical observations.
            </p>
        </div>

        <div id="anatomicalGrid"
             class="anatomical-grid"></div>

        <div id="anatomicalPanel"
             class="anatomical-panel" hidden>

            <div class="anatomical-panel-header">
                <h3 id="anatomicalTitle"></h3>

                <button type="button"
                        id="anatomicalClose">
                    CLOSE ×
                </button>
            </div>

            <p id="anatomicalMessage"
               class="profile-message"></p>

            <div id="anatomicalGallery"
                 class="anatomical-gallery"></div>

            <form id="anatomicalForm"
                  class="anatomical-form">

                <h4 id="anatomicalFormTitle">
                    ADD DOCUMENTATION
                </h4>

                <label for="anatomicalFiles">
                    SELECT PHOTOGRAPHS
                </label>

                <input type="file"
                       id="anatomicalFiles"
                       accept="image/jpeg,image/png,image/webp"
                       multiple>

                <label for="anatomicalCaption">
                    PHOTO TITLE
                </label>

                <input type="text"
                       id="anatomicalCaption"
                       maxlength="200">

                <label for="anatomicalLocation">
                    ANATOMICAL LOCATION
                </label>

                <input type="text"
                       id="anatomicalLocation"
                       maxlength="200">

                <label for="anatomicalCondition">
                    PHYSICAL CONDITION
                </label>

                <textarea id="anatomicalCondition"
                          rows="3"
                          maxlength="2000"></textarea>

                <label for="anatomicalObservations">
                    OBSERVATIONS
                </label>

                <textarea id="anatomicalObservations"
                          rows="4"
                          maxlength="3000"></textarea>

                <label for="anatomicalDate">
                    INSPECTION DATE
                </label>

                <input type="date"
                       id="anatomicalDate"
                       required>

                <div class="anatomical-form-actions">

                    <button type="submit"
                            id="anatomicalSave">
                        SAVE DOCUMENTATION
                    </button>

                    <button type="button"
                            id="anatomicalCancel"
                            hidden>
                        CANCEL EDIT
                    </button>

                </div>

            </form>
        </div>
    `;

    medicalSection.appendChild(root);

    const $ = id => document.getElementById(id);

    const grid = $("anatomicalGrid");
    const panel = $("anatomicalPanel");
    const gallery = $("anatomicalGallery");
    const form = $("anatomicalForm");
    const message = $("anatomicalMessage");
    const saveButton = $("anatomicalSave");

    const filesInput = $("anatomicalFiles");
    const captionInput = $("anatomicalCaption");
    const locationInput = $("anatomicalLocation");
    const conditionInput = $("anatomicalCondition");
    const observationsInput = $("anatomicalObservations");
    const dateInput = $("anatomicalDate");

    // =================================================
    // HELPERS
    // =================================================

    function today() {
        const date = new Date();

        const year = date.getFullYear();
        const month = String(
            date.getMonth() + 1
        ).padStart(2, "0");

        const day = String(
            date.getDate()
        ).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    function showMessage(text, error = false) {
        message.textContent = text;

        message.classList.toggle(
            "error",
            error
        );
    }

    function setBusy(value) {
        busy = value;

        saveButton.disabled = value;

        root.querySelectorAll(
            "button, input, textarea"
        ).forEach(element => {
            element.disabled = value;
        });
    }

    function resetForm() {
        editingRecord = null;

        form.reset();

        dateInput.value = today();

        filesInput.disabled = false;

        $("anatomicalFormTitle").textContent =
            "ADD DOCUMENTATION";

        saveButton.textContent =
            "SAVE DOCUMENTATION";

        $("anatomicalCancel").hidden = true;
    }

    function createElement(tag, className, text) {
        const element = document.createElement(tag);

        if (className) {
            element.className = className;
        }

        if (text !== undefined) {
            element.textContent = text;
        }

        return element;
    }

    // =================================================
    // CATEGORY TILES
    // =================================================

    categories.forEach(([key, label], index) => {

        const button = createElement(
            "button",
            "anatomical-tile"
        );

        button.type = "button";
        button.dataset.category = key;

        button.setAttribute(
            "aria-expanded",
            "false"
        );

        const number = createElement(
            "span",
            "anatomical-number",
            String(index + 1).padStart(2, "0")
        );

        const title = createElement(
            "strong",
            "",
            label
        );

        const description = createElement(
            "span",
            "anatomical-tile-label",
            "VIEW RECORDS +"
        );

        button.append(
            number,
            title,
            description
        );

        button.addEventListener("click", () => {
            openCategory(key, label);
        });

        grid.appendChild(button);
    });

    async function openCategory(key, label) {
        if (busy) return;

        if (activeCategory === key) {
            closeCategory();
            return;
        }

        activeCategory = key;

        resetForm();

        $("anatomicalTitle").textContent =
            label + " // RECORD";

        panel.hidden = false;

        grid.querySelectorAll("button").forEach(button => {

            const active =
                button.dataset.category === key;

            button.classList.toggle(
                "active",
                active
            );

            button.setAttribute(
                "aria-expanded",
                String(active)
            );
        });

        showMessage("");

        await loadGallery();
    }

    function closeCategory() {
        if (busy) return;

        loadVersion++;

        activeCategory = null;
        panel.hidden = true;

        grid.querySelectorAll("button").forEach(button => {

            button.classList.remove("active");

            button.setAttribute(
                "aria-expanded",
                "false"
            );
        });

        resetForm();
    }

    $("anatomicalClose").addEventListener(
        "click",
        closeCategory
    );

    $("anatomicalCancel").addEventListener(
        "click",
        resetForm
    );

    // =================================================
    // PHOTO LIGHTBOX
    // =================================================

    function openPhoto(url, caption) {

        const dialog = document.createElement("dialog");

        dialog.className = "anatomical-lightbox";

        const image = document.createElement("img");

        image.src = url;
        image.alt = caption || "Physical documentation";

        const close = createElement(
            "button",
            "anatomical-lightbox-close",
            "CLOSE ×"
        );

        close.type = "button";

        close.addEventListener("click", () => {
            dialog.close();
        });

        dialog.addEventListener("click", event => {
            if (event.target === dialog) {
                dialog.close();
            }
        });

        dialog.addEventListener("close", () => {
            dialog.remove();
        });

        dialog.append(close, image);

        document.body.appendChild(dialog);

        dialog.showModal();
    }

    // =================================================
    // LOAD DOCUMENTATION
    // =================================================

    async function loadGallery() {

        if (!activeCategory) return;

        const version = ++loadVersion;
        const category = activeCategory;

        gallery.textContent =
            "LOADING DOCUMENTATION...";

        const { data, error } = await supabase
            .from(TABLE)
            .select("*")
            .eq("doll_id", dollId)
            .eq("category", category)
            .order("inspection_date", {
                ascending: false
            })
            .order("created_at", {
                ascending: false
            });

        if (version !== loadVersion) return;

        if (error) {

            gallery.textContent =
                "COULD NOT LOAD DOCUMENTATION.";

            showMessage(error.message, true);

            return;
        }

        gallery.replaceChildren();

        if (!data.length) {

            gallery.textContent =
                "NO DOCUMENTATION RECORDED.";

            return;
        }

        for (const record of data) {

            const { data: signedData } =
                await supabase.storage
                    .from(BUCKET)
                    .createSignedUrl(
                        record.image_path,
                        300
                    );

            if (version !== loadVersion) return;

            const card = createElement(
                "article",
                "anatomical-record"
            );

            if (signedData?.signedUrl) {

                const image =
                    document.createElement("img");

                image.src = signedData.signedUrl;
                image.alt =
                    record.caption ||
                    "Physical documentation";

                image.loading = "lazy";

                image.addEventListener("click", () => {
                    openPhoto(
                        signedData.signedUrl,
                        record.caption
                    );
                });

                card.appendChild(image);

            } else {

                card.appendChild(
                    createElement(
                        "p",
                        "profile-note",
                        "IMAGE UNAVAILABLE"
                    )
                );
            }

            card.appendChild(
                createElement(
                    "h4",
                    "",
                    record.caption || "UNTITLED RECORD"
                )
            );

            const fields = [
                ["LOCATION", record.location],
                ["CONDITION", record.physical_condition],
                ["OBSERVATIONS", record.observations],
                ["INSPECTION DATE", record.inspection_date]
            ];

            fields.forEach(([label, value]) => {

                const item = createElement(
                    "div",
                    "anatomical-record-field"
                );

                item.append(
                    createElement("span", "", label),
                    createElement(
                        "p",
                        "",
                        value || "NOT RECORDED"
                    )
                );

                card.appendChild(item);
            });

            const actions = createElement(
                "div",
                "anatomical-record-actions"
            );

            const editButton = createElement(
                "button",
                "",
                "EDIT"
            );

            const deleteButton = createElement(
                "button",
                "anatomical-delete",
                "DELETE"
            );

            editButton.type = "button";
            deleteButton.type = "button";

            editButton.addEventListener("click", () => {
                editRecord(record);
            });

            deleteButton.addEventListener("click", () => {
                deleteRecord(record);
            });

            actions.append(
                editButton,
                deleteButton
            );

            card.appendChild(actions);

            gallery.appendChild(card);
        }
    }

    // =================================================
    // EDIT RECORD
    // =================================================

    function editRecord(record) {

        if (busy) return;

        editingRecord = record;

        filesInput.value = "";
        filesInput.disabled = true;

        captionInput.value =
            record.caption || "";

        locationInput.value =
            record.location || "";

        conditionInput.value =
            record.physical_condition || "";

        observationsInput.value =
            record.observations || "";

        dateInput.value =
            record.inspection_date || today();

        $("anatomicalFormTitle").textContent =
            "EDIT DOCUMENTATION";

        saveButton.textContent =
            "UPDATE RECORD";

        $("anatomicalCancel").hidden = false;

        form.scrollIntoView({
            behavior: "smooth",
            block: "nearest"
        });
    }

    // =================================================
    // SAVE / UPLOAD
    // =================================================

    form.addEventListener("submit", async event => {

        event.preventDefault();

        if (!isAdmin || !activeCategory || busy) return;

        const files = Array.from(
            filesInput.files || []
        );

        const recordData = {
            caption: captionInput.value.trim(),
            location: locationInput.value.trim(),
            physical_condition: conditionInput.value.trim(),
            observations: observationsInput.value.trim(),
            inspection_date: dateInput.value,
            updated_at: new Date().toISOString()
        };

        setBusy(true);

        showMessage("SAVING DOCUMENTATION...");

        let uploadedCount = 0;

        try {

            if (editingRecord) {

                const { error } = await supabase
                    .from(TABLE)
                    .update(recordData)
                    .eq("id", editingRecord.id)
                    .eq("doll_id", dollId);

                if (error) throw error;

            } else {

                if (!files.length) {
                    throw new Error(
                        "SELECT AT LEAST ONE PHOTOGRAPH."
                    );
                }

                const extensions = {
                    "image/jpeg": "jpg",
                    "image/png": "png",
                    "image/webp": "webp"
                };

                for (const file of files) {

                    if (!extensions[file.type]) {
                        throw new Error(
                            "UNSUPPORTED IMAGE FORMAT."
                        );
                    }

                    if (file.size > 10 * 1024 * 1024) {
                        throw new Error(
                            "MAXIMUM FILE SIZE IS 10 MB."
                        );
                    }
                }

                for (const file of files) {

                    const extension =
                        extensions[file.type];

                    const path =
                        `${session.user.id}/${dollId}/` +
                        `${activeCategory}/` +
                        `${crypto.randomUUID()}.${extension}`;

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
                            .from(TABLE)
                            .insert({
                                ...recordData,
                                doll_id: dollId,
                                category: activeCategory,
                                image_path: path,
                                created_by: session.user.id
                            });

                    if (insertError) {

                        await supabase.storage
                            .from(BUCKET)
                            .remove([path]);

                        throw insertError;
                    }

                    uploadedCount++;
                }
            }

            resetForm();

            await loadGallery();

            showMessage(
                "DOCUMENTATION SAVED SUCCESSFULLY."
            );

        } catch (error) {

            console.error(error);

            if (uploadedCount > 0) {
                await loadGallery();
            }

            showMessage(
                (uploadedCount
                    ? `${uploadedCount} PHOTO(S) SAVED. `
                    : "") +
                (error.message || "SAVE FAILED."),
                true
            );

        } finally {

            setBusy(false);

            filesInput.disabled =
                Boolean(editingRecord);
        }
    });

    // =================================================
    // DELETE DOCUMENTATION
    // =================================================

    async function deleteRecord(record) {

        if (!isAdmin || busy) return;

        if (!window.confirm(
            "Permanently delete this documentation?"
        )) return;

        setBusy(true);

        try {

            const { error } = await supabase
                .from(TABLE)
                .delete()
                .eq("id", record.id)
                .eq("doll_id", dollId);

            if (error) throw error;

            const { error: storageError } =
                await supabase.storage
                    .from(BUCKET)
                    .remove([record.image_path]);

            if (editingRecord?.id === record.id) {
                resetForm();
            }

            await loadGallery();

            if (storageError) {

                showMessage(
                    "RECORD DELETED. STORAGE CLEANUP FAILED.",
                    true
                );

            } else {

                showMessage(
                    "DOCUMENTATION DELETED."
                );
            }

        } catch (error) {

            showMessage(
                error.message || "DELETE FAILED.",
                true
            );

        } finally {

            setBusy(false);

            filesInput.disabled =
                Boolean(editingRecord);
        }
    }

    resetForm();

})();
