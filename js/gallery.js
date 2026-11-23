
/* =====================================================
   THE DEN — COMMUNITY GALLERY
   IMAGE + VIDEO UPLOAD
===================================================== */

(async function () {
    "use strict";

    const supabaseClient = window.archiveSupabase;
    const session = await window.archiveAuthReady;

    if (!session || !supabaseClient) return;

    const user = session.user;

    const BUCKET = "community-gallery";
    const MAX_FILE_SIZE = 50 * 1024 * 1024;

    const form = document.getElementById("galleryForm");
    const imageInput = document.getElementById("galleryImage");
    const captionInput = document.getElementById("galleryCaption");
    const uploadButton = document.getElementById("galleryUploadButton");
    const message = document.getElementById("galleryMessage");
    const grid = document.getElementById("galleryGrid");
    const count = document.getElementById("galleryCount");
    const connection = document.getElementById("galleryConnection");

    if (
        !form ||
        !imageInput ||
        !captionInput ||
        !uploadButton ||
        !message ||
        !grid ||
        !count
    ) {
        console.error("Gallery HTML elements are missing.");
        return;
    }

    let galleryChannel = null;
    let photos = [];
    let isUploading = false;
    let lastFocusedImage = null;

    /* =========================================
       LIGHTBOX — IMAGE PREVIEW
    ========================================= */

    function createLightbox() {
        const style = document.createElement("style");

        style.textContent = `
            .gallery-lightbox {
                position: fixed;
                inset: 0;
                z-index: 99999;
                display: none;
                align-items: center;
                justify-content: center;
                padding: 30px;
                background: rgba(0, 0, 0, 0.94);
                backdrop-filter: blur(8px);
                cursor: zoom-out;
            }

            .gallery-lightbox.active {
                display: flex;
            }

            .gallery-lightbox-image {
                display: block;
                max-width: 95vw;
                max-height: 90vh;
                width: auto;
                height: auto;
                object-fit: contain;
                border: 1px solid rgba(0, 255, 120, 0.45);
                box-shadow: 0 0 35px rgba(0, 255, 120, 0.12);
                cursor: default;
            }

            .gallery-lightbox-close {
                position: absolute;
                top: 18px;
                right: 25px;
                width: 48px;
                height: 48px;
                border: 1px solid rgba(0, 255, 120, 0.6);
                background: rgba(0, 0, 0, 0.7);
                color: #00ff88;
                font-size: 32px;
                line-height: 1;
                cursor: pointer;
                transition: 0.2s;
            }

            .gallery-lightbox-close:hover {
                background: #00ff88;
                color: #000;
            }

            .gallery-photo-image {
                cursor: zoom-in;
                transition: transform 0.25s, opacity 0.25s;
            }

            .gallery-photo-image:hover {
                opacity: 0.85;
            }

            .gallery-video-player {
                display: block;
                width: 100%;
                max-height: 420px;
                aspect-ratio: 16 / 9;
                object-fit: contain;
                background: #050805;
                border: 1px solid rgba(0, 255, 120, 0.18);
            }

            .gallery-media-type {
                display: inline-block;
                margin-bottom: 8px;
                padding: 4px 8px;
                border: 1px solid rgba(0, 255, 120, 0.3);
                color: #00ff88;
                font-size: 10px;
                letter-spacing: 1px;
            }

            .gallery-image-error {
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 180px;
                padding: 20px;
                color: #ff7777;
                background: rgba(255, 0, 0, 0.05);
                text-align: center;
            }

            @media (max-width: 600px) {
                .gallery-lightbox {
                    padding: 12px;
                }

                .gallery-lightbox-image {
                    max-width: 96vw;
                    max-height: 85vh;
                }

                .gallery-lightbox-close {
                    top: 10px;
                    right: 10px;
                    width: 42px;
                    height: 42px;
                }
            }
        `;

        document.head.appendChild(style);

        const overlay = makeElement("div", "gallery-lightbox");

        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.setAttribute("aria-label", "Image preview");

        const closeButton = makeElement(
            "button",
            "gallery-lightbox-close",
            "×"
        );

        closeButton.type = "button";
        closeButton.setAttribute("aria-label", "Close image preview");

        const previewImage = document.createElement("img");

        previewImage.className = "gallery-lightbox-image";
        previewImage.alt = "";

        overlay.appendChild(closeButton);
        overlay.appendChild(previewImage);
        document.body.appendChild(overlay);

        function closeLightbox() {
            overlay.classList.remove("active");
            previewImage.removeAttribute("src");
            document.body.style.overflow = "";

            if (lastFocusedImage) {
                lastFocusedImage.focus();
                lastFocusedImage = null;
            }
        }

        function openLightbox(image) {
            lastFocusedImage = image;

            previewImage.src = image.src;
            previewImage.alt = image.alt || "Community photo";

            overlay.classList.add("active");
            document.body.style.overflow = "hidden";

            closeButton.focus();
        }

        closeButton.addEventListener("click", closeLightbox);

        overlay.addEventListener("click", function (event) {
            if (
                event.target === overlay ||
                event.target === closeButton
            ) {
                closeLightbox();
            }
        });

        previewImage.addEventListener("click", function (event) {
            event.stopPropagation();
        });

        document.addEventListener("keydown", function (event) {
            if (
                event.key === "Escape" &&
                overlay.classList.contains("active")
            ) {
                closeLightbox();
            }
        });

        return openLightbox;
    }

    const openLightbox = createLightbox();

    /* =========================================
       GENERAL FUNCTIONS
    ========================================= */

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

    function isVideo(path) {
        return /\.(mp4|webm)$/i.test(path || "");
    }

    function getMediaType(file) {
        if (file.type.startsWith("video/")) return "video";
        if (file.type.startsWith("image/")) return "image";
        return null;
    }

    async function getMediaUrl(path) {
        const { data, error } = await supabaseClient.storage
            .from(BUCKET)
            .createSignedUrl(path, 3600);

        if (error) {
            console.error("Gallery media URL error:", error);
            return null;
        }

        return data.signedUrl;
    }

    /* =========================================
       LOAD GALLERY
    ========================================= */

    async function loadGallery() {
        setConnection("LOADING...");

        const { data, error } = await supabaseClient
            .from("gallery_photos")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Gallery load error:", error);

            grid.textContent = "COULD NOT LOAD GALLERY: " + error.message;

            setConnection("DATABASE ERROR", true);
            return;
        }

        photos = data || [];

        await renderGallery();

        setConnection("ONLINE");
    }

    /* =========================================
       RENDER GALLERY
    ========================================= */

    async function renderGallery() {
        grid.replaceChildren();

        count.textContent = photos.length + " FILES";

        if (photos.length === 0) {
            grid.appendChild(
                makeElement(
                    "p",
                    "homepage-loading",
                    "NO MEDIA YET. BE THE FIRST TO UPLOAD."
                )
            );

            return;
        }

        for (const photo of photos) {
            const card = makeElement("article", "gallery-photo-card");

            const mediaUrl = await getMediaUrl(photo.image_path);
            const videoFile = isVideo(photo.image_path);

            if (mediaUrl && videoFile) {
                const video = document.createElement("video");

                video.className = "gallery-video-player";
                video.src = mediaUrl;
                video.controls = true;
                video.preload = "metadata";
                video.playsInline = true;
                video.setAttribute("controlsList", "nodownload");

                video.setAttribute(
                    "aria-label",
                    photo.caption || "Community video"
                );

                card.appendChild(video);

                card.appendChild(
                    makeElement(
                        "span",
                        "gallery-media-type",
                        "VIDEO"
                    )
                );

            } else if (mediaUrl) {
                const image = document.createElement("img");

                image.src = mediaUrl;
                image.alt = photo.caption || "Community photo";
                image.loading = "lazy";
                image.className = "gallery-photo-image";
                image.tabIndex = 0;

                image.setAttribute("role", "button");
                image.setAttribute("aria-label", "Enlarge image");

                image.addEventListener("click", function () {
                    openLightbox(image);
                });

                image.addEventListener("keydown", function (event) {
                    if (
                        event.key === "Enter" ||
                        event.key === " "
                    ) {
                        event.preventDefault();
                        openLightbox(image);
                    }
                });

                card.appendChild(image);

                card.appendChild(
                    makeElement(
                        "span",
                        "gallery-media-type",
                        "IMAGE"
                    )
                );

            } else {
                card.appendChild(
                    makeElement(
                        "div",
                        "gallery-image-error",
                        "MEDIA UNAVAILABLE"
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
                    makeElement(
                        "p",
                        "gallery-photo-caption",
                        photo.caption
                    )
                );
            }

            details.appendChild(
                makeElement(
                    "span",
                    "gallery-photo-date",
                    new Date(photo.created_at).toLocaleString()
                )
            );

            if (photo.user_id === user.id) {
                const deleteButton = makeElement(
                    "button",
                    "gallery-delete-button",
                    "DELETE MY UPLOAD"
                );

                deleteButton.type = "button";

                deleteButton.addEventListener("click", function () {
                    deletePhoto(photo);
                });

                details.appendChild(deleteButton);
            }

            card.appendChild(details);
            grid.appendChild(card);
        }
    }

    /* =========================================
       UPLOAD IMAGE OR VIDEO
    ========================================= */

    async function uploadPhoto(event) {
        event.preventDefault();

        if (isUploading) return;

        const file = imageInput.files[0];
        const caption = captionInput.value.trim();

        if (!file) {
            setMessage("PLEASE SELECT AN IMAGE OR VIDEO.", true);
            return;
        }

        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
            "video/mp4",
            "video/webm"
        ];

        if (!allowedTypes.includes(file.type)) {
            setMessage("UNSUPPORTED FILE FORMAT.", true);
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            setMessage("FILE IS LARGER THAN 50 MB.", true);
            return;
        }

        const mediaType = getMediaType(file);

        if (!mediaType) {
            setMessage("UNSUPPORTED MEDIA TYPE.", true);
            return;
        }

        isUploading = true;

        uploadButton.disabled = true;
        uploadButton.textContent = "UPLOADING...";

        setMessage("UPLOADING " + mediaType.toUpperCase() + "...");

        const safeName = file.name
            .toLowerCase()
            .replace(/[^a-z0-9._-]/g, "-");

        const mediaPath =
            user.id + "/" + crypto.randomUUID() + "-" + safeName;

        try {
            const { error: uploadError } = await supabaseClient.storage
                .from(BUCKET)
                .upload(mediaPath, file, {
                    cacheControl: "3600",
                    upsert: false,
                    contentType: file.type
                });

            if (uploadError) {
                throw uploadError;
            }

            const { error: insertError } = await supabaseClient
                .from("gallery_photos")
                .insert({
                    user_id: user.id,
                    image_path: mediaPath,
                    caption: caption || null
                });

            if (insertError) {
                await supabaseClient.storage
                    .from(BUCKET)
                    .remove([mediaPath]);

                throw insertError;
            }

            form.reset();

            setMessage(
                mediaType.toUpperCase() + " UPLOADED SUCCESSFULLY."
            );

            await loadGallery();

        } catch (error) {
            console.error("Gallery upload error:", error);

            setMessage(
                "UPLOAD ERROR: " + (error.message || "UNKNOWN ERROR"),
                true
            );

        } finally {
            isUploading = false;

            uploadButton.disabled = false;
            uploadButton.textContent = "UPLOAD MEDIA";
        }
    }

    /* =========================================
       DELETE IMAGE OR VIDEO
    ========================================= */

    async function deletePhoto(photo) {
        if (photo.user_id !== user.id) {
            setMessage("YOU CAN DELETE ONLY YOUR OWN UPLOADS.", true);
            return;
        }

        const confirmed = window.confirm(
            "Delete this media permanently?"
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

            setMessage(
                "MEDIA REMOVED FROM DATABASE. STORAGE CLEANUP FAILED.",
                true
            );

        } else {
            setMessage("MEDIA DELETED.");
        }

        await loadGallery();
    }

    /* =========================================
       REALTIME
    ========================================= */

    function subscribeToGallery() {
        galleryChannel = supabaseClient
            .channel("community-gallery-" + user.id)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "gallery_photos"
                },
                function () {
                    loadGallery();
                }
            )
            .subscribe(function (status) {
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

    /* =========================================
       INITIALIZATION
    ========================================= */

    form.addEventListener("submit", uploadPhoto);

    await loadGallery();

    subscribeToGallery();

    window.addEventListener("beforeunload", function () {
        if (galleryChannel) {
            supabaseClient.removeChannel(galleryChannel);
        }
    });

})();
