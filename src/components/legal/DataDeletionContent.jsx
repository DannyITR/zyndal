// Standalone data-deletion instructions — required as a directly-linkable
// URL by Facebook's Platform Terms (App Settings → Data Deletion
// Instructions URL) for any app offering Facebook Login, and useful on its
// own regardless. Doesn't introduce a new policy: it explains, as its own
// dedicated page, the exact same 90-day soft-delete process already
// described in the Privacy Policy's "Deactivating your account" section.
//
// NOT REVIEWED BY A LAWYER. Working draft written to the client's
// specification, not legal advice — see PrivacyPolicyContent.jsx's own
// header comment, which applies equally here.

const LAST_UPDATED = 'August 2026'

export default function DataDeletionContent({ lang }) {
  if (lang === 'fr') return <FrenchContent />
  if (lang === 'es') return <SpanishContent />
  return <EnglishContent />
}

function EnglishContent() {
  return (
    <div className="legal-content">
      <p className="legal-updated">Last updated: {LAST_UPDATED}</p>

      <p>
        This page explains how to delete your data from Zyndal — whether you signed up with a
        username and password, or with Google or Facebook.
      </p>

      <h3>Delete your own account</h3>
      <p>
        Go to <strong>Settings → Delete My Account</strong> while logged in. Your account is
        signed out everywhere immediately and can no longer be logged into. Your data is then
        kept for <strong>90 days</strong> in case you change your mind — to restore your account
        within that window, email <a href="mailto:hello@zyndal.ca">hello@zyndal.ca</a>. After 90
        days, everything is <strong>permanently and irreversibly deleted</strong>.
      </p>

      <h3>Can't log in to request it yourself?</h3>
      <p>
        Email <a href="mailto:hello@zyndal.ca">hello@zyndal.ca</a> from the email address on your
        account (or tell us your username) and ask us to delete your account. We'll confirm your
        identity and process the request the same way, starting the same 90-day window.
      </p>

      <h3>If you're a parent</h3>
      <p>
        You can request deletion of your linked child's data at any time by emailing{' '}
        <a href="mailto:hello@zyndal.ca">hello@zyndal.ca</a> — even if the child no longer has
        access to their own account.
      </p>

      <h3>What gets deleted</h3>
      <p>
        All personal information described in our{' '}
        <a href="/privacy">Privacy Policy</a>: your profile, answers and progress, uploaded
        documents and anything generated from them, study plans, grades, and (for parents) wallet
        and payout history. This is permanently removed from our database 90 days after a deletion
        request — we don't keep backups of deleted accounts beyond that window.
      </p>

      <h3>Signed in with Google or Facebook?</h3>
      <p>
        Deleting your Zyndal account deletes everything Zyndal stored about you, including your
        name and email as shared during sign-in. It does not affect your actual Google or Facebook
        account — if you also want to remove Zyndal's access there, do that separately from that
        provider's own account security settings.
      </p>

      <h3>Questions</h3>
      <p>
        Email <a href="mailto:hello@zyndal.ca">hello@zyndal.ca</a> — see our{' '}
        <a href="/privacy">Privacy Policy</a> for more on what we collect and why.
      </p>
    </div>
  )
}

