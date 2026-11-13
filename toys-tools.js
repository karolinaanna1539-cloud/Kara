
/* KAROLINA ARCHIVE — TOYS & TOOLS
   Supabase Database + Private Storage + Realtime
*/

(async function () {
    "use strict";

    const supabaseClient = window.archiveSupabase;
    const session = await window.archiveAuthReady;

    if (!session || !supabaseClient) return;

    const user = session.user;
    const BUCKET = "karolina-images";
    const MAX_FILE_SIZE = 10 * 1024 * 1024;

    let inventory = [];
    let editingImagePath = null;
    let realtimeChannel = null;

    const elements = {
        form: document.getElementById("itemForm"),
        itemId: document.getElementById("itemId"),
        name: document.getElementById("itemName"),
        category: document.getElementById("itemCategory"),
        status: document.getElementById("itemStatus"),
        location: document.getElementById("itemLocation"),
        description: document.getElementById("itemDescription"),
        image: document.getElementById("itemImageFile"),
        imagePreview: document.getElementById("currentImagePreview"),
        formTitle: document.getElementById("formTitle"),
        formMessage: document.getElementById("formMessage"),
        saveButton: document.getElementById("saveButton"),
        cancelButton: document.getElementById("cancelEditButton"),
        grid: document.getElementById("inventoryGrid"),
        search: document.getElementById("searchInput"),
        filterCategory: document.getElementById("filterCategory"),
        filterStatus: document.getElementById("filterStatus"),
        connection: document.getElementById("connectionStatus"),
        total: document.getElementById("totalCount"),
        available: document.getElementById("availableCount"),
        inUse: document.getElementById("inUseCount"),
        storage: document.getElementById("storageCount"),
        logout: document.getElementById("logoutButton")
    };

    function setMessage(message, isError = false) {
        elements.formMessage.textContent = message;
        elements.formMessage.classList.toggle("error", isError);
    }

    function setConnection(message, isError = false) {
        elements.connection.textContent = message;
        elements.connection.classList.toggle("error", isError);
    }

    function escapeText(value) {
        return String(value ?? "");
    }

    function resetForm() {
        elements.form.reset();
        elements.itemId.value = "";
        editingImagePath = null;
        elements.formTitle.textContent = "ADD NEW ITEM";
        elements.saveButton.textContent = "SAVE ITEM";
        elements.cancelButton.hidden = true;
        elements.imagePreview.replaceChildren();
        setMessage("");
    }

    function makeElement(tag, className, text) {
        const element = document.createElement(tag);

        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;

        return element;
    }

    async function getSignedImage(path) {
        if (!path) return null;

        const { data, error } = await supabaseClient.storage
            .from(BUCKET)
            .createSignedUrl(path, 3600);

        if (error) {
            console.error("Image URL error:", error);
            return null;
        }

        return data.signedUrl;
    }

    async function uploadImage(file) {
        if (!file) return null;

        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif"
        ];

        if (!allowedTypes.includes(file.type)) {
            throw new Error("Unsupported image format.");
        }

        if (file.size > MAX_FILE_SIZE) {
            throw new Error("Image is larger than 10 MB.");
        }

        const safeName = file.name
            .toLowerCase()
            .replace(/[^a-z0-9._-]/g, "-");

        const imagePath =
            user.id + "/" + crypto.randomUUID() + "-" + safeName;

        const { error } = await supabaseClient.storage
            .from(BUCKET)
            .upload(imagePath, file, {
                cacheControl: "3600",
                upsert: false,
                contentType: file.type
            });

        if (error) throw error;

        return imagePath;
    }

    async function removeImage(path) {
        if (!path) return;

        const { error } = await supabaseClient.storage
            .from(BUCKET)
            .remove([path]);

        if (error) {
            console.error("Could not remove old image:", error);
        }
    }

    async function loadInventory() {
        setConnection("SYNCHRONIZING...");

        const { data, error } = await supabaseClient
            .from("inventory_items")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            console.error(error);
            setConnection("DATABASE ERROR", true);
            elements.grid.textContent =
                "Could not load inventory. Check database permissions.";
            return;
        }

        inventory = data || [];

        setConnection("DATABASE ONLINE // REALTIME ENABLED");
        updateStatistics();
        await renderInventory();
    }

    function updateStatistics() {
        elements.total.textContent = inventory.length;

        elements.available.textContent = inventory.filter(
            item => item.status === "AVAILABLE"
        ).length;

        elements.inUse.textContent = inventory.filter(
            item => item.status === "IN USE"
        ).length;

        elements.storage.textContent = inventory.filter(
            item => item.status === "STORAGE"
        ).length;
    }

    async function renderInventory() {
        elements.grid.replaceChildren();

        const searchTerm = elements.search.value.toLowerCase().trim();
        const categoryFilter = elements.filterCategory.value;
        const statusFilter = elements.filterStatus.value;

        const filtered = inventory.filter(item => {
            const searchable = [
                item.name,
                item.category,
                item.status,
                item.location,
                item.description
            ].join(" ").toLowerCase();

            return (
                searchable.includes(searchTerm) &&
                (!categoryFilter || item.category === categoryFilter) &&
                (!statusFilter || item.status === statusFilter)
            );
        });

        if (filtered.length === 0) {
            elements.grid.appendChild(
                makeElement("p", "inventory-empty", "NO RECORDS FOUND.")
            );
            return;
        }

        for (const item of filtered) {
            const card = makeElement("article", "inventory-card");

            if (item.image_path) {
                const imageUrl = await getSignedImage(item.image_path);

                if (imageUrl) {
                    const image = document.createElement("img");
                    image.className = "inventory-image";
                    image.src = imageUrl;
                    image.alt = escapeText(item.name);
                    image.loading = "lazy";
                    card.appendChild(image);
                }
            }

            const content = makeElement("div", "inventory-content");

            content.appendChild(
                makeElement("p", "inventory-category", item.category)
            );

            content.appendChild(
                makeElement("h3", "inventory-item-name", item.name)
            );

            const status = makeElement(
                "span",
                "inventory-status",
                item.status
            );

            content.appendChild(status);

            if (item.location) {
                content.appendChild(
                    makeElement("p", "inventory-detail",
                        "LOCATION: " + item.location)
                );
            }

            if (item.description) {
                content.appendChild(
                    makeElement("p", "inventory-description",
                        item.description)
                );
            }

            const actions = makeElement("div", "inventory-action");

            const editButton = makeElement("button", "", "EDIT");
            editButton.type = "button";
            editButton.addEventListener("click", () => editItem(item));

            const deleteButton = makeElement(
                "button",
                "delete-action",
                "DELETE"
            );
            deleteButton.type = "button";
            deleteButton.addEventListener(
                "click",
                () => deleteItem(item)
            );

            actions.append(editButton, deleteButton);
            content.appendChild(actions);
            card.appendChild(content);
            elements.grid.appendChild(card);
        }
    }

    function editItem(item) {
        elements.itemId.value = item.id;
        elements.name.value = item.name || "";
        elements.category.value = item.category || "Other";
        elements.status.value = item.status || "AVAILABLE";
        elements.location.value = item.location || "";
        elements.description.value = item.description || "";

        editingImagePath = item.image_path || null;

        elements.formTitle.textContent = "EDIT ITEM";
        elements.saveButton.textContent = "UPDATE ITEM";
        elements.cancelButton.hidden = false;

        elements.imagePreview.replaceChildren();

        if (item.image_path) {
            getSignedImage(item.image_path).then(url => {
                if (!url) return;

                const image = document.createElement("img");
                image.src = url;
                image.alt = "Current item image";
                image.className = "inventory-preview-image";

                elements.imagePreview.replaceChildren(image);
            });
        }

        setMessage("Editing selected record.");
        elements.form.scrollIntoView({ behavior: "smooth" });
    }

    async function saveItem(event) {
        event.preventDefault();

        const name = elements.name.value.trim();

        if (!name) {
            setMessage("Item name is required.", true);
            return;
        }

        const itemId = elements.itemId.value;
        const selectedFile = elements.image.files[0];

        elements.saveButton.disabled = true;
        elements.saveButton.textContent = "SAVING...";

        let uploadedPath = null;

        try {
            if (selectedFile) {
                uploadedPath = await uploadImage(selectedFile);
            }

            const payload = {
                name,
                category: elements.category.value,
                status: elements.status.value,
                location: elements.location.value.trim() || null,
                description: elements.description.value.trim() || null,
                image_path: uploadedPath || editingImagePath,
                updated_at: new Date().toISOString()
            };

            let result;

            if (itemId) {
                result = await supabaseClient
                    .from("inventory_items")
                    .update(payload)
                    .eq("id", itemId)
                    .select()
                    .single();
            } else {
                result = await supabaseClient
                    .from("inventory_items")
                    .insert({
                        ...payload,
                        owner_id: user.id
                    })
                    .select()
                    .single();
            }

            if (result.error) throw result.error;

            if (uploadedPath && editingImagePath) {
                await removeImage(editingImagePath);
            }

            resetForm();
            setMessage("Record saved successfully.");

            await loadInventory();

        } catch (error) {
            console.error("Save error:", error);

            if (uploadedPath) {
                await removeImage(uploadedPath);
            }

            setMessage(
                error.message || "Could not save item.",
                true
            );

        } finally {
            elements.saveButton.disabled = false;
            elements.saveButton.textContent =
                elements.itemId.value ? "UPDATE ITEM" : "SAVE ITEM";
        }
    }

    async function deleteItem(item) {
        const confirmed = window.confirm(
            'Delete "' + item.name + '" permanently?'
        );

        if (!confirmed) return;

        try {
            const { error } = await supabaseClient
                .from("inventory_items")
                .delete()
                .eq("id", item.id);

            if (error) throw error;

            await removeImage(item.image_path);
            await loadInventory();

        } catch (error) {
            console.error("Delete error:", error);
            window.alert("Could not delete item: " + error.message);
        }
    }

    function subscribeToRealtime() {
        realtimeChannel = supabaseClient
            .channel("inventory-items-live")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "inventory_items"
                },
                () => {
                    loadInventory();
                }
            )
            .subscribe(status => {
                if (status === "SUBSCRIBED") {
                    setConnection("DATABASE ONLINE // LIVE SYNC ACTIVE");
                }

                if (status === "CHANNEL_ERROR") {
                    setConnection("REALTIME CONNECTION ERROR", true);
                }
            });
    }

    elements.form.addEventListener("submit", saveItem);

    elements.cancelButton.addEventListener("click", resetForm);

    elements.search.addEventListener("input", renderInventory);
    elements.filterCategory.addEventListener("change", renderInventory);
    elements.filterStatus.addEventListener("change", renderInventory);

    elements.logout.addEventListener("click", async () => {
        const { error } = await supabaseClient.auth.signOut();

        if (error) {
            window.alert("Could not log out: " + error.message);
            return;
        }

        window.location.replace("index.html");
    });

    await loadInventory();
    subscribeToRealtime();

    window.addEventListener("beforeunload", () => {
        if (realtimeChannel) {
            supabaseClient.removeChannel(realtimeChannel);
        }
    });

})();
