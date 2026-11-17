
/* KAROLINA ARCHIVE — ACTIVE USERS / PRESENCE */

(async function () {
    "use strict";

    const supabaseClient = window.archiveSupabase;
    const session = await window.archiveAuthReady;

    if (!session || !supabaseClient) return;

    const usersContainer = document.getElementById("activeUsers");
    const onlineCount = document.getElementById("onlineCount");
    const connection = document.getElementById("presenceConnection");

    if (!usersContainer || !onlineCount) return;

    let presenceChannel = null;

    function getDisplayName(user) {
        const metadata = user.user_metadata || {};

        return (
            metadata.nickname ||
            metadata.full_name ||
            metadata.name ||
            metadata.display_name ||
            "USER-" + String(user.user_id || "").slice(0, 6).toUpperCase()
        );
    }

    function renderUsers() {
        if (!presenceChannel) return;

        const state = presenceChannel.presenceState();
        const usersById = new Map();

        Object.values(state).forEach(entries => {
            entries.forEach(entry => {
                if (entry.user_id) {
                    usersById.set(entry.user_id, entry);
                }
            });
        });

        const users = Array.from(usersById.values());

        users.sort((a, b) =>
            getDisplayName(a).localeCompare(getDisplayName(b))
        );

        onlineCount.textContent = users.length + " ONLINE";
        usersContainer.replaceChildren();

        if (users.length === 0) {
            const empty = document.createElement("p");
            empty.className = "homepage-loading";
            empty.textContent = "NO ACTIVE USERS DETECTED.";
            usersContainer.appendChild(empty);
            return;
        }

        users.forEach(user => {
            const row = document.createElement("div");
            row.className = "active-user-row";

            const indicator = document.createElement("span");
            indicator.className = "active-user-indicator";

            const name = document.createElement("span");
            name.className = "active-user-name";
            name.textContent = getDisplayName(user);

            const status = document.createElement("span");
            status.className = "active-user-status";
            status.textContent = "ONLINE";

            row.append(indicator, name, status);
            usersContainer.appendChild(row);
        });
    }

    presenceChannel = supabaseClient.channel("archive-active-users", {
        config: {
            presence: {
                key: session.user.id
            }
        }
    });

    presenceChannel
        .on("presence", { event: "sync" }, renderUsers)
        .subscribe(async status => {
            if (status === "SUBSCRIBED") {
                if (connection) {
                    connection.textContent = "ONLINE";
                    connection.classList.remove("error");
                }

                const metadata = session.user.user_metadata || {};

                await presenceChannel.track({
                    user_id: session.user.id,
                    nickname:
                        metadata.nickname ||
                        metadata.full_name ||
                        metadata.name ||
                        metadata.display_name ||
                        "",
                    online_at: new Date().toISOString()
                });

                renderUsers();
            }

            if (
                status === "CHANNEL_ERROR" ||
                status === "TIMED_OUT"
            ) {
                if (connection) {
                    connection.textContent = "CONNECTION ERROR";
                    connection.classList.add("error");
                }
            }
        });

    window.addEventListener("beforeunload", () => {
        if (presenceChannel) {
            supabaseClient.removeChannel(presenceChannel);
        }
    });

})();