function FrenchContent() {
  return (
    <div className="legal-content">
      <p className="legal-updated">Dernière mise à jour : {LAST_UPDATED}</p>

      <p>
        Cette page explique comment supprimer vos données de Zyndal — que vous vous soyez inscrit
        avec un nom d'utilisateur et un mot de passe, ou avec Google ou Facebook.
      </p>

      <h3>Supprimer votre propre compte</h3>
      <p>
        Allez dans <strong>Paramètres → Supprimer mon compte</strong> une fois connecté. Votre
        compte est immédiatement déconnecté partout et ne peut plus être utilisé pour vous
        connecter. Vos données sont ensuite conservées pendant <strong>90 jours</strong> au cas où
        vous changeriez d'avis — pour restaurer votre compte pendant cette période, écrivez à{' '}
        <a href="mailto:hello@zyndal.ca">hello@zyndal.ca</a>. Après 90 jours, tout est{' '}
        <strong>supprimé de façon permanente et irréversible</strong>.
      </p>

      <h3>Vous ne pouvez pas vous connecter pour faire la demande vous-même ?</h3>
      <p>
        Écrivez à <a href="mailto:hello@zyndal.ca">hello@zyndal.ca</a> depuis l'adresse courriel
        associée à votre compte (ou indiquez-nous votre nom d'utilisateur) et demandez la
        suppression de votre compte. Nous confirmerons votre identité et traiterons la demande de
        la même façon, en déclenchant la même période de 90 jours.
      </p>

      <h3>Si vous êtes parent</h3>
      <p>
        Vous pouvez demander la suppression des données de votre enfant lié en tout temps en
        écrivant à <a href="mailto:hello@zyndal.ca">hello@zyndal.ca</a> — même si l'enfant n'a
        plus accès à son propre compte.
      </p>

      <h3>Ce qui est supprimé</h3>
      <p>
        Tous les renseignements personnels décrits dans notre{' '}
        <a href="/privacy">Politique de confidentialité</a> : votre profil, vos réponses et vos
        progrès, les documents téléversés et tout ce qui en a été généré, les plans d'étude, les
        notes et (pour les parents) le portefeuille et l'historique des paiements. Ces données sont
        définitivement retirées de notre base de données 90 jours après une demande de suppression
        — nous ne conservons aucune copie de sauvegarde des comptes supprimés au-delà de cette
        période.
      </p>

      <h3>Connecté avec Google ou Facebook ?</h3>
      <p>
        Supprimer votre compte Zyndal supprime tout ce que Zyndal a stocké à votre sujet, y compris
        votre nom et votre courriel partagés lors de la connexion. Cela n'affecte pas votre compte
        Google ou Facebook lui-même — si vous souhaitez également retirer l'accès de Zyndal à cet
        endroit, faites-le séparément dans les paramètres de sécurité de ce fournisseur.
      </p>

      <h3>Questions</h3>
      <p>
        Écrivez à <a href="mailto:hello@zyndal.ca">hello@zyndal.ca</a> — consultez notre{' '}
        <a href="/privacy">Politique de confidentialité</a> pour en savoir plus sur ce que nous
        recueillons et pourquoi.
      </p>
    </div>
  )
}

function SpanishContent() {
  return (
    <div className="legal-content">
      <p className="legal-updated">Última actualización: {LAST_UPDATED}</p>

      <p>
        Esta página explica cómo eliminar tus datos de Zyndal — ya sea que te hayas registrado con
        un nombre de usuario y contraseña, o con Google o Facebook.
      </p>

      <h3>Elimina tu propia cuenta</h3>
      <p>
        Ve a <strong>Configuración → Eliminar mi cuenta</strong> mientras estés conectado. Tu
        cuenta se cierra de inmediato en todas partes y ya no se puede usar para iniciar sesión.
        Tus datos se conservan después durante <strong>90 días</strong> por si cambias de opinión —
        para restaurar tu cuenta dentro de ese período, escribe a{' '}
        <a href="mailto:hello@zyndal.ca">hello@zyndal.ca</a>. Después de 90 días, todo se{' '}
        <strong>elimina de forma permanente e irreversible</strong>.
      </p>

      <h3>¿No puedes iniciar sesión para solicitarlo tú mismo?</h3>
      <p>
        Escribe a <a href="mailto:hello@zyndal.ca">hello@zyndal.ca</a> desde el correo asociado a
        tu cuenta (o indícanos tu nombre de usuario) y solicita la eliminación de tu cuenta.
        Confirmaremos tu identidad y procesaremos la solicitud de la misma manera, iniciando el
        mismo período de 90 días.
      </p>

      <h3>Si eres madre o padre</h3>
      <p>
        Puedes solicitar la eliminación de los datos de tu hijo/a vinculado/a en cualquier momento
        escribiendo a <a href="mailto:hello@zyndal.ca">hello@zyndal.ca</a> — incluso si el/la
        menor ya no tiene acceso a su propia cuenta.
      </p>

      <h3>Qué se elimina</h3>
      <p>
        Toda la información personal descrita en nuestra{' '}
        <a href="/privacy">Política de privacidad</a>: tu perfil, respuestas y progreso, documentos
        subidos y cualquier contenido generado a partir de ellos, planes de estudio, calificaciones
        y (para padres/madres) la billetera y el historial de pagos. Esto se elimina de forma
        permanente de nuestra base de datos 90 días después de una solicitud de eliminación — no
        conservamos copias de respaldo de cuentas eliminadas más allá de ese período.
      </p>

      <h3>¿Iniciaste sesión con Google o Facebook?</h3>
      <p>
        Eliminar tu cuenta de Zyndal elimina todo lo que Zyndal almacenó sobre ti, incluidos tu
        nombre y correo compartidos durante el inicio de sesión. Esto no afecta tu cuenta real de
        Google o Facebook — si también deseas retirar el acceso de Zyndal allí, hazlo por separado
        desde la configuración de seguridad de esa cuenta.
      </p>

      <h3>Preguntas</h3>
      <p>
        Escribe a <a href="mailto:hello@zyndal.ca">hello@zyndal.ca</a> — consulta nuestra{' '}
        <a href="/privacy">Política de privacidad</a> para más información sobre qué recopilamos y
        por qué.
      </p>
    </div>
  )
}
