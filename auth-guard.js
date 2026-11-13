
/* KAROLINA ARCHIVE - PAGE PROTECTION */

const ARCHIVE_URL =
    "https://lgfvvxjevlwtthtazsll.supabase.co";

const ARCHIVE_KEY =
    "sb_publishable_tLcnBvmy9Ixd_bA77DfhDA_4jNESB_c";

window.archiveSupabase = window.supabase.createClient(
    ARCHIVE_URL,
    ARCHIVE_KEY
);

window.archiveAuthReady = (async () => {

    const {
        data: { session },
        error
    } = await window.archiveSupabase.auth.getSession();

    if (error || !session) {
        window.location.replace("index.html");
        return null;
    }

    document.body.classList.remove("protected-page");

    return session;

})();
