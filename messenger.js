
/* =========================================
   KAROLINA ARCHIVE — MESSENGER
   Shared chat + Supabase Realtime
========================================= */

(async function () {
    "use strict";

    const db = window.archiveSupabase;
    const session = await window.archiveAuthReady;

    if (!session || !db) return;

    const user = session.user;

    const el = {
        connection: document.getElementById("chatConnection"),
        nicknamePanel: document.getElementById("nicknamePanel"),
        nicknameForm: document.getElementById("nicknameForm"),
        nicknameInput: document.getElementById("nicknameInput"),
        nicknameSave: document.getElementById("nicknameSave"),
        nicknameMessage: document.getElementById("nicknameMessage"),
        chatPanel: document.getElementById("chatPanel"),
        currentNickname: document.getElementById("currentNickname"),
        messages: document.getElementById("chatMessages"),
        form: document.getElementById("chatForm"),
        input: document.getElementById("chatInput"),
        send: document.getElementById("chatSend"),
        status: document.getElementById("chatMessageStatus"),
        logout: document.getElementById("chatLogout")
    };

    let profile = null;
    let channel = null;
    let loading = false;

    function connection(text, error = false) {
        el.connection.textContent = text;
        el.connection.classList.toggle("error", error);
    }

    function showNicknameMessage(text, error = false) {
        el.nicknameMessage.textContent = text;
        el.nicknameMessage.classList.toggle("error", error);
    }

    function formatTime(date) {
        return new Date(date).toLocaleString("sv-SE", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    async function loadProfile() {
        const { data, error } = await db
            .from("chat_profiles")
            .select("user_id, nickname")
            .eq("user_id", user.id)
            .maybeSingle();

        if (error) throw error;

        profile = data;

        if (!profile) {
            el.nicknamePanel.hidden = false;
            el.chatPanel.hidden = true;
            connection("WAITING FOR USER IDENTIFICATION");
            return false;
        }

        el.nicknamePanel.hidden = true;
        el.chatPanel.hidden = false;
        el.currentNickname.textContent = profile.nickname;

        return true;
    }

    async function saveNickname(event) {
        event.preventDefault();

        const nickname = el.nicknameInput.value.trim();

        if (!/^[A-Za-z0-9_]{3,20}$/.test(nickname)) {
            showNicknameMessage(
                "Use 3–20 letters, numbers or underscores.",
                true
            );
            return;
        }

        el.nicknameSave.disabled = true;
        showNicknameMessage("SAVING...");

        try {
            const { data, error } = await db
                .from("chat_profiles")
                .insert({
                    user_id: user.id,
                    nickname: nickname
                })
                .select("user_id, nickname")
                .single();

            if (error) throw error;

            profile = data;
            el.nicknamePanel.hidden = true;
            el.chatPanel.hidden = false;
            el.currentNickname.textContent = profile.nickname;

            await loadMessages();
            subscribeToMessages();

        } catch (error) {
            console.error("Nickname error:", error);

            if (error.code === "23505") {
                showNicknameMessage(
                    "This nickname is already taken. Choose another.",
                    true
                );
            } else {
                showNicknameMessage(
                    error.message || "Could not save nickname.",
                    true
                );
            }

        } finally {
            el.nicknameSave.disabled = false;
        }
    }

    function createMessage(message) {
        const own = message.user_id === user.id;

        const row = document.createElement("div");
        row.className = own
            ? "messenger-message-row own-message"
            : "messenger-message-row";

        const bubble = document.createElement("article");
        bubble.className = "messenger-bubble";

        const header = document.createElement("div");
        header.className = "messenger-message-header";

        const nickname = document.createElement("strong");
        nickname.textContent =
            message.chat_profiles?.nickname || "Unknown user";

        const time = document.createElement("span");
        time.textContent = formatTime(message.created_at);

        header.append(nickname, time);

        const content = document.createElement("p");
        content.textContent = message.content;

        bubble.append(header, content);
        row.appendChild(bubble);

        return row;
    }

    async function loadMessages() {
        if (loading) return;

        loading = true;

        try {
            const { data, error } = await db
                .from("chat_messages")
                .select(`
                    id,
                    user_id,
                    content,
                    created_at,
                    chat_profiles(nickname)
                `)
                .order("created_at", { ascending: false })
                .limit(100);

            if (error) throw error;

            el.messages.replaceChildren();

            const messages = (data || []).reverse();

            if (messages.length === 0) {
                const empty = document.createElement("p");
                empty.className = "inventory-empty";
                empty.textContent = "NO MESSAGES YET. START THE CONVERSATION.";
                el.messages.appendChild(empty);
            } else {
                messages.forEach(message => {
                    el.messages.appendChild(createMessage(message));
                });
            }

            el.messages.scrollTop = el.messages.scrollHeight;

        } catch (error) {
            console.error("Message loading error:", error);
            el.messages.textContent = "COULD NOT LOAD MESSAGES.";
            connection("DATABASE ERROR", true);

        } finally {
            loading = false;
        }
    }

    async function sendMessage(event) {
        event.preventDefault();

        const content = el.input.value.trim();

        if (!content || !profile) return;

        el.send.disabled = true;

        try {
            const { error } = await db
                .from("chat_messages")
                .insert({
                    user_id: user.id,
                    content: content
                });

            if (error) throw error;

            el.input.value = "";
            el.status.textContent = "MESSAGE SENT.";

            await loadMessages();

        } catch (error) {
            console.error("Message sending error:", error);
            el.status.textContent =
                "MESSAGE ERROR: " + error.message;

        } finally {
            el.send.disabled = false;
            el.input.focus();
        }
    }

    function subscribeToMessages() {
        if (channel) return;

        channel = db
            .channel("karolina-archive-general-chat")
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "chat_messages"
                },
                async () => {
                    await loadMessages();
                }
            )
            .subscribe(status => {
                if (status === "SUBSCRIBED") {
                    connection("DATABASE ONLINE // LIVE CHAT ACTIVE");
                }

                if (status === "CHANNEL_ERROR") {
                    connection("REALTIME CONNECTION ERROR", true);
                }

                if (status === "CLOSED") {
                    connection("CHAT CONNECTION CLOSED", true);
                }
            });
    }

    el.nicknameForm.addEventListener("submit", saveNickname);
    el.form.addEventListener("submit", sendMessage);

    el.input.addEventListener("keydown", event => {
        if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.isComposing
        ) {
            event.preventDefault();
            el.form.requestSubmit();
        }
    });

    el.logout.addEventListener("click", async () => {
        const { error } = await db.auth.signOut();

        if (error) {
            window.alert("Could not log out: " + error.message);
            return;
        }

        window.location.replace("index.html");
    });

    try {
        const hasProfile = await loadProfile();

        if (hasProfile) {
            await loadMessages();
            subscribeToMessages();
        }
    } catch (error) {
        console.error("Messenger initialization error:", error);
        connection("INITIALIZATION ERROR", true);
    }

    window.addEventListener("beforeunload", () => {
        if (channel) {
            db.removeChannel(channel);
        }
    });

})();
