// ==========================================================================
// SADEX : Site vitrine
// Scripts : menu mobile, ombre de l'en-tête au scroll, formulaire de contact
// ==========================================================================

document.addEventListener("DOMContentLoaded", function () {
  // --- Menu mobile ---
  var toggle = document.querySelector(".nav-toggle");
  var links = document.querySelector(".nav-links");

  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var isOpen = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    links.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        links.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // --- Ombre de l'en-tête au scroll ---
  var header = document.querySelector(".site-header");
  if (header) {
    window.addEventListener("scroll", function () {
      if (window.scrollY > 8) {
        header.style.boxShadow = "0 6px 20px -10px rgba(14,31,61,0.25)";
      } else {
        header.style.boxShadow = "none";
      }
    });
  }

  // --- Formulaire de contact (ouvre WhatsApp avec le message pré-rempli) ---
  var WHATSAPP_NUMBER = "224626432323"; // +224 626 43 23 23

  var form = document.getElementById("contact-form");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var name = form.name.value.trim();
      var email = form.email.value.trim();
      var subject = form.subject.value.trim() || "Nouveau message depuis le site Sadex";
      var message = form.message.value.trim();

      var text =
        "Bonjour Sadex,\n\n" +
        "Sujet : " + subject + "\n" +
        "Nom : " + name + "\n" +
        (email ? "Email : " + email + "\n" : "") +
        "\n" + message;

      var whatsappLink =
        "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(text);

      window.open(whatsappLink, "_blank", "noopener");

      var success = document.getElementById("form-success");
      if (success) {
        success.classList.add("visible");
      }

      form.reset();
    });
  }
});
