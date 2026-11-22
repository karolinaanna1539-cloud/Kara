
/* =====================================================
   THE DEN
   DOLL PERSONAL ARCHIVE
   Supabase Database + Private Storage
   Admin-only profile editing
===================================================== */

(async function () {
    "use strict";

    // =================================================
    // CONFIGURATION
    // =================================================

    const ADMIN_ID = "3d4c3c65-3956-46b3-a83d-aae7e671c0ff";
    const BUCKET = "dolls-for-rent";

    const supabase = window.archiveSupabase;
    const session = await window.archiveAuthReady;

    if (!session || !supabase) return;

    const user = session.user;
    const isAdmin = user.id === ADMIN_ID;

    const params = new URLSearchParams(window.location.search);
    const dollId = params.get("id");

    // =================================================
    // ELEMENTS
    // =================================================

    const $ = (id) => document.getElementById(id);

    const profileMessage = $("profileMessage");
    const profileContent = $("profileContent");

    const profileMainImage = $("profileMainImage");
    const profileName = $("profileName");
    const profileDescription = $("profileDescription");
    const profileStatus = $("profileStatus");
    const profileCreated = $("profileCreated");

    const personalData = $("personalData");
    const physicalData = $("physicalData");
    const conditionData = $("conditionData");
    const dollGallery = $("dollGallery");
    const historyData = $("historyData");

    const galleryAdmin = $("galleryAdmin");
    const galleryFiles = $("galleryFiles");
    const galleryCaption = $("galleryCaption");
    const uploadGalleryButton = $("uploadGalleryButton");
    const galleryMessage = $("galleryMessage");

    const profileAdmin = $("profileAdmin");
    const profileEditForm = $("profileEditForm");
    const profileSaveButton = $("profileSaveButton");
    const profileAdminMessage = $("profileAdminMessage");

    let currentDoll = null;
    let galleryRecords = [];

    const galleryCategories = {
        clothing: {
            descriptionField: "clothing_description",
            galleryId: "clothingGallery",
            adminId: "clothingAdmin",
            filesId: "clothingFiles",
            captionId: "clothingCaption",
            buttonId: "uploadClothingButton",
            messageId: "clothingMessage",
            folder: "clothing"
        },
        makeup: {
            descriptionField: "makeup_description",
            galleryId: "makeupGallery",
            adminId: "makeupAdmin",
            filesId: "makeupFiles",
            captionId: "makeupCaption",
            buttonId: "uploadMakeupButton",
            messageId: "makeupMessage",
            folder: "makeup"
        },
        hairstyle: {
            descriptionField: "hairstyle_description",
            galleryId: "hairstyleGallery",
            adminId: "hairstyleAdmin",
            filesId: "hairstyleFiles",
            captionId: "hairstyleCaption",
            buttonId: "uploadHairstyleButton",
            messageId: "hairstyleMessage",
            folder: "hairstyle"
        },
        nails: {
            descriptionField: "nails_description",
            galleryId: "nailsGallery",
            adminId: "nailsAdmin",
            filesId: "nailsFiles",
            captionId: "nailsCaption",
            buttonId: "uploadNailsButton",
            messageId: "nailsMessage",
            folder: "nails"
        },
        accessories: {
            descriptionField: "accessories_description",
            galleryId: "accessoriesGallery",
            adminId: "accessoriesAdmin",
            filesId: "accessoriesFiles",
            captionId: "accessoriesCaption",
            buttonId: "uploadAccessoriesButton",
            messageId: "accessoriesMessage",
            folder: "accessories"
        }
    };

    // =================================================
    // FIELD DEFINITIONS
    // =================================================

    const personalFields = [
        ["character_age", "CHARACTER AGE"],
        ["origin", "ORIGIN / BACKGROUND"],
        ["personality", "PERSONALITY"]
    ];

    const physicalFields = [
        ["height_cm", "HEIGHT (CM)"],
        ["weight_kg", "WEIGHT (KG)"],
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

    const allEditableFields = [
        ["name", "DOLL NAME", "text"],
        ["description", "SHORT DESCRIPTION", "textarea"],
        ...personalFields.map(([key, label]) => [
            key, label, "textarea"
        ]),
        ...physicalFields.map(([key, label]) => [
            key, label, "text"
        ]),
        ...conditionFields.map(([key, label]) => [
            key, label, "textarea"
        ]),
        ...historyFields.map(([key, label]) => [
            key, label, "textarea"
        ]),
        ["clothing_description", "CLOTHING DESCRIPTION", "textarea"],
        ["makeup_description", "MAKE-UP DESCRIPTION", "textarea"],
        ["hairstyle_description", "HAIRSTYLE DESCRIPTION", "textarea"],
        ["nails_description", "NAILS DESCRIPTION", "textarea"],
        ["accessories_description", "ACCESSORIES DESCRIPTION", "textarea"]
    ];

    // =================================================
    // HELPERS
    // =================================================

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[char]);
    }

    function showMessage(element, message, type = "") {
        if (!element) return;

        element.textContent = message;
        element.className = "profile-message";

        if (type) {
            element.classList.add(type);
        }
    }

    function formatDate(value) {
        if (!value) return "NOT RECORDED";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return date.toLocaleDateString("sv-SE");
    }

    function getFileExtension(file) {
        const extension = file.name.split(".").pop().toLowerCase();

        if (!["jpg", "jpeg", "png", "webp", "gif"].includes(extension)) {
            return "jpg";
        }

        return extension;
    }

    function setLoading(message) {
        profileMessage.hidden = false;
        profileMessage.textContent = message;
        profileContent.hidden = true;
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

        return data?.signedUrl || null;
    }

    async function uploadImage(file, folder) {
        if (!file) {
            throw new Error("No image selected.");
        }

        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif"
        ];

        if (!allowedTypes.includes(file.type)) {
            throw new Error("Unsupported image format.");
        }

        if (file.size > 10 * 1024 * 1024) {
            throw new Error("Maximum image size is 10 MB.");
        }

        const extension = getFileExtension(file);

        const path = `${user.id}/${dollId}/${folder}-${Date.now()}-${crypto.randomUUID()}.${extension}`;

        const { error } = await supabase.storage
            .from(BUCKET)
            .upload(path, file, {
                cacheControl: "3600",
                upsert: false,
                contentType: file.type
            });

        if (error) throw error;

        return path;
    }

    function renderData(container, fields, data) {
        container.innerHTML = "";

        fields.forEach(([key, label]) => {
            const value = data[key];

            const item = document.createElement("div");
            item.className = "profile-data-item";

            const heading = document.createElement("span");
            heading.className = "profile-data-label";
            heading.textContent = label;

            const content = document.createElement("div");
            content.className = "profile-data-value";
            content.textContent =
                value !== null && value !== undefined && value !== ""
                    ? String(value)
                    : "NOT RECORDED";

            item.append(heading, content);
            container.appendChild(item);
        });
    }

    function renderHistory(data) {
        historyData.innerHTML = "";

        const history = [
            ["RECORD CREATED", formatDate(data.created_at)],
            ["LAST UPDATED", formatDate(data.updated_at)],
            ["ARCHIVE HISTORY", data.archive_history],
            ["MAINTENANCE HISTORY", data.maintenance_history],
            ["REPAIR HISTORY", data.repair_history]
        ];

        history.forEach(([label, value]) => {
            const item = document.createElement("div");
            item.className = "profile-data-item";

            const heading = document.createElement("span");
            heading.className = "profile-data-label";
            heading.textContent = label;

            const content = document.createElement("div");
            content.className = "profile-data-value";
            content.textContent =
                value !== null && value !== undefined && value !== ""
                    ? String(value)
                    : "NO RECORD";

            item.append(heading, content);
            historyData.appendChild(item);
        });
    }

    // =================================================
    // MAIN PROFILE IMAGE
    // =================================================

    async function renderMainImage(data) {
        profileMainImage.innerHTML = "";

        const imageUrl = await getImageUrl(data.image_path);

        if (!imageUrl) {
            profileMainImage.textContent = "NO IMAGE";
            return;
        }

        const image = document.createElement("img");
        image.src = imageUrl;
        image.alt = data.name || "Doll profile image";

        image.addEventListener("click", () => {
            openLightbox(imageUrl, image.alt);
        });

        profileMainImage.appendChild(image);
    }

    // =================================================
    // PROFILE RENDERING
    // =================================================

    function renderProfile(data) {
        profileName.textContent = data.name || "UNKNOWN DOLL";
        profileDescription.textContent = data.description || "";

        profileStatus.textContent = data.active
            ? "ACTIVE ARCHIVE RECORD"
            : "INACTIVE ARCHIVE RECORD";

        profileCreated.textContent =
            "ADDED TO ARCHIVE: " + formatDate(data.created_at);

        renderData(personalData, personalFields, data);
        renderData(physicalData, physicalFields, data);
        renderData(conditionData, conditionFields, data);

        renderHistory(data);

        Object.entries(galleryCategories).forEach(([category, config]) => {
            const description = $(category + "Description");

            if (description) {
                const value = data[config.descriptionField];

                description.textContent = value && String(value).trim()
                    ? value
                    : "NO DESCRIPTION AVAILABLE.";
            }

            const panel = $(config.adminId);

            if (panel) {
                panel.hidden = !isAdmin;
            }
        });

        if (isAdmin) {
            profileAdmin.hidden = false;
            galleryAdmin.hidden = false;
            buildEditForm(data);
        }
    }

    // =================================================
    // ADMIN PROFILE EDITOR
    // =================================================

    function buildEditForm(data) {
        profileEditForm.innerHTML = "";

        allEditableFields.forEach(([key, label, type]) => {
            const wrapper = document.createElement("div");
            wrapper.className = "profile-edit-field";

            if (
                type === "textarea" ||
                key === "description" ||
                key.endsWith("_description") ||
                key === "archive_history"
            ) {
                wrapper.classList.add("full");
            }

            const fieldLabel = document.createElement("label");
            fieldLabel.textContent = label;
            fieldLabel.htmlFor = `edit-${key}`;

            let input;

            if (type === "textarea") {
                input = document.createElement("textarea");
                input.rows = 3;
            } else {
                input = document.createElement("input");
                input.type = "text";
            }

            input.id = `edit-${key}`;
            input.name = key;
            input.value = data[key] ?? "";

            if (key === "name") {
                input.required = true;
            }

            wrapper.append(fieldLabel, input);
            profileEditForm.appendChild(wrapper);
        });

        // Main image upload

        const imageWrapper = document.createElement("div");
        imageWrapper.className = "profile-edit-field";

        const imageLabel = document.createElement("label");
        imageLabel.textContent = "CHANGE MAIN PROFILE IMAGE";
        imageLabel.htmlFor = "mainProfileImageFile";

        const imageInput = document.createElement("input");
        imageInput.type = "file";
        imageInput.id = "mainProfileImageFile";
        imageInput.accept = "image/jpeg,image/png,image/webp,image/gif";

        imageWrapper.append(imageLabel, imageInput);
        profileEditForm.appendChild(imageWrapper);
    }

    // =================================================
    // SAVE PROFILE
    // =================================================

    profileEditForm.addEventListener("submit", async event => {
        event.preventDefault();

        if (!isAdmin || !currentDoll) return;

        profileSaveButton.disabled = true;
        showMessage(profileAdminMessage, "SAVING PROFILE...");

        try {
            const updatedData = {};

            allEditableFields.forEach(([key]) => {
                const input = profileEditForm.elements.namedItem(key);
                updatedData[key] = input.value.trim();
            });

            updatedData.updated_at = new Date().toISOString();

            const imageInput = $("mainProfileImageFile");
            const newImage = imageInput?.files?.[0];

            const oldImagePath = currentDoll.image_path;
            let newImagePath = null;

            if (newImage) {
                newImagePath = await uploadImage(newImage, "main");
                updatedData.image_path = newImagePath;
            }

            const { data, error } = await supabase
                .from("dolls")
                .update(updatedData)
                .eq("id", dollId)
                .select()
                .single();

            if (error) throw error;

            currentDoll = data;

            if (newImagePath && oldImagePath) {
                await supabase.storage
                    .from(BUCKET)
                    .remove([oldImagePath]);
            }

            renderProfile(currentDoll);
            await renderMainImage(currentDoll);

            showMessage(
                profileAdminMessage,
                "PROFILE SAVED SUCCESSFULLY."
            );

        } catch (error) {
            console.error("Profile save error:", error);

            showMessage(
                profileAdminMessage,
                error.message || "COULD NOT SAVE PROFILE.",
                "error"
            );

        } finally {
            profileSaveButton.disabled = false;
        }
    });

    // =================================================
    // GALLERY LIGHTBOX
    // =================================================

    let lightbox = null;

    function openLightbox(url, alt = "") {
        if (!lightbox) {
            lightbox = document.createElement("div");
            lightbox.className = "doll-lightbox";

            lightbox.innerHTML = `
                <button type="button" class="doll-lightbox-close"
                    aria-label="Close image">×</button>
                <img alt="">
            `;

            document.body.appendChild(lightbox);

            lightbox.addEventListener("click", event => {
                if (
                    event.target === lightbox ||
                    event.target.classList.contains("doll-lightbox-close")
                ) {
                    lightbox.classList.remove("active");
                }
            });

            document.addEventListener("keydown", event => {
                if (event.key === "Escape") {
                    lightbox?.classList.remove("active");
                }
            });
        }

        const image = lightbox.querySelector("img");
        image.src = url;
        image.alt = alt;

        lightbox.classList.add("active");
    }

    // =================================================
    // LOAD GALLERY
    // =================================================

    async function loadGallery(category = "general", targetContainer = dollGallery) {
        if (!targetContainer) return;

        targetContainer.innerHTML = "LOADING PHOTOGRAPHS...";

        const { data, error } = await supabase
            .from("doll_gallery")
            .select("*")
            .eq("doll_id", dollId)
            .eq("category", category)
            .order("created_at", { ascending: false });

        if (error) {
            console.error(`${category} gallery load error:`, error);
            targetContainer.textContent = "COULD NOT LOAD GALLERY.";
            return;
        }

        const records = data || [];

        if (category === "general") {
            galleryRecords = records;
        }

        targetContainer.innerHTML = "";

        if (!records.length) {
            targetContainer.textContent = "NO PHOTOGRAPHS IN ARCHIVE.";
            return;
        }

        for (const photo of records) {
            const url = await getImageUrl(photo.image_path);

            if (!url) continue;

            const item = document.createElement("div");
            item.className = "gallery-item";

            const image = document.createElement("img");
            image.src = url;
            image.alt = photo.caption || currentDoll?.name || "Doll photo";
            image.loading = "lazy";

            image.addEventListener("click", () => {
                openLightbox(url, image.alt);
            });

            item.appendChild(image);

            if (photo.caption) {
                const caption = document.createElement("p");
                caption.textContent = photo.caption;
                item.appendChild(caption);
            }

            if (isAdmin) {
                const deleteButton = document.createElement("button");
                deleteButton.type = "button";
                deleteButton.textContent = "DELETE PHOTO";
                deleteButton.className = "gallery-delete";

                deleteButton.addEventListener("click", () => {
                    deleteGalleryPhoto(photo, category);
                });

                item.appendChild(deleteButton);
            }

            targetContainer.appendChild(item);
        }

        if (!targetContainer.children.length) {
            targetContainer.textContent = "NO DISPLAYABLE PHOTOGRAPHS.";
        }
    }

    async function loadCategoryGallery(category) {
        const config = galleryCategories[category];

        if (config) {
            await loadGallery(category, $(config.galleryId));
        }
    }

    // =================================================
    // UPLOAD CATEGORY GALLERY PHOTOS
    // =================================================

    async function uploadCategoryGallery(category) {
        if (!isAdmin) return;

        const config = galleryCategories[category];

        if (!config) return;

        const filesInput = $(config.filesId);
        const captionInput = $(config.captionId);
        const button = $(config.buttonId);
        const message = $(config.messageId);

        if (!filesInput || !captionInput || !button || !message) {
            console.error(`Missing HTML elements for ${category} gallery.`);
            return;
        }

        const files = Array.from(filesInput.files || []);

        if (!files.length) {
            showMessage(message, "SELECT AT LEAST ONE IMAGE.", "error");
            return;
        }

        button.disabled = true;
        showMessage(message, "UPLOADING PHOTOGRAPHS...");

        let uploadedCount = 0;
        const caption = captionInput.value.trim();

        try {
            for (const file of files) {
                const path = await uploadImage(file, config.folder);

                const { error } = await supabase
                    .from("doll_gallery")
                    .insert({
                        doll_id: dollId,
                        image_path: path,
                        caption: caption,
                        category: category
                    });

                if (error) {
                    await supabase.storage
                        .from(BUCKET)
                        .remove([path]);

                    throw error;
                }

                uploadedCount++;
            }

            filesInput.value = "";
            captionInput.value = "";

            await loadCategoryGallery(category);

            showMessage(
                message,
                `UPLOADED ${uploadedCount} PHOTOGRAPH(S) SUCCESSFULLY.`
            );

        } catch (error) {
            console.error(`${category} gallery upload error:`, error);

            showMessage(
                message,
                error.message || "GALLERY UPLOAD FAILED.",
                "error"
            );

        } finally {
            button.disabled = false;
        }
    }

    // =================================================
    // UPLOAD GENERAL GALLERY PHOTOS
    // =================================================

    uploadGalleryButton.addEventListener("click", async () => {
        if (!isAdmin) return;

        const files = Array.from(galleryFiles.files || []);

        if (files.length === 0) {
            showMessage(galleryMessage, "SELECT AT LEAST ONE IMAGE.", "error");
            return;
        }

        uploadGalleryButton.disabled = true;
        showMessage(galleryMessage, "UPLOADING PHOTOGRAPHS...");

        const caption = galleryCaption.value.trim();

        try {
            let uploadedCount = 0;

            for (const file of files) {
                const path = await uploadImage(file, "gallery");

                const { error } = await supabase
                    .from("doll_gallery")
                    .insert({
                        doll_id: dollId,
                        image_path: path,
                        caption: caption,
                        category: "general"
                    });

                if (error) {
                    await supabase.storage
                        .from(BUCKET)
                        .remove([path]);

                    throw error;
                }

                uploadedCount++;
            }

            galleryFiles.value = "";
            galleryCaption.value = "";

            await loadGallery();

            showMessage(
                galleryMessage,
                `UPLOADED ${uploadedCount} PHOTOGRAPH(S) SUCCESSFULLY.`
            );

        } catch (error) {
            console.error("Gallery upload error:", error);

            showMessage(
                galleryMessage,
                error.message || "GALLERY UPLOAD FAILED.",
                "error"
            );

        } finally {
            uploadGalleryButton.disabled = false;
        }
    });

    // =================================================
    // DELETE GALLERY PHOTO
    // =================================================

    async function deleteGalleryPhoto(photo, category = "general") {
        if (!isAdmin) return;

        const confirmed = window.confirm(
            "Are you sure you want to delete this photograph?"
        );

        if (!confirmed) return;

        try {
            const { error } = await supabase
                .from("doll_gallery")
                .delete()
                .eq("id", photo.id);

            if (error) throw error;

            const { error: storageError } = await supabase.storage
                .from(BUCKET)
                .remove([photo.image_path]);

            if (storageError) {
                console.error("Storage deletion error:", storageError);
            }

            if (category === "general") {
                await loadGallery("general", dollGallery);

                showMessage(
                    galleryMessage,
                    "PHOTOGRAPH DELETED."
                );

            } else {
                await loadCategoryGallery(category);

                showMessage(
                    $(galleryCategories[category].messageId),
                    "PHOTOGRAPH DELETED."
                );
            }

        } catch (error) {
            console.error("Gallery deletion error:", error);

            showMessage(
                category === "general"
                    ? galleryMessage
                    : $(galleryCategories[category]?.messageId),
                error.message || "COULD NOT DELETE PHOTOGRAPH.",
                "error"
            );
        }
    }

    // =================================================
    // LOAD DOLL
    // =================================================

    async function loadDoll() {
        if (!dollId) {
            setLoading("ERROR: DOLL ID IS MISSING.");
            return;
        }

        setLoading("LOADING PERSONAL RECORD...");

        const { data, error } = await supabase
            .from("dolls")
            .select("*")
            .eq("id", dollId)
            .maybeSingle();

        if (error) {
            console.error("Doll load error:", error);
            setLoading("DATABASE ERROR: COULD NOT LOAD RECORD.");
            return;
        }

        if (!data) {
            setLoading("DOLL RECORD NOT FOUND OR ACCESS DENIED.");
            return;
        }

        currentDoll = data;

        renderProfile(data);

        await renderMainImage(data);
        await loadGallery("general", dollGallery);

        for (const category of Object.keys(galleryCategories)) {
            await loadCategoryGallery(category);
        }

        profileMessage.hidden = true;
        profileContent.hidden = false;
    }

    // =================================================
    // START
    // =================================================

    Object.entries(galleryCategories).forEach(([category, config]) => {
        const button = $(config.buttonId);

        if (button) {
            button.addEventListener("click", () => {
                uploadCategoryGallery(category);
            });
        }
    });

    try {
        await loadDoll();

    } catch (error) {
        console.error("DOLL PERSONAL ARCHIVE ERROR:", error);

        setLoading("UNEXPECTED ERROR. CHECK THE BROWSER CONSOLE.");
    }

})();
