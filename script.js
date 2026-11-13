
/* ==================================================
   KAROLINA ARCHIVE
   SUPABASE AUTHENTICATION SYSTEM
================================================== */

// SUPABASE CONFIGURATION

const SUPABASE_URL =
    "https://lgfvvxjevlwtthtazsll.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_tLcnBvmy9Ixd_bA77DfhDA_4jNESB_c";


// CREATE SUPABASE CLIENT

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


// LOGIN STATE

let isLoggingIn = false;


// ==================================================
// LOGIN FUNCTION
// ==================================================

async function login(event) {

    if (event) {
        event.preventDefault();
    }

    if (isLoggingIn) return;

    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const message = document.getElementById("message");

    const button = document.querySelector(
        ".authenticate-button"
    );

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    // CHECK EMPTY FIELDS

    if (!email || !password) {

        message.textContent =
            "EMAIL AND PASSWORD REQUIRED";

        return;
    }


    // START LOGIN

    isLoggingIn = true;

    button.disabled = true;
    button.style.opacity = "0.5";
    button.style.cursor = "not-allowed";

    message.textContent = "CONNECTING TO DATABASE...";


    // AUTHENTICATE WITH SUPABASE

    let data;
    let error;

    try {

        const result =
            await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

        data = result.data;
        error = result.error;

    } catch (connectionError) {

        error = connectionError;

    }


    // ACCESS DENIED

    if (error || !data?.session) {

        message.replaceChildren();

        const errorBox = document.createElement("div");
        errorBox.className = "login-error";

        const errorTitle = document.createElement("p");
        errorTitle.textContent = "⚠ ACCESS DENIED";

        const errorDescription = document.createElement("p");
        errorDescription.textContent =
            "INVALID CREDENTIALS OR CONNECTION ERROR";

        errorBox.append(
            errorTitle,
            errorDescription
        );

        message.appendChild(errorBox);

        passwordInput.value = "";

        button.disabled = false;
        button.style.opacity = "1";
        button.style.cursor = "pointer";

        isLoggingIn = false;

        return;
    }


    // ACCESS GRANTED

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


    // LOADING SEQUENCE

    const steps = [
        "VERIFYING IDENTITY...",
        "CONNECTING TO SUPABASE...",
        "LOADING PERSONAL DATABASE...",
        "IDENTITY CHECK....... OK",
        "PROFILE FILE........ ONLINE",
        "VISUAL ARCHIVE...... UNLOCKED",
        "DATABASE ACCESS..... COMPLETE"
    ];


    const loadingText =
        document.getElementById("loadingText");

    const progressText =
        document.getElementById("progressText");

    const progressBar =
        document.querySelector(".progress");


    let progress = 0;

    const interval = setInterval(() => {

        progress += 2;

        if (progressBar) {
            progressBar.style.width =
                progress + "%";
        }

        if (progressText) {
            progressText.textContent =
                progress + "%";
        }

        const stepIndex = Math.min(
            Math.floor(progress / (100 / steps.length)),
            steps.length - 1
        );

        if (loadingText) {
            loadingText.textContent =
                steps[stepIndex];
        }


        // LOGIN COMPLETE

        if (progress >= 100) {

            clearInterval(interval);

            setTimeout(() => {

                window.location.href =
                    "archive.html";

            }, 700);

        }

    }, 45);

}


// ==================================================
// CHECK EXISTING SESSION
// ==================================================

async function checkExistingSession() {

    try {

        const {
            data: { session },
            error
        } = await supabaseClient.auth.getSession();

        if (error) {
            console.error(
                "SESSION ERROR:",
                error.message
            );
            return;
        }

        // Existing user goes directly to archive

        if (session) {

            window.location.replace(
                "archive.html"
            );

        }

    } catch (error) {

        console.error(
            "SUPABASE CONNECTION ERROR:",
            error
        );

    }

}


// ==================================================
// INITIALIZE LOGIN PAGE
// ==================================================

document.addEventListener("DOMContentLoaded", () => {

    const loginForm =
        document.getElementById("loginForm");

    const passwordInput =
        document.getElementById("password");

    if (loginForm) {

        loginForm.addEventListener(
            "submit",
            login
        );

    }

    if (passwordInput) {

        passwordInput.addEventListener(
            "keydown",
            event => {

                if (event.key === "Enter") {

                    event.preventDefault();

                    login();

                }

            }
        );

    }

    checkExistingSession();

});
