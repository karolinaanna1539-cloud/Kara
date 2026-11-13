
let isLoggingIn = false;

function login() {

    if (isLoggingIn) return;

    const password = document.getElementById("password").value;
    const message = document.getElementById("message");
    const button = document.querySelector(".authenticate-button");

    // ACCESS DENIED

    if (password !== "KARA2026") {

        message.innerHTML = `
            <div class="login-error">
                <p>⚠ ACCESS DENIED</p>
                <p>INVALID ACCESS CODE</p>
            </div>
        `;

        document.getElementById("password").value = "";

        return;
    }

    // ACCESS GRANTED

    isLoggingIn = true;

    button.disabled = true;
    button.style.opacity = "0.5";
    button.style.cursor = "not-allowed";

    message.innerHTML = `
        <div class="loading">

            <p class="online">ACCESS GRANTED</p>

            <p id="loadingText">
                VERIFYING IDENTITY...
            </p>

            <div class="bar">
                <div class="progress"></div>
            </div>

            <p id="progressText">0%</p>

        </div>
    `;

    const steps = [
        "VERIFYING IDENTITY...",
        "LOADING PERSONAL DATABASE...",
        "IDENTITY CHECK....... OK",
        "PROFILE FILE........ ONLINE",
        "VISUAL ARCHIVE...... UNLOCKED",
        "DATABASE ACCESS..... COMPLETE"
    ];

    const loadingText = document.getElementById("loadingText");
    const progressText = document.getElementById("progressText");

    let progress = 0;

    const interval = setInterval(() => {

        progress += 2;

        const bar = document.querySelector(".progress");

        if (bar) {
            bar.style.width = progress + "%";
        }

        if (progressText) {
            progressText.textContent = progress + "%";
        }

        const stepIndex = Math.min(
            Math.floor(progress / 20),
            steps.length - 1
        );

        if (loadingText) {
            loadingText.textContent = steps[stepIndex];
        }

        if (progress >= 100) {

            clearInterval(interval);

            setTimeout(() => {

                window.location.href = "archive.html";

            }, 1000);

        }

    }, 100);

}
