
/* =========================================
   KAROLINA ARCHIVE
   DOLL PERSONAL ARCHIVE
   Supabase + Profile + Gallery
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

    const params = new URLSearchParams(window.location.search);
    const dollId = params.get("id");

    const message = $("profileMessage");
    const content = $("profileContent");

    let doll = null;
    let gallery = [];

    const personalFields = [
        ["character_age", "CHARACTER AGE"],
        ["origin", "ORIGIN / BACKGROUND"],
        ["personality", "PERSONALITY"]
    ];

    const physicalFields = [
        ["height_cm", "HEIGHT"],
        ["weight_kg", "WEIGHT"],
        ["eye_color", "EYE COLOR"],
        ["hair_color", "HAIR COLOR"],
        ["hair_length", "HAIR LENGTH"],
        ["body_type", "BODY TYPE"],
        ["measurements", "BODY MEASUREMENTS"],
        ["clothing_size", "CLOTHING SIZE"],
        ["shoe_size", "SHOE SIZE"],
        ["material", "CONSTRUCTION MATERIAL"]
    ];

    const conditionFields = [
        ["physical_condition", "GENERAL PHYSICAL CONDITION"],
        ["face_skin_condition", "FACE / SURFACE CONDITION"],
        ["eyes_condition", "EYES / EYELASHES"],
        ["hair_condition", "HAIR CONDITION"],
        ["joints_condition", "JOINTS / CONNECTIONS"],
        ["mobility", "MOBILITY / RANGE OF MOVEMENT"],
        ["visible_damage", "VISIBLE DAMAGE"],
        ["repair_history", "REPAIR HISTORY"],
        ["maintenance_history", "MAINTENANCE / HYGIENE"],
        ["last_inspection", "LAST INSPECTION"]
    ];

    const historyFields = [
        ["archive_history", "ARCHIVE HISTORY"]
    ];

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function showMessage(text, error = false) {
        message.textContent = text;
        message.classList.toggle("error", error);
    }

    function showAdminMessage(text, error = false) {
        const target = $("profileAdminMessage");
        target.textContent = text;
        target.classList.toggle("error", error);
    }

    function displayFields(containerId, fields) {
        const container = $(containerId);
        container.replaceChildren();

        fields.forEach(([key, label]) => {
            const item = element("div",
                key === "personality" || key === "archive_history"
                    ? "profile-report-item"
                    : "profile-data-item"
            );

            item.append(element("label", "", label));
            item.append(element("p", "", doll[key] || "NOT SPECIFIED"));
            container.append(item);
        });
    }

    async function imageUrl(path) {
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

    async function loadDoll() {
        if (!dollId) {
            showMessage("ERROR: DOLL ID IS MISSING.", true);
            return;
        }

        const { data, error } = await supabase
            .from("dolls")
            .select("*")
            .eq("id", dollId)
            .single();

        if (error || !data) {
            console.error(error);
            showMessage("DOLL RECORD NOT FOUND.", true);
            return;
        }

        doll = data;
        await renderProfile();
        await loadGallery();

        content.hidden = false;
        message.textContent = "PERSONAL RECORD LOADED.";
    }

    async function renderProfile() {
        $("profileName").textContent = doll.name || "UNNAMED DOLL";
        $("profileDescription").textContent =
            doll.description || "No description available.";

        $("profileStatus").textContent =
            doll.active === false ? "INACTIVE ARCHIVE RECORD" : "ARCHIVE RECORD ACTIVE";

        $("profileCreated").textContent =
            "REGISTERED: " +
            (doll.created_at
                ? new Date(doll.created_at).toLocaleDateString()
                : "UNKNOWN");

        const mainImage = $("profileMainImage");
        mainImage.replaceChildren();

        if (doll.image_path) {
            const url = await imageUrl(doll.image_path);

            if (url) {
                const img = element("img");
                img.src = url;
                img.alt = doll.name || "Doll";
                mainImage.append(img);
            } else {
                mainImage.textContent = "IMAGE UNAVAILABLE";
            }
        } else {
            mainImage.textContent = "NO IMAGE";
        }

        displayFields("personalData", personalFields);
        displayFields("physicalData", physicalFields);
        displayFields("conditionData", conditionFields);
        displayFields("historyData", historyFields);

        if (isAdmin) {
            $("profileAdmin").hidden = false;
            $("galleryAdmin").hidden = false;
            buildEditForm();
        }
    }

    // =====================================
    // ADMIN PROFILE EDITOR
    // =====================================

    function buildEditForm() {
        const form = $("profileEditForm");
        form.replaceChildren();

        const allFields = [
            ["name", "DOLL NAME", "text", true],
            ["description", "SHORT DESCRIPTION", "textarea", true],
            ...personalFields.map(field => [...field, "textarea", true]),
            ...physicalFields.map(field => [...field, "text", true]),
            ...conditionFields.map(field => [...field, "textarea", true]),
            ...historyFields.map(field => [...field, "textarea", true])
        ];

        allFields.forEach(([key, label, type]) => {
            const wrapper = element(
                "div",
                type === "textarea" ? "profile-edit-field full" : "profile-edit-field"
            );

            const fieldLabel = element("label", "", label);
            fieldLabel.htmlFor = "edit_" + key;

            let input;

            if (type === "textarea") {
                input = element("textarea");
            } else {
                input = element("input");
                input.type = "text";
            }

            input.id = "edit_" + key;
            input.name = key;
            input.value = doll[key] || "";

            wrapper.append(fieldLabel, input);
            form.append(wrapper);
        });
    }

    $("profileEditForm").addEventListener("submit", async event => {
        event.preventDefault();

        if (!isAdmin || !doll) return;

        const saveButton = $("profileSaveButton");
        saveButton.disabled = true;
        saveButton.textContent = "SAVING...";

        const fields = [
            "name", "description",
            ...personalFields.map(field => field[0]),
            ...physicalFields.map(field => field[0]),
            ...conditionFields.map(field => field[0]),
            ...historyFields.map(field => field[0])
        ];

        const updates = {};

        fields.forEach(key => {
            updates[key] = $("edit_" + key).value.trim();
        });

        updates.updated_at = new Date().toISOString();

        const { error } = await supabase
            .from("dolls")
            .update(updates)
            .eq("id", dollId);

        saveButton.disabled = false;
        saveButton.textContent = "SAVE PROFILE";

        if (error) {
            console.error(error);
            showAdminMessage("SAVE FAILED: " + error.message, true);
            return;
        }

        doll = { ...doll, ...updates };
        await renderProfile();
        showAdminMessage("PERSONAL RECORD UPDATED.");
    });

    // =====================================
    // GALLERY
    // =====================================

    async function loadGallery() {
        const { data, error } = await supabase
            .from("doll_gallery")
            .select("*")
            .eq("doll_id", dollId)
            .order("created_at", { ascending: false });

        if (error) {
            console.error(error);
            $("dollGallery").textContent = "GALLERY COULD NOT BE LOADED.";
            return;
        }

        gallery = data || [];
        await renderGallery();
    }

    async function renderGallery() {
        const container = $("dollGallery");
        container.replaceChildren();

        if (!gallery.length) {
            container.append(
                element("p", "profile-note", "NO PHOTOGRAPHS IN THIS GALLERY.")
            );
            return;
        }

        for (const photo of gallery) {
            const item = element("div", "gallery-item");
            const url = await imageUrl(photo.image_path);

            if (!url) continue;

            const img = element("img");
            img.src = url;
            img.alt = photo.caption || doll.name || "Doll photograph";
            img.loading = "lazy";

            img.addEventListener("click", () => {
                window.open(url, "_blank", "noopener,noreferrer");
            });

            item.append(img);

            if (photo.caption) {
                item.append(element("p", "", photo.caption));
            }

            if (isAdmin) {
                const deleteButton = element(
                    "button",
                    "gallery-delete",
                    "DELETE PHOTO"
                );

                deleteButton.type = "button";

                deleteButton.addEventListener("click", async () => {
                    if (!confirm("Delete this photograph?")) return;

                    const { error: deleteError } = await supabase
                        .from("doll_gallery")
                        .delete()
                        .eq("id", photo.id);

                    if (deleteError) {
                        alert("Could not delete photo: " + deleteError.message);
                        return;
                    }

                    await supabase.storage
                        .from(BUCKET)
                        .remove([photo.image_path]);

                    await loadGallery();
                });

                item.append(deleteButton);
            }

            container.append(item);
        }
    }

    // =====================================
    // UPLOAD GALLERY PHOTOS
    // =====================================

    $("uploadGalleryButton").addEventListener("click", async () => {
        if (!isAdmin) return;

        const input = $("galleryFiles");
        const files = Array.from(input.files || []);
        const caption = $("galleryCaption").value.trim();
        const uploadButton = $("uploadGalleryButton");
        const galleryMessage = $("galleryMessage");

        galleryMessage.textContent = "";
        galleryMessage.classList.remove("error");

        if (!files.length) {
            galleryMessage.textContent = "SELECT AT LEAST ONE IMAGE.";
            galleryMessage.classList.add("error");
            return;
        }

        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif"
        ];

        for (const file of files) {
            if (file.size > 10 * 1024 * 1024) {
                galleryMessage.textContent =
                    `${file.name}: IMAGE IS LARGER THAN 10 MB.`;
                galleryMessage.classList.add("error");
                return;
            }

            if (!allowedTypes.includes(file.type)) {
                galleryMessage.textContent =
                    `${file.name}: UNSUPPORTED IMAGE FORMAT.`;
                galleryMessage.classList.add("error");
                return;
            }
        }

        uploadButton.disabled = true;
        uploadButton.textContent = "UPLOADING...";

        let uploaded = 0;

        for (const file of files) {
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
            const path =
                `${user.id}/${dollId}/${crypto.randomUUID()}-${safeName}`;

            const { error: uploadError } = await supabase.storage
                .from(BUCKET)
                .upload(path, file, {
                    contentType: file.type,
                    upsert: false
                });

            if (uploadError) {
                console.error(uploadError);
                galleryMessage.textContent =
                    "UPLOAD FAILED: " + uploadError.message;
                galleryMessage.classList.add("error");
                continue;
            }

            const { error: recordError } = await supabase
                .from("doll_gallery")
                .insert({
                    doll_id: dollId,
                    image_path: path,
                    caption
                });

            if (recordError) {
                console.error(recordError);

                await supabase.storage
                    .from(BUCKET)
                    .remove([path]);

                galleryMessage.textContent =
                    "DATABASE ERROR: " + recordError.message;
                galleryMessage.classList.add("error");
                continue;
            }

            uploaded++;
        }

        uploadButton.disabled = false;
        uploadButton.textContent = "UPLOAD TO GALLERY";

        if (uploaded > 0) {
            input.value = "";
            $("galleryCaption").value = "";
            galleryMessage.textContent =
                `${uploaded} PHOTO(S) ADDED TO GALLERY.`;
            await loadGallery();
        }
    });

    // =====================================
    // INITIALIZATION
    // =====================================

    await loadDoll();

})();
