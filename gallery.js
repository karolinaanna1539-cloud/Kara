
/* KAROLINA ARCHIVE — COMMUNITY GALLERY */

(async function () {
    "use strict";

    const supabaseClient = window.archiveSupabase;
    const session = await window.archiveAuthReady;

    if (!session || !supabaseClient) return;

    const user = session.user;
    const BUCKET = "community-gallery";
    const MAX_FILE_SIZE = 10 * 1024 * 1024;

    const form = document.getElementById("galleryForm");
    const imageInput = document.getElementById("galleryImage");
    const captionInput = document.getElementById("galleryCaption");
    const uploadButton = document.getElementById("galleryUploadButton");
    const message = document.getElementById("galleryMessage");
    const grid = document.getElementById("galleryGrid");
    const count = document.getElementById("galleryCount");
    const connection = document.getElementById("galleryConnection");

    if (!form || !grid) return;

    let galleryChannel = null;
    let photos = [];

    function setMessage(text, isError = false) {
        message.textContent = text;
        message.classList.toggle("error", isError);
    }

    function setConnection(text, isError = false) {
        if (!connection) return;

        connection.textContent = text;
        connection.classList.toggle("error", isError);
    }

    function makeElement(tag, className, text) {
        const element = document.createElement(tag);

        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;

        return element;
    }

    function shortUserId(id) {
        return "USER-" + String(id || "").slice(0, 6).toUpperCase();
    }

    async function getImageUrl(path) {
        const { data, error } = await supabaseClient.storage
            .from(BUCKET)
            .createSignedUrl(path, 3600);

        if (error) {
            console.error("Gallery image URL error:", error);
            return null;
        }

        return data.signedUrl;
    }

    async function loadGallery() {
        const { data, error } = await supabaseClient
            .from("gallery_photos")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Gallery load error:", error);
            grid.textContent = "COULD NOT LOAD GALLERY.";
            setConnection("DATABASE ERROR", true);
            return;
        }

        photos = data || [];
        await renderGallery();
        setConnection("ONLINE");
    }

    async function renderGallery() {
        grid.replaceChildren();

        count.textContent = photos.length + " FILES";

        if (photos.length === 0) {
            grid.appendChild(
                makeElement(
                    "p",
                    "homepage-loading",
                    "NO PHOTOS YET. BE THE FIRST TO UPLOAD."
                )
            );
            return;
        }

        for (const photo of photos) {
            const card = makeElement("article", "gallery-photo-card");

            const imageUrl = await getImageUrl(photo.image_path);

            if (imageUrl) {
                const image = document.createElement("img");
                image.src = imageUrl;
                image.alt = photo.caption || "Community photo";
                image.loading = "lazy";
                image.className = "gallery-photo-image";
                card.appendChild(image);
            } else {
                card.appendChild(
                    makeElement(
                        "div",
                        "gallery-image-error",
                        "IMAGE UNAVAILABLE"
                    )
                );
            }

            const details = makeElement("div", "gallery-photo-details");

            details.appendChild(
                makeElement(
                    "span",
                    "gallery-photo-author",
                    shortUserId(photo.user_id)
                )
            );

            if (photo.caption) {
                details.appendChild(
                    makeElement("p", "gallery-photo-caption", photo.caption)
                );
            }

            const date = new Date(photo.created_at);

            details.appendChild(
                makeElement(
                    "span",
                    "gallery-photo-date",
                    date.toLocaleString()
                )
            );

            if (photo.user_id === user.id) {
                const deleteButton = makeElement(
                    "button",
                    "gallery-delete-button",
                    "DELETE MY PHOTO"
                );

                deleteButton.type = "button";
                deleteButton.addEventListener("click", () => {
                    deletePhoto(photo);
                });

                details.appendChild(deleteButton);
            }

            card.appendChild(details);
            grid.appendChild(card);
        }
    }

    async function uploadPhoto(event) {
        event.preventDefault();

        const file = imageInput.files[0];
        const caption = captionInput.value.trim();

        if (!file) {
            setMessage("PLEASE SELECT AN IMAGE.", true);
            return;
        }

        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif"
        ];

        if (!allowedTypes.includes(file.type)) {
            setMessage("UNSUPPORTED IMAGE FORMAT.", true);
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            setMessage("IMAGE IS LARGER THAN 10 MB.", true);
            return;
        }

        uploadButton.disabled = true;
        uploadButton.textContent = "UPLOADING...";

        const safeName = file.name
            .toLowerCase()
            .replace(/[^a-z0-9._-]/g, "-");

        const imagePath =
            user.id + "/" + crypto.randomUUID() + "-" + safeName;

        try {
            const { error: uploadError } = await supabaseClient.storage
                .from(BUCKET)
                .upload(imagePath, file, {
                    cacheControl: "3600",
                    upsert: false,
                    contentType: file.type
                });

            if (uploadError) throw uploadError;

            const { error: insertError } = await supabaseClient
                .from("gallery_photos")
                .insert({
                    user_id: user.id,
                    image_path: imagePath,
                    caption: caption || null
                });

            if (insertError) {
                await supabaseClient.storage
                    .from(BUCKET)
                    .remove([imagePath]);

                throw insertError;
            }

            form.reset();
            setMessage("IMAGE UPLOADED SUCCESSFULLY.");

            await loadGallery();

        } catch (error) {
            console.error("Gallery upload error:", error);
            setMessage(
                error.message || "COULD NOT UPLOAD IMAGE.",
                true
            );

        } finally {
            uploadButton.disabled = false;
            uploadButton.textContent = "UPLOAD IMAGE";
        }
    }

    async function deletePhoto(photo) {
        if (photo.user_id !== user.id) {
            setMessage("YOU CAN DELETE ONLY YOUR OWN PHOTOS.", true);
            return;
        }

        const confirmed = window.confirm(
            "Delete this photo permanently?"
        );

        if (!confirmed) return;

        const { error } = await supabaseClient
            .from("gallery_photos")
            .delete()
            .eq("id", photo.id)
            .eq("user_id", user.id);

        if (error) {
            console.error("Gallery delete error:", error);
            setMessage(error.message, true);
            return;
        }

        const { error: storageError } = await supabaseClient.storage
            .from(BUCKET)
            .remove([photo.image_path]);

        if (storageError) {
            console.error("Storage cleanup error:", storageError);
        }

        setMessage("PHOTO DELETED.");
        await loadGallery();
    }

    function subscribeToGallery() {
        galleryChannel = supabaseClient
            .channel("community-gallery-live")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "gallery_photos"
                },
                () => loadGallery()
            )
            .subscribe(status => {
                if (status === "SUBSCRIBED") {
                    setConnection("ONLINE // LIVE SYNC");
                }

                if (
                    status === "CHANNEL_ERROR" ||
                    status === "TIMED_OUT"
                ) {
                    setConnection("REALTIME ERROR", true);
                }
            });
    }

    form.addEventListener("submit", uploadPhoto);

    await loadGallery();
    subscribeToGallery();

    window.addEventListener("beforeunload", () => {
        if (galleryChannel) {
            supabaseClient.removeChannel(galleryChannel);
        }
    });

})();
