
/* ==================================================
   KAROLINA ARCHIVE
   TOYS & TOOLS INVENTORY SYSTEM
================================================== */

const STORAGE_KEY = "karolina_toys_tools_v1";

const itemForm = document.getElementById("itemForm");
const inventoryGrid = document.getElementById("inventoryGrid");

const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const statusFilter = document.getElementById("statusFilter");

const emptyMessage = document.getElementById("emptyMessage");
const resultsCount = document.getElementById("resultsCount");

const formTitle = document.getElementById("formTitle");
const saveButton = document.getElementById("saveButton");
const cancelEditButton = document.getElementById("cancelEdit");

let items = loadItems();
let editingId = null;


/* ==================================================
   LOAD AND SAVE DATA
================================================== */

function loadItems() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (!saved) {
            return [];
        }

        const parsed = JSON.parse(saved);

        return Array.isArray(parsed) ? parsed : [];

    } catch (error) {
        console.error("Could not load inventory:", error);
        return [];
    }
}


function saveItems() {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(items)
        );

        return true;

    } catch (error) {
        console.error("Could not save inventory:", error);

        alert(
            "DATABASE ERROR: Could not save your items. " +
            "Check available browser storage."
        );

        return false;
    }
}


/* ==================================================
   CREATE UNIQUE ID
================================================== */

function createId() {
    return (
        Date.now().toString(36) +
        Math.random().toString(36).slice(2, 8)
    );
}


/* ==================================================
   SAFE IMAGE URL
================================================== */

function getSafeImageUrl(value) {
    if (!value) {
        return "";
    }

    try {
        const url = new URL(value, window.location.href);

        if (
            url.protocol === "https:" ||
            url.protocol === "http:"
        ) {
            return url.href;
        }

        return "";

    } catch {
        return "";
    }
}


/* ==================================================
   UPDATE STATISTICS
================================================== */

function updateStatistics() {

    const total = items.length;

    const available = items.filter(
        item => item.status === "AVAILABLE"
    ).length;

    const inUse = items.filter(
        item => item.status === "IN USE"
    ).length;

    const storage = items.filter(
        item => item.status === "STORAGE"
    ).length;

    document.getElementById("totalCount").textContent = total;

    document.getElementById("availableCount").textContent =
        available;

    document.getElementById("inUseCount").textContent =
        inUse;

    document.getElementById("storageCount").textContent =
        storage;
}


/* ==================================================
   CREATE ITEM CARD
================================================== */

