// Generates the GoBert-branded auth email templates (French first, English below).
//   node supabase/templates/build.cjs
// Supabase fills in {{ .ConfirmationURL }}, {{ .Token }}, {{ .Email }}, {{ .NewEmail }}.
const fs = require("fs");
const path = require("path");

const LOGO = "https://gobert-lyart.vercel.app/brand/logo-full.png";
const SITE = "https://gobert-lyart.vercel.app";
const GREEN = "#087C55";
const FOREST = "#123D32";
const ORANGE = "#F28C28";
const IVORY = "#F6F4EE";

function layout({ preheader, fr, en, button, url, showCode }) {
  const btn = url
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:28px auto 8px">
        <tr><td style="border-radius:14px;background:${ORANGE}">
          <a href="${url}" target="_blank" style="display:inline-block;padding:15px 30px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:14px">${button}</a>
        </td></tr>
      </table>`
    : "";
  const code = showCode
    ? `<p style="margin:22px 0 6px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#6b7280">Code / Code</p>
       <p style="margin:0;text-align:center;font-family:'Courier New',monospace;font-size:30px;letter-spacing:8px;font-weight:bold;color:${FOREST}">{{ .Token }}</p>`
    : "";
  const fallback = url
    ? `<p style="margin:22px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#6b7280">
        Le bouton ne marche pas ? Copiez ce lien · Button not working? Copy this link:<br>
        <a href="${url}" style="color:${GREEN};word-break:break-all">${url}</a>
      </p>`
    : "";
  const block = (lang, t) => `
      <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:${GREEN}">${lang}</p>
      <h1 style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:22px;line-height:28px;color:${FOREST}">${t.title}</h1>
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:23px;color:#374151">${t.body}</p>`;

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>GoBert</title>
</head>
<body style="margin:0;padding:0;background:${IVORY}">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${IVORY}">
    <tr><td align="center" style="padding:28px 14px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px">
        <tr><td style="padding:0 6px 18px">
          <a href="${SITE}" target="_blank"><img src="${LOGO}" alt="GoBert" width="150" style="display:block;border:0;height:auto;width:150px"></a>
        </td></tr>
        <tr><td style="background:#ffffff;border-radius:22px;border:1px solid #e5e7eb;overflow:hidden">
          <div style="height:6px;background:${GREEN};background-image:linear-gradient(90deg,${GREEN},${FOREST})"></div>
          <div style="padding:30px 28px 28px">
            ${block("Français", fr)}
            ${btn}
            ${code}
            <hr style="border:0;border-top:1px solid #eef0f2;margin:28px 0">
            ${block("English", en)}
            ${fallback}
          </div>
        </td></tr>
        <tr><td style="padding:20px 8px 0;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#6b7280">
          <strong style="color:${FOREST}">GoBert</strong> — Move. Connect. Go. · Bertoua, Cameroun<br>
          Vous n'êtes pas à l'origine de cette demande ? Ignorez simplement cet e-mail.<br>
          Didn't request this? You can safely ignore this email.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`;
}

const T = {
  confirmation: {
    subject: "Confirmez votre compte GoBert · Confirm your GoBert account",
    preheader: "Un clic pour activer votre compte GoBert.",
    button: "Confirmer mon e-mail · Confirm",
    url: "{{ .ConfirmationURL }}",
    fr: { title: "Bienvenue sur GoBert !", body: "Merci de vous être inscrit. Confirmez votre adresse e-mail pour activer votre compte et réserver vos courses, livraisons et locations à Bertoua." },
    en: { title: "Welcome to GoBert!", body: "Thanks for signing up. Confirm your email address to activate your account and book rides, deliveries and rentals in Bertoua." },
  },
  magic_link: {
    subject: "Votre lien de connexion GoBert · Your GoBert sign-in link",
    preheader: "Connectez-vous à GoBert en un clic.",
    button: "Me connecter · Sign in",
    url: "{{ .ConfirmationURL }}",
    showCode: true,
    fr: { title: "Connexion à GoBert", body: "Cliquez sur le bouton pour vous connecter, ou saisissez le code ci-dessous. Ce lien expire bientôt et ne fonctionne qu'une fois." },
    en: { title: "Sign in to GoBert", body: "Click the button to sign in, or enter the code above. This link expires soon and works only once." },
  },
  recovery: {
    subject: "Réinitialisez votre mot de passe GoBert · Reset your GoBert password",
    preheader: "Choisissez un nouveau mot de passe GoBert.",
    button: "Nouveau mot de passe · New password",
    url: "{{ .ConfirmationURL }}",
    fr: { title: "Mot de passe oublié ?", body: "Nous avons reçu une demande de réinitialisation pour votre compte GoBert. Cliquez sur le bouton pour choisir un nouveau mot de passe." },
    en: { title: "Forgot your password?", body: "We received a request to reset the password of your GoBert account. Click the button to choose a new password." },
  },
  email_change: {
    subject: "Confirmez votre nouvelle adresse · Confirm your new email",
    preheader: "Confirmez le changement d'adresse e-mail de votre compte GoBert.",
    button: "Confirmer · Confirm",
    url: "{{ .ConfirmationURL }}",
    fr: { title: "Changement d'adresse e-mail", body: "Confirmez le passage de {{ .Email }} à {{ .NewEmail }} pour votre compte GoBert." },
    en: { title: "Email address change", body: "Confirm the change from {{ .Email }} to {{ .NewEmail }} for your GoBert account." },
  },
  invite: {
    subject: "Vous êtes invité sur GoBert · You're invited to GoBert",
    preheader: "Rejoignez GoBert.",
    button: "Accepter l'invitation · Accept",
    url: "{{ .ConfirmationURL }}",
    fr: { title: "Vous êtes invité", body: "Un administrateur GoBert vous a invité à créer votre compte. Cliquez sur le bouton pour l'activer." },
    en: { title: "You're invited", body: "A GoBert administrator invited you to create your account. Click the button to activate it." },
  },
  reauthentication: {
    subject: "Votre code de sécurité GoBert · Your GoBert security code",
    preheader: "Votre code de vérification GoBert.",
    showCode: true,
    fr: { title: "Code de vérification", body: "Saisissez ce code pour confirmer une opération sensible sur votre compte GoBert. Il expire dans quelques minutes." },
    en: { title: "Verification code", body: "Enter this code to confirm a sensitive action on your GoBert account. It expires in a few minutes." },
  },
};

for (const [name, t] of Object.entries(T)) {
  fs.writeFileSync(path.join(__dirname, `${name}.html`), layout(t));
}
fs.writeFileSync(
  path.join(__dirname, "subjects.json"),
  JSON.stringify(Object.fromEntries(Object.entries(T).map(([k, v]) => [k, v.subject])), null, 2) + "\n",
);
console.log("wrote", Object.keys(T).join(", "));
