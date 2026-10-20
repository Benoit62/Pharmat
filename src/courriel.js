// Courriels : confirmation d'adresse, mot de passe oublié, rappels et bilan du soir.
// Facultatif : sans SMTP_HOST, `actif` est faux et rien n'est envoyé (voir config.js).
// Sur le serveur, le relais de la plateforme (smtp-relay) n'attend aucun identifiant.
import nodemailer from 'nodemailer';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from './config.js';
import { evenement } from './evenement.js';

const c = config.courriel;
export const actif = Boolean(c);

const transport = c
  ? nodemailer.createTransport({
      host: c.host,
      port: c.port,
      secure: c.port === 465,
      auth: c.user ? { user: c.user, pass: c.motDePasse } : undefined,
      // Sans identifiants, c'est le relais interne de la plateforme (smtp-relay:2525, DEC-019) :
      // en clair. Avec identifiants, un fournisseur externe négocie STARTTLS de lui-même.
      ignoreTLS: !c.user,
    })
  : null;

const echapper = (s) =>
  String(s).replace(/[&<>"']/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[x]);

/** Jeton de désinscription des rappels : signé, sans état, propre à chaque compte. */
export function jetonDesinscription(idUtilisateur) {
  return createHmac('sha256', config.secretSession).update(`desinscription:${idUtilisateur}`).digest('base64url').slice(0, 32);
}

export function verifierDesinscription(idUtilisateur, jeton) {
  const attendu = Buffer.from(jetonDesinscription(idUtilisateur));
  const donne = Buffer.from(String(jeton));
  return attendu.length === donne.length && timingSafeEqual(attendu, donne);
}

/**
 * Gabarit commun : un titre, des paragraphes, un bouton. Fond blanc (charte : le corps des
 * courriels reste blanc), couleurs de Pharmat, version texte jointe.
 */
function gabarit({ titre, paragraphes, bouton, pied, origine = config.urlPublique }) {
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#ffffff;font-family:Helvetica,Arial,sans-serif;color:#13241d">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
<tr><td style="padding-bottom:24px"><img src="${origine}/img/logo-courriel.png" width="40" height="40" alt="" style="vertical-align:middle;border-radius:10px"> <span style="font-size:20px;font-weight:bold;vertical-align:middle;padding-left:8px">Pharmat</span></td></tr>
<tr><td style="font-size:22px;line-height:30px;font-weight:bold;padding-bottom:16px">${echapper(titre)}</td></tr>
${paragraphes.map((p) => `<tr><td style="font-size:16px;line-height:25px;padding-bottom:14px;color:#33463d">${echapper(p)}</td></tr>`).join('')}
${bouton ? `<tr><td style="padding:12px 0 24px"><a href="${bouton.url}" style="display:inline-block;background:#127a4a;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:999px">${echapper(bouton.texte)}</a></td></tr>` : ''}
<tr><td style="border-top:1px solid #d3e0d9;padding-top:16px;font-size:13px;line-height:20px;color:#51635b">${pied ?? 'Pharmat — révision des QCM de l’internat de pharmacie.'}</td></tr>
</table></td></tr></table></body></html>`;
  const texte = [titre, '', ...paragraphes, ...(bouton ? ['', `${bouton.texte} : ${bouton.url}`] : [])].join('\n');
  return { html, texte };
}

async function envoyer({ a, sujet, contenu, desinscription }) {
  if (!transport) return false;
  try {
    await transport.sendMail({
      from: `Pharmat <${c.expediteur}>`,
      to: a,
      subject: sujet,
      html: contenu.html,
      text: contenu.texte,
      headers: desinscription
        ? { 'List-Unsubscribe': `<${desinscription}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
        : undefined,
    });
    return true;
  } catch (erreur) {
    console.error('Courriel non envoyé :', erreur.message);
    await evenement('error', 'Envoi de courriel impossible', { sujet, erreur: erreur.message.slice(0, 300) });
    return false;
  }
}

function lienDesinscription(id) {
  return `${config.urlPublique}/desinscription/${id}/${jetonDesinscription(id)}`;
}

function piedRappel(id) {
  return `Tu reçois ce courriel parce que les rappels sont activés sur ton compte Pharmat. <a href="${config.urlPublique}/compte" style="color:#51635b">Régler mes courriels</a> · <a href="${lienDesinscription(id)}" style="color:#51635b">Ne plus rien recevoir</a>`;
}

// Confirmation et réinitialisation : les liens partent de l'adresse où la personne s'est
// inscrite (pharmat. ou pharmat-essai. pendant une répétition). Traefik n'achemine ici que les
// noms déclarés : l'en-tête Host ne peut pas être détourné. Les rappels du soir, sans requête,
// prennent URL_PUBLIQUE.
export const courriels = {
  confirmation: (u, idConfirmation, origine = config.urlPublique) =>
    envoyer({
      a: u.mail,
      sujet: 'Confirme ton adresse',
      contenu: gabarit({
        titre: `Bienvenue sur Pharmat, ${u.name}`,
        paragraphes: ['Un dernier pas avant ta première série : confirme ton adresse en cliquant sur le bouton.', "Si tu n'as pas créé de compte, ignore ce message."],
        bouton: { texte: 'Confirmer mon adresse', url: `${origine}/confirmation/${idConfirmation}` },
        origine,
      }),
    }),

  reinitialisation: (u, jeton, origine = config.urlPublique) =>
    envoyer({
      a: u.mail,
      sujet: 'Choisir un nouveau mot de passe',
      contenu: gabarit({
        titre: 'Nouveau mot de passe',
        paragraphes: ['Tu as demandé à changer de mot de passe. Le lien est valable une heure.', "Si ce n'est pas toi, ignore ce message : ton mot de passe reste le même."],
        bouton: { texte: 'Choisir un mot de passe', url: `${origine}/reinitialiser/${jeton}` },
        origine,
      }),
    }),

  rappel: (u, { sujet, titre, paragraphes, bouton, chemin = '/accueil' }) =>
    envoyer({
      a: u.mail,
      sujet,
      desinscription: lienDesinscription(u.id_user),
      contenu: gabarit({
        titre,
        paragraphes,
        bouton: { texte: bouton, url: `${config.urlPublique}${chemin}` },
        pied: piedRappel(u.id_user),
      }),
    }),
};
