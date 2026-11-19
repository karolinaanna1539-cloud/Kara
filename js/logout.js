
(function () {
    async function initializeLogout() {
        if (!window.archiveAuthReady) return;

        const session = await window.archiveAuthReady;
        if (!session || !window.archiveSupabase) return;

        let logoutButton = document.getElementById("logoutButton");

        if (!logoutButton) {
            logoutButton = document.createElement("button");
            logoutButton.id = "logoutButton";
            logoutButton.type = "button";
            logoutButton.textContent = "LOG OUT";
            logoutButton.className = "den-global-logout";

            document.body.appendChild(logoutButton);
        }

        if (logoutButton.dataset.logoutReady === "true") return;
        logoutButton.dataset.logoutReady = "true";

        logoutButton.addEventListener("click", async function () {
            logoutButton.disabled = true;
            logoutButton.textContent = "LOGGING OUT...";

            const { error } = await window.archiveSupabase.auth.signOut();

            if (error) {
                logoutButton.disabled = false;
                logoutButton.textContent = "LOG OUT";
                alert("Logout failed: " + error.message);
                return;
            }

            window.location.replace("index.html");
        });
    }

    initializeLogout().catch(console.error);
})();