function createItemCard(item) {

    const card = document.createElement("article");
    card.className = "inventory-card";

    const imageUrl = getSafeImageUrl(item.image);

    if (imageUrl) {

        const image = document.createElement("img");

        image.className = "inventory-image";
        image.src = imageUrl;
        image.alt = item.name || "Inventory item";
        image.loading = "lazy";

        image.addEventListener("error", () => {
            image.remove();
        });

        card.appendChild(image);
    }

    const content = document.createElement("div");
    content.className = "inventory-content";

    const category = document.createElement("span");
    category.className = "inventory-category";
    category.textContent = item.category || "OTHER";

    const title = document.createElement("h3");
    title.textContent = item.name || "UNNAMED ITEM";

    const status = document.createElement("span");
    status.className = "inventory-status";

    if (item.status === "IN USE") {
        status.classList.add("in-use");
    }

    if (item.status === "UNAVAILABLE") {
        status.classList.add("unavailable");
    }

    if (item.status === "STORAGE") {
        status.classList.add("storage");
    }

    status.textContent = item.status || "UNKNOWN";

    const description = document.createElement("p");
    description.textContent =
        item.description || "NO DESCRIPTION AVAILABLE.";

    const details = document.createElement("div");
    details.className = "inventory-details";

    const location = document.createElement("span");
    location.textContent =
        "LOCATION: " + (item.location || "NOT SPECIFIED");

    const date = document.createElement("span");
    date.textContent =
        item.date || "DATE UNKNOWN";

    details.append(location, date);

    const actions = document.createElement("div");
    actions.className = "inventory-card-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "inventory-action";
    editButton.textContent = "EDIT";

    editButton.addEventListener("click", () => {
        editItem(item.id);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "inventory-action delete-action";
    deleteButton.textContent = "DELETE";

    deleteButton.addEventListener("click", () => {
        deleteItem(item.id);
    });

    actions.append(editButton, deleteButton);

    content.append(
        category,
        title,
        status,
        description,
        details,
        actions
    );

    card.appendChild(content);

    return card;
}


/* ==================================================
   DISPLAY INVENTORY
================================================== */

function renderInventory() {

    inventoryGrid.replaceChildren();

    const searchTerm = searchInput.value
        .trim()
        .toLowerCase();

    const selectedCategory = categoryFilter.value;
    const selectedStatus = statusFilter.value;

    const filteredItems = items.filter(item => {

        const searchableText = [
            item.name,
            item.category,
            item.description,
            item.location,
            item.status
        ].join(" ").toLowerCase();

        const matchesSearch =
            searchableText.includes(searchTerm);

        const matchesCategory =
            selectedCategory === "ALL" ||
            item.category === selectedCategory;

        const matchesStatus =
            selectedStatus === "ALL" ||
            item.status === selectedStatus;

        return (
            matchesSearch &&
            matchesCategory &&
            matchesStatus
        );
    });

    filteredItems.forEach(item => {
        inventoryGrid.appendChild(createItemCard(item));
    });

    resultsCount.textContent =
        filteredItems.length + " RESULTS";

    emptyMessage.hidden = filteredItems.length > 0;

    if (items.length === 0) {
        emptyMessage.textContent =
            "NO ITEMS REGISTERED. ADD YOUR FIRST ITEM ABOVE.";
    } else if (filteredItems.length === 0) {
        emptyMessage.textContent =
            "NO MATCHING ITEMS FOUND.";
    }

    updateStatistics();
}


/* ==================================================
   RESET FORM
================================================== */

function resetForm() {

    itemForm.reset();

    editingId = null;

    formTitle.textContent = "ADD NEW ITEM";
    saveButton.textContent = "+ SAVE ITEM";

    cancelEditButton.hidden = true;
}


/* ==================================================
   ADD OR UPDATE ITEM
================================================== */

itemForm.addEventListener("submit", function(event) {

    event.preventDefault();

    const name = document
        .getElementById("itemName")
        .value
        .trim();

    const category = document
        .getElementById("itemCategory")
        .value;

    const status = document
        .getElementById("itemStatus")
        .value;

    const location = document
        .getElementById("itemLocation")
        .value
        .trim();

    const image = document
        .getElementById("itemImage")
        .value
        .trim();

    const description = document
        .getElementById("itemDescription")
        .value
        .trim();

    if (!name) {
        alert("Please enter an item name.");
        return;
    }

    if (image && !getSafeImageUrl(image)) {
        alert("Please enter a valid HTTP or HTTPS image address.");
        return;
    }

    if (editingId !== null) {

        const index = items.findIndex(
            item => item.id === editingId
        );

        if (index === -1) {
            alert("ITEM NOT FOUND.");
            resetForm();
            return;
        }

        const updatedItem = {
            ...items[index],
            name,
            category,
            status,
            location,
            image,
            description
        };

        items[index] = updatedItem;

    } else {

        const newItem = {
            id: createId(),
            name,
            category,
            status,
            location,
            image,
            description,
            date: new Date().toLocaleDateString()
        };

        items.unshift(newItem);
    }

    if (saveItems()) {

        resetForm();
        renderInventory();

    }
});


/* ==================================================
   EDIT ITEM
================================================== */

function editItem(id) {

    const item = items.find(
        entry => entry.id === id
    );

    if (!item) {
        return;
    }

    editingId = id;

    document.getElementById("itemName").value =
        item.name || "";

    document.getElementById("itemCategory").value =
        item.category || "Other";

    document.getElementById("itemStatus").value =
        item.status || "AVAILABLE";

    document.getElementById("itemLocation").value =
        item.location || "";

    document.getElementById("itemImage").value =
        item.image || "";

    document.getElementById("itemDescription").value =
        item.description || "";

    formTitle.textContent = "EDIT ITEM";
    saveButton.textContent = "SAVE CHANGES";

    cancelEditButton.hidden = false;

    itemForm.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });

    document.getElementById("itemName").focus();
}


/* ==================================================
   DELETE ITEM
================================================== */

function deleteItem(id) {

    const item = items.find(
        entry => entry.id === id
    );

    if (!item) {
        return;
    }

    const confirmed = confirm(
        'DELETE "' + item.name + '" FROM INVENTORY?'
    );

    if (!confirmed) {
        return;
    }

    const previousItems = items;

    items = items.filter(
        entry => entry.id !== id
    );

    if (!saveItems()) {
        items = previousItems;
        return;
    }

    if (editingId === id) {
        resetForm();
    }

    renderInventory();
}


/* ==================================================
   CANCEL EDIT
================================================== */

cancelEditButton.addEventListener("click", resetForm);


/* ==================================================
   SEARCH AND FILTER EVENTS
================================================== */

searchInput.addEventListener("input", renderInventory);

categoryFilter.addEventListener("change", renderInventory);

statusFilter.addEventListener("change", renderInventory);


/* ==================================================
   INITIALIZE DATABASE
================================================== */

renderInventory();
