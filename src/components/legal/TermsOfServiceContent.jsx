// NOT REVIEWED BY A LAWYER. Working draft written to the client's
// specification, not legal advice — a Quebec-licensed lawyer should review
// this (especially the liability and simulated-wallet sections) before real
// users, particularly minors, start relying on the app.

const LAST_UPDATED = 'July 2026'

export default function TermsOfServiceContent({ lang }) {
  if (lang === 'fr') return <FrenchContent />
  if (lang === 'es') return <SpanishContent />
  return <EnglishContent />
}

function EnglishContent() {
  return (
    <div className="legal-content">
      <p className="legal-updated">Last updated: {LAST_UPDATED}</p>

      <p>
        These Terms of Service ("Terms") govern your use of Zyndal. By creating an account, you
        agree to these Terms. If you're a student under 18, a parent or guardian should read
        these Terms too — see "Parent responsibility" below.
      </p>

      <h3>What Zyndal is</h3>
      <p>
        Zyndal is an educational study tool for students in grades 7-11 (Secondary 1-5): a daily
        practice question in six subjects, streaks and a leaderboard, AI-assisted study guides
        and test prep, a place to store your own uploaded schoolwork, and a reward system parents
        can use to encourage their kids. Support for elementary school grades is coming soon. It
        is a study aid, not a substitute for a teacher, and AI-generated content can be wrong —
        always check it against your own class material.
      </p>

      <h3>Acceptable use</h3>
      <p>Zyndal is for personal educational use only. You agree not to:</p>
      <ul>
        <li>Use the app for anything other than your own studying</li>
        <li>Share daily-question answers with other students, or use answers shared by someone else, to skip actually learning the material</li>
        <li>Impersonate another person, or create an account with false information</li>
        <li>Attempt to disrupt, overload, or gain unauthorized access to Zyndal's systems</li>
      </ul>

      <h3>Account rules</h3>
      <p>
        One account per person. The information you give us when creating an account (username,
        grade, etc.) should be accurate. You're responsible for keeping your password
        confidential — don't share your login with anyone else, including friends.
      </p>

      <h3>Parent responsibility</h3>
      <p>
        A parent who links their account to a student's is responsible for that student's use of
        Zyndal, including all reward wallet activity — funding it, setting the coin-to-dollar
        rate, and approving payouts. Zyndal does not verify a family relationship beyond the
        linking code; a parent is responsible for only sharing their code with their own child.
      </p>

      <h3>The reward wallet is simulated — this is important</h3>
      <p>
        The wallet balance, "adding funds," and payouts you see in Zyndal today are{' '}
        <strong>simulated</strong>. No real payment is processed, and no real money moves through
        the app. Real payment processing may be added in the future; if it is, these Terms will
        be updated first and you'll be asked to agree to the new terms before using it.
      </p>

      <h3>Your uploaded material</h3>
      <p>
        Photos and documents you upload of your own schoolwork remain yours. Zyndal does not
        claim ownership of anything you upload. By uploading it, you give Zyndal permission to
        store it and to process it (including with AI) for the sole purpose of providing the
        service back to you — building your study guides, practice questions, and grade history.
        We don't use your uploads for anything else.
      </p>

      <h3>Suspension and termination</h3>
      <p>
        We can suspend or terminate an account that violates these Terms, without advance notice
        if the violation is serious (e.g. attempting to access another user's account). You can
        stop using Zyndal, or ask us to delete your account, at any time — see our{' '}
        <a href="mailto:hello@zyndal.ca">Privacy Policy</a> for how.
      </p>

      <h3>Limitation of liability</h3>
      <p>
        Zyndal is provided "as is," without warranty of any kind. We don't guarantee the app will
        be error-free, uninterrupted, or that AI-generated content will always be accurate. To
        the fullest extent permitted by law, Zyndal and its operators are not liable for any
        indirect, incidental, or consequential damages arising from your use of the app,
        including academic outcomes. Nothing in these Terms limits liability that can't legally
        be limited under Quebec consumer protection law.
      </p>

      <h3>Governing law</h3>
      <p>These Terms are governed by the laws of the Province of Quebec and the applicable federal laws of Canada.</p>

      <h3>Changes to these Terms</h3>
      <p>If we make a meaningful change, we'll post the update here with a new "last updated" date.</p>

      <h3>Contact us</h3>
      <p>
        Questions about these Terms: <a href="mailto:hello@zyndal.ca">hello@zyndal.ca</a>.
      </p>
    </div>
  )
}

function FrenchContent() {
  return (
    <div className="legal-content">
      <p className="legal-updated">Dernière mise à jour : {LAST_UPDATED}</p>

      <p>
        Les présentes Conditions d'utilisation (« Conditions ») régissent votre utilisation de
        Zyndal. En créant un compte, vous acceptez ces Conditions. Si vous êtes un élève de moins
        de 18 ans, un parent ou un tuteur devrait aussi lire ces Conditions — voir «
        Responsabilité du parent » ci-dessous.
      </p>

      <h3>Ce que Zyndal est</h3>
      <p>
        Zyndal est un outil d'étude éducatif destiné aux élèves de la 7e à la 11e année
        (Secondaire 1-5) : une question de pratique quotidienne dans six matières, des séquences
        et un classement, des guides d'étude et de la préparation aux tests assistés par IA, un
        espace pour conserver vos propres travaux scolaires téléversés, et un système de
        récompenses que les parents peuvent utiliser pour encourager leurs enfants. Le soutien
        pour les niveaux du primaire arrive bientôt. Il s'agit d'une aide à l'étude, pas d'un
        substitut à un enseignant, et le contenu généré par IA peut être erroné — vérifiez-le
        toujours avec votre propre matériel de classe.
      </p>

      <h3>Utilisation acceptable</h3>
      <p>Zyndal est destiné à un usage éducatif personnel uniquement. Vous acceptez de ne pas :</p>
      <ul>
        <li>Utiliser l'application à des fins autres que vos propres études</li>
        <li>
          Partager les réponses aux questions quotidiennes avec d'autres élèves, ou utiliser des
          réponses partagées par quelqu'un d'autre, pour éviter d'apprendre réellement la matière
        </li>
        <li>Usurper l'identité d'une autre personne, ou créer un compte avec de fausses informations</li>
        <li>Tenter de perturber, surcharger ou accéder sans autorisation aux systèmes de Zyndal</li>
      </ul>

      <h3>Règles de compte</h3>
      <p>
        Un compte par personne. Les renseignements que vous nous fournissez lors de la création
        d'un compte (nom d'utilisateur, niveau scolaire, etc.) doivent être exacts. Vous êtes
        responsable de garder votre mot de passe confidentiel — ne partagez votre identifiant de
        connexion avec personne, même vos amis.
      </p>

      <h3>Responsabilité du parent</h3>
      <p>
        Un parent qui lie son compte à celui d'un élève est responsable de l'utilisation que fait
        cet élève de Zyndal, y compris toute l'activité du portefeuille de récompenses — le
        financer, définir le taux de conversion pièces-dollars, et approuver les paiements.
        Zyndal ne vérifie pas le lien familial au-delà du code de liaison; un parent est
        responsable de ne partager son code qu'avec son propre enfant.
      </p>

      <h3>Le portefeuille de récompenses est simulé — c'est important</h3>
      <p>
        Le solde du portefeuille, « l'ajout de fonds » et les paiements que vous voyez
        actuellement dans Zyndal sont <strong>simulés</strong>. Aucun paiement réel n'est traité,
        et aucun argent réel ne transite par l'application. Un traitement de paiement réel
        pourrait être ajouté à l'avenir; si c'est le cas, ces Conditions seront mises à jour au
        préalable et vous serez invité à accepter les nouvelles conditions avant de l'utiliser.
      </p>

      <h3>Votre matériel téléversé</h3>
      <p>
        Les photos et documents que vous téléversez de vos propres travaux scolaires demeurent
        les vôtres. Zyndal ne revendique aucune propriété sur ce que vous téléversez. En le
        téléversant, vous accordez à Zyndal la permission de le conserver et de le traiter (y
        compris avec l'IA) dans le seul but de vous fournir le service — construire vos guides
        d'étude, questions de pratique et historique de notes. Nous n'utilisons pas vos
        téléversements à d'autres fins.
      </p>

      <h3>Suspension et résiliation</h3>
      <p>
        Nous pouvons suspendre ou résilier un compte qui enfreint ces Conditions, sans préavis si
        la violation est grave (par exemple, une tentative d'accès au compte d'un autre
        utilisateur). Vous pouvez cesser d'utiliser Zyndal, ou nous demander de supprimer votre
        compte, en tout temps — consultez notre{' '}
        <a href="mailto:hello@zyndal.ca">Politique de confidentialité</a> pour savoir comment
        faire.
      </p>

      <h3>Limitation de responsabilité</h3>
      <p>
        Zyndal est fourni « tel quel », sans garantie d'aucune sorte. Nous ne garantissons pas
        que l'application sera exempte d'erreurs, ininterrompue, ou que le contenu généré par IA
        sera toujours exact. Dans toute la mesure permise par la loi, Zyndal et ses exploitants
        ne sont pas responsables des dommages indirects, accessoires ou consécutifs découlant de
        votre utilisation de l'application, y compris les résultats scolaires. Rien dans ces
        Conditions ne limite une responsabilité qui ne peut légalement être limitée en vertu de
        la loi québécoise sur la protection du consommateur.
      </p>

      <h3>Loi applicable</h3>
      <p>Ces Conditions sont régies par les lois de la province de Québec et les lois fédérales applicables du Canada.</p>

      <h3>Modifications de ces Conditions</h3>
      <p>Si nous apportons un changement important, nous publierons la mise à jour ici avec une nouvelle date de « dernière mise à jour ».</p>

      <h3>Nous contacter</h3>
      <p>
        Questions à propos de ces Conditions : <a href="mailto:hello@zyndal.ca">hello@zyndal.ca</a>.
      </p>
    </div>
  )
}

function SpanishContent() {
  return (
    <div className="legal-content">
      <p className="legal-updated">Última actualización: {LAST_UPDATED}</p>

      <p>
        Estos Términos de Servicio ("Términos") rigen tu uso de Zyndal. Al crear una cuenta,
        aceptas estos Términos. Si eres un estudiante menor de 18 años, un padre/madre o tutor
        también debería leer estos Términos — consulta "Responsabilidad del padre/madre" a
        continuación.
      </p>

      <h3>Qué es Zyndal</h3>
      <p>
        Zyndal es una herramienta de estudio educativa para estudiantes de 7º a 11º grado
        (Secundaria 1-5): una pregunta de práctica diaria en seis materias, rachas y una
        clasificación, guías de estudio y preparación de exámenes asistidas por IA, un lugar para
        guardar tus propios trabajos escolares subidos, y un sistema de recompensas que los padres
        pueden usar para motivar a sus hijos. El soporte para grados de primaria llegará pronto. Es
        una ayuda de estudio, no un sustituto de un profesor, y el contenido generado por IA puede
        estar equivocado — siempre verifícalo con el material de tu propia clase.
      </p>

      <h3>Uso aceptable</h3>
      <p>Zyndal es solo para uso educativo personal. Aceptas no:</p>
      <ul>
        <li>Usar la aplicación para algo que no sea tu propio estudio</li>
        <li>Compartir respuestas de las preguntas diarias con otros estudiantes, o usar respuestas compartidas por otra persona, para evitar aprender realmente el material</li>
        <li>Suplantar a otra persona, o crear una cuenta con información falsa</li>
        <li>Intentar interrumpir, sobrecargar u obtener acceso no autorizado a los sistemas de Zyndal</li>
      </ul>

      <h3>Reglas de la cuenta</h3>
      <p>
        Una cuenta por persona. La información que nos proporcionas al crear una cuenta (nombre de
        usuario, grado, etc.) debe ser precisa. Eres responsable de mantener tu contraseña
        confidencial — no compartas tu inicio de sesión con nadie más, incluidos amigos.
      </p>

      <h3>Responsabilidad del padre/madre</h3>
      <p>
        Un padre/madre que vincula su cuenta a la de un estudiante es responsable del uso que ese
        estudiante haga de Zyndal, incluida toda la actividad de la billetera de recompensas —
        financiarla, establecer la tasa de conversión de monedas a dólares y aprobar los pagos.
        Zyndal no verifica una relación familiar más allá del código de vinculación; un padre/madre
        es responsable de compartir su código solo con su propio hijo/a.
      </p>

      <h3>La billetera de recompensas es simulada — esto es importante</h3>
      <p>
        El saldo de la billetera, "agregar fondos" y los pagos que ves hoy en Zyndal son{' '}
        <strong>simulados</strong>. No se procesa ningún pago real, y ningún dinero real se mueve a
        través de la aplicación. Un procesamiento de pagos real podría añadirse en el futuro; si
        ocurre, estos Términos se actualizarán primero y se te pedirá que aceptes los nuevos
        términos antes de usarlo.
      </p>

      <h3>Tu material subido</h3>
      <p>
        Las fotos y documentos que subas de tus propios trabajos escolares siguen siendo tuyos.
        Zyndal no reclama la propiedad de nada que subas. Al subirlo, le das permiso a Zyndal para
        almacenarlo y procesarlo (incluso con IA) con el único fin de brindarte el servicio —
        construir tus guías de estudio, preguntas de práctica e historial de notas. No usamos tus
        archivos subidos para nada más.
      </p>

      <h3>Suspensión y terminación</h3>
      <p>
        Podemos suspender o terminar una cuenta que viole estos Términos, sin previo aviso si la
        violación es grave (por ejemplo, intentar acceder a la cuenta de otro usuario). Puedes
        dejar de usar Zyndal, o pedirnos que eliminemos tu cuenta, en cualquier momento — consulta
        nuestra <a href="mailto:hello@zyndal.ca">Política de privacidad</a> para saber cómo hacerlo.
      </p>

      <h3>Limitación de responsabilidad</h3>
      <p>
        Zyndal se proporciona "tal cual", sin garantía de ningún tipo. No garantizamos que la
        aplicación esté libre de errores, ininterrumpida, o que el contenido generado por IA sea
        siempre preciso. En la máxima medida permitida por la ley, Zyndal y sus operadores no son
        responsables de daños indirectos, incidentales o consecuentes derivados de tu uso de la
        aplicación, incluidos los resultados académicos. Nada en estos Términos limita una
        responsabilidad que no pueda limitarse legalmente bajo la ley de protección al consumidor
        de Quebec.
      </p>

      <h3>Ley aplicable</h3>
      <p>Estos Términos se rigen por las leyes de la provincia de Quebec y las leyes federales aplicables de Canadá.</p>

      <h3>Cambios a estos Términos</h3>
      <p>Si hacemos un cambio significativo, publicaremos la actualización aquí con una nueva fecha de "última actualización".</p>

      <h3>Contáctanos</h3>
      <p>
        Preguntas sobre estos Términos: <a href="mailto:hello@zyndal.ca">hello@zyndal.ca</a>.
      </p>
    </div>
  )
}
