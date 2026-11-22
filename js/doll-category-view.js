
/* =====================================================
   THE DEN
   DOLL CATEGORY FULL VIEW NAVIGATION
===================================================== */

(function () {
    "use strict";

    const profileContent = document.getElementById("profileContent");

    if (!profileContent) return;

    const categories = [
        "clothing",
        "makeup",
        "hairstyle",
        "nails",
        "accessories"
    ];

    function closeCategoryView() {
        categories.forEach(category => {
            const section = document.getElementById(category);

            if (section) {
                section.hidden = true;
                section.classList.remove("active-category-view");
            }
        });

        profileContent.classList.remove("category-view-active");

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }

    function openCategoryView(category, addHistory = true) {
        if (!categories.includes(category)) return;

        const section = document.getElementById(category);

        if (!section) return;

        categories.forEach(item => {
            const categorySection = document.getElementById(item);

            if (categorySection) {
                categorySection.hidden = true;
                categorySection.classList.remove("active-category-view");
            }
        });

        section.hidden = false;
        section.classList.add("active-category-view");

        profileContent.classList.add("category-view-active");

        if (addHistory) {
            history.pushState(
                {
                    theDenCategoryView: true,
                    category: category
                },
                "",
                "#" + category + "-gallery"
            );
        }

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }

    // Open category gallery
    profileContent.addEventListener("click", function (event) {
        const categoryButton = event.target.closest("[data-open-category]");

        if (categoryButton) {
            const category = categoryButton.dataset.openCategory;
            openCategoryView(category);
            return;
        }

        // Return to doll profile
        const backButton = event.target.closest(".category-back-button");

        if (backButton) {
            if (history.state?.theDenCategoryView) {
                history.back();
            } else {
                closeCategoryView();
            }
        }
    });

    // Browser back / forward navigation
    window.addEventListener("popstate", function (event) {
        if (event.state?.theDenCategoryView) {
            openCategoryView(event.state.category, false);
        } else {
            closeCategoryView();
        }
    });

})();
