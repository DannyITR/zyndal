// Plain-language Privacy Policy, in English and French (Quebec Law 25 —
// the Act respecting the protection of personal information in the private
// sector — requires notices like this to be written in clear, simple
// language, so this deliberately avoids dense legal phrasing where a plain
// sentence says the same thing).
//
// NOT REVIEWED BY A LAWYER. This is a working draft written to the client's
// specification, not legal advice. Before Zyndal is opened to real users —
// especially minors — a Quebec-licensed lawyer should review this page,
// confirm the data-residency claim below is actually accurate for the
// Supabase project in use, and confirm a named Privacy Officer is on file
// (Law 25 requires one; "hello@zyndal.ca" is a placeholder inbox, not a
// substitute for designating a specific responsible person).

const LAST_UPDATED = 'July 2026'

export default function PrivacyPolicyContent({ lang }) {
  if (lang === 'fr') return <FrenchContent />
  if (lang === 'es') return <SpanishContent />
  return <EnglishContent />
}

function EnglishContent() {
  return (
    <div className="legal-content">
      <p className="legal-updated">Last updated: {LAST_UPDATED}</p>

      <p>
        Zyndal ("we", "us", "Zyndal") is a daily study app for students in grades 7-11 (Secondary
        1-5) and their parents. This page explains what personal information we collect, why we
        collect it, and what rights you have over it. We've tried to write it in plain language —
        if anything is unclear, email us at{' '}
        <a href="mailto:hello@zyndal.ca">hello@zyndal.ca</a> and we'll explain it properly.
      </p>

      <h3>What data we collect</h3>
      <ul>
        <li>Your username, password (stored encrypted, never in plain text), and account type (student or parent)</li>
        <li>For students: grade level, school name (if provided), display name, avatar</li>
        <li>Your daily question answers, streak, XP, and coin balance</li>
        <li>Photos or documents you upload of your own schoolwork, and any AI-generated summaries or practice questions built from them</li>
        <li>Study plans, practice session results, and manually logged grades</li>
        <li>For parents: the reward wallet balance and payout history for your linked child/children</li>
        <li>Basic technical data needed to keep you signed in (a session token) and to stop abuse of the service (rate-limiting)</li>
      </ul>

      <h3>Why we collect it</h3>
      <p>We only use your data to run Zyndal itself:</p>
      <ul>
        <li>To provide the core service — daily questions, streaks, the leaderboard, study guides, and test prep</li>
        <li>To track a student's academic progress over time</li>
        <li>To let a linked parent monitor their child's progress and manage the (currently simulated) reward wallet</li>
        <li>To generate personalized study content from a student's own uploaded materials</li>
      </ul>
      <p>We never use your data for advertising, and we never sell it to anyone.</p>

      <h3>Who can see it</h3>
      <p>
        A student's data is visible to that student, and to the parent account they're linked to
        (if any). A parent's data is visible only to that parent. No other student, parent, or
        outside party can see your information. A small number of Zyndal staff can access data
        only when needed to fix a technical problem — never to browse or share it.
      </p>

      <h3>Where your data is stored</h3>
      <p>
        Your data is stored with Supabase, on servers located in Canada. It's encrypted in
        transit, and access to the underlying database is restricted to Zyndal's own systems —
        no direct public access is possible.
      </p>

      <h3>Minors and parental consent</h3>
      <p>
        Zyndal is built for students, many of whom are under 18. A student account can be linked
        to a parent account using a code the parent shares — creating that link, and the parent
        account itself, is how a parent gives (and can see evidence of having given) permission
        for their child to use Zyndal. A parent can request their child's data be deleted at any
        time, even if the child no longer has access to their own account.
      </p>

      <h3>Your rights under Quebec's Law 25</h3>
      <p>You (or, for a minor under 14, your parent) can at any time:</p>
      <ul>
        <li>Ask what personal information we hold about you</li>
        <li>Ask us to correct information that's wrong</li>
        <li>Ask us to delete your account and personal information</li>
      </ul>
      <p>
        To make any of these requests, email <a href="mailto:hello@zyndal.ca">hello@zyndal.ca</a>.
        We'll respond within a reasonable time, as required by law.
      </p>

      <h3>Deactivating your account</h3>
      <p>
        You can deactivate your own account at any time from <strong>Settings → Delete My
        Account</strong>. This is a deactivation, not an instant erasure: your account is
        immediately signed out everywhere and can no longer be logged into, but your data is kept
        for <strong>90 days</strong> in case you want it back. To restore a deactivated account
        within that window, email <a href="mailto:hello@zyndal.ca">hello@zyndal.ca</a>. After 90
        days, everything is <strong>permanently and irreversibly deleted</strong>. This process is
        in place specifically to comply with Quebec's Law 25.
      </p>

      <h3>No selling data, no advertising</h3>
      <p>We do not sell, rent, or trade your personal information to any third party — ever. Zyndal has no advertising and never will while it remains a study tool for students.</p>

      <h3>Changes to this policy</h3>
      <p>If we make a meaningful change to this policy, we'll post the update here with a new "last updated" date.</p>

      <h3>Contact us</h3>
      <p>
        Questions, concerns, or a request about your data: <a href="mailto:hello@zyndal.ca">hello@zyndal.ca</a>.
        To restore a deactivated account: <a href="mailto:hello@zyndal.ca">hello@zyndal.ca</a>.
      </p>
    </div>
  )
}

function FrenchContent() {
  return (
    <div className="legal-content">
      <p className="legal-updated">Dernière mise à jour : {LAST_UPDATED}</p>

      <p>
        Zyndal (« nous », « Zyndal ») est une application d'étude quotidienne destinée aux élèves
        de la 7e à la 11e année (secondaire 1 à 5) et à leurs parents. Cette page explique quels renseignements
        personnels nous recueillons, pourquoi nous les recueillons, et quels droits vous avez à
        leur égard. Nous avons voulu l'écrire en langage clair — si quelque chose n'est pas clair,
        écrivez-nous à <a href="mailto:hello@zyndal.ca">hello@zyndal.ca</a> et nous vous
        l'expliquerons.
      </p>

      <h3>Quels renseignements nous recueillons</h3>
      <ul>
        <li>Votre nom d'utilisateur, votre mot de passe (chiffré, jamais en texte brut) et votre type de compte (élève ou parent)</li>
        <li>Pour les élèves : le niveau scolaire, le nom de l'école (si fourni), le nom d'affichage, l'avatar</li>
        <li>Vos réponses aux questions quotidiennes, votre séquence, votre XP et votre solde de pièces</li>
        <li>Les photos ou documents que vous téléversez de vos propres travaux scolaires, ainsi que tout résumé ou question générés par l'IA à partir de ceux-ci</li>
        <li>Les plans d'étude, les résultats des sessions de pratique et les notes consignées manuellement</li>
        <li>Pour les parents : le solde du portefeuille de récompenses et l'historique des paiements pour votre ou vos enfants liés</li>
        <li>Des données techniques de base nécessaires pour garder votre session ouverte (un jeton de session) et pour prévenir les abus (limitation du taux de requêtes)</li>
      </ul>

      <h3>Pourquoi nous les recueillons</h3>
      <p>Nous utilisons vos données uniquement pour faire fonctionner Zyndal :</p>
      <ul>
        <li>Pour fournir le service de base — questions quotidiennes, séquences, classement, guides d'étude et préparation aux tests</li>
        <li>Pour suivre les progrès scolaires d'un élève dans le temps</li>
        <li>Pour permettre à un parent lié de suivre les progrès de son enfant et de gérer le portefeuille de récompenses (actuellement simulé)</li>
        <li>Pour générer du contenu d'étude personnalisé à partir des documents téléversés par l'élève</li>
      </ul>
      <p>Nous n'utilisons jamais vos données à des fins publicitaires, et nous ne les vendons jamais à qui que ce soit.</p>

      <h3>Qui peut les voir</h3>
      <p>
        Les données d'un élève sont visibles par cet élève et par le compte parent auquel il est
        lié, le cas échéant. Les données d'un parent ne sont visibles que par ce parent. Aucun
        autre élève, parent ou tiers ne peut voir vos renseignements. Un nombre restreint de
        membres du personnel de Zyndal peut y accéder, seulement pour résoudre un problème
        technique — jamais pour les consulter ou les partager.
      </p>

      <h3>Où vos données sont conservées</h3>
      <p>
        Vos données sont conservées chez Supabase, sur des serveurs situés au Canada. Elles sont
        chiffrées en transit, et l'accès à la base de données sous-jacente est réservé aux
        systèmes de Zyndal — aucun accès public direct n'est possible.
      </p>

      <h3>Mineurs et consentement parental</h3>
      <p>
        Zyndal est conçu pour des élèves, dont plusieurs ont moins de 18 ans. Un compte élève peut
        être lié à un compte parent au moyen d'un code que le parent partage — la création de ce
        lien, tout comme le compte parent lui-même, constitue la façon dont un parent donne (et
        peut démontrer avoir donné) la permission à son enfant d'utiliser Zyndal. Un parent peut
        demander la suppression des données de son enfant en tout temps, même si l'enfant n'a
        plus accès à son propre compte.
      </p>

      <h3>Vos droits en vertu de la Loi 25 du Québec</h3>
      <p>Vous (ou, pour un mineur de moins de 14 ans, votre parent) pouvez en tout temps :</p>
      <ul>
        <li>Demander quels renseignements personnels nous détenons à votre sujet</li>
        <li>Demander la correction de renseignements erronés</li>
        <li>Demander la suppression de votre compte et de vos renseignements personnels</li>
      </ul>
      <p>
        Pour faire l'une de ces demandes, écrivez à <a href="mailto:hello@zyndal.ca">hello@zyndal.ca</a>.
        Nous répondrons dans un délai raisonnable, tel que requis par la loi.
      </p>

      <h3>Désactiver votre compte</h3>
      <p>
        Vous pouvez désactiver votre propre compte en tout temps depuis <strong>Paramètres →
        Supprimer mon compte</strong>. Il s'agit d'une désactivation, pas d'un effacement
        instantané : votre compte est immédiatement déconnecté partout et ne peut plus être utilisé
        pour vous connecter, mais vos données sont conservées pendant <strong>90 jours</strong> au
        cas où vous souhaiteriez les récupérer. Pour restaurer un compte désactivé pendant cette
        période, écrivez à <a href="mailto:hello@zyndal.ca">hello@zyndal.ca</a>. Après 90 jours,
        tout est <strong>supprimé de façon permanente et irréversible</strong>. Ce processus est en
        place spécifiquement pour se conformer à la Loi 25 du Québec.
      </p>

      <h3>Aucune vente de données, aucune publicité</h3>
      <p>
        Nous ne vendons, ne louons ni n'échangeons jamais vos renseignements personnels à des
        tiers. Zyndal ne contient aucune publicité et n'en aura jamais tant qu'il demeurera un
        outil d'étude pour les élèves.
      </p>

      <h3>Modifications de cette politique</h3>
      <p>Si nous apportons un changement important à cette politique, nous publierons la mise à jour ici avec une nouvelle date.</p>

      <h3>Nous contacter</h3>
      <p>
        Questions, préoccupations ou demande concernant vos données :{' '}
        <a href="mailto:hello@zyndal.ca">hello@zyndal.ca</a>. Pour restaurer un compte
        désactivé : <a href="mailto:hello@zyndal.ca">hello@zyndal.ca</a>.
      </p>
    </div>
  )
}

function SpanishContent() {
  return (
    <div className="legal-content">
      <p className="legal-updated">Última actualización: {LAST_UPDATED}</p>

      <p>
        Zyndal ("nosotros", "Zyndal") es una aplicación de estudio diario para estudiantes de 7º a
        11º grado (Secundaria 1-5) y sus padres. Esta página explica qué información personal
        recopilamos, por qué la recopilamos y qué derechos tienes sobre ella. Hemos intentado
        escribirla en lenguaje sencillo — si algo no está claro, escríbenos a{' '}
        <a href="mailto:hello@zyndal.ca">hello@zyndal.ca</a> y te lo explicaremos con gusto.
      </p>

      <h3>Qué datos recopilamos</h3>
      <ul>
        <li>Tu nombre de usuario, contraseña (almacenada cifrada, nunca en texto plano) y tipo de cuenta (estudiante o padre/madre)</li>
        <li>Para estudiantes: grado escolar, nombre de la escuela (si se proporciona), nombre para mostrar, avatar</li>
        <li>Tus respuestas a las preguntas diarias, racha, XP y saldo de monedas</li>
        <li>Fotos o documentos que subas de tus propios trabajos escolares, y cualquier resumen o pregunta de práctica generados por IA a partir de ellos</li>
        <li>Planes de estudio, resultados de sesiones de práctica y notas registradas manualmente</li>
        <li>Para padres/madres: el saldo de la billetera de recompensas y el historial de pagos de tu(s) hijo(s) vinculado(s)</li>
        <li>Datos técnicos básicos necesarios para mantener tu sesión iniciada (un token de sesión) y para prevenir el abuso del servicio (limitación de tasa)</li>
      </ul>

      <h3>Por qué lo recopilamos</h3>
      <p>Solo usamos tus datos para operar Zyndal:</p>
      <ul>
        <li>Para ofrecer el servicio principal — preguntas diarias, rachas, la clasificación, guías de estudio y preparación de exámenes</li>
        <li>Para seguir el progreso académico de un estudiante a lo largo del tiempo</li>
        <li>Para permitir que un padre/madre vinculado supervise el progreso de su hijo/a y administre la billetera de recompensas (actualmente simulada)</li>
        <li>Para generar contenido de estudio personalizado a partir de los materiales que el estudiante ha subido</li>
      </ul>
      <p>Nunca usamos tus datos para publicidad, y nunca los vendemos a nadie.</p>

      <h3>Quién puede verlos</h3>
      <p>
        Los datos de un estudiante son visibles para ese estudiante y para la cuenta de padre/madre
        a la que esté vinculado (si la hay). Los datos de un padre/madre solo son visibles para ese
        padre/madre. Ningún otro estudiante, padre/madre o tercero puede ver tu información. Un
        pequeño número de miembros del personal de Zyndal puede acceder a los datos solo cuando sea
        necesario para resolver un problema técnico — nunca para consultarlos o compartirlos.
      </p>

      <h3>Dónde se almacenan tus datos</h3>
      <p>
        Tus datos se almacenan con Supabase, en servidores ubicados en Canadá. Están cifrados en
        tránsito, y el acceso a la base de datos subyacente está restringido a los propios sistemas
        de Zyndal — no es posible el acceso público directo.
      </p>

      <h3>Menores y consentimiento parental</h3>
      <p>
        Zyndal está diseñado para estudiantes, muchos de los cuales son menores de 18 años. Una
        cuenta de estudiante puede vincularse a una cuenta de padre/madre mediante un código que el
        padre/madre comparte — crear ese vínculo, así como la cuenta de padre/madre en sí, es la
        forma en que un padre/madre otorga (y puede demostrar haber otorgado) permiso para que su
        hijo/a use Zyndal. Un padre/madre puede solicitar en cualquier momento que se eliminen los
        datos de su hijo/a, incluso si el/la menor ya no tiene acceso a su propia cuenta.
      </p>

      <h3>Tus derechos bajo la Ley 25 de Quebec</h3>
      <p>Tú (o, para un menor de 14 años, tu padre/madre) puedes en cualquier momento:</p>
      <ul>
        <li>Preguntar qué información personal tenemos sobre ti</li>
        <li>Pedirnos que corrijamos información incorrecta</li>
        <li>Pedirnos que eliminemos tu cuenta e información personal</li>
      </ul>
      <p>
        Para hacer cualquiera de estas solicitudes, escribe a{' '}
        <a href="mailto:hello@zyndal.ca">hello@zyndal.ca</a>. Responderemos dentro de un plazo
        razonable, según lo exige la ley.
      </p>

      <h3>Desactivar tu cuenta</h3>
      <p>
        Puedes desactivar tu propia cuenta en cualquier momento desde <strong>Configuración →
        Eliminar mi cuenta</strong>. Esto es una desactivación, no un borrado instantáneo: tu cuenta
        se cierra de inmediato en todas partes y ya no se puede usar para iniciar sesión, pero tus
        datos se conservan durante <strong>90 días</strong> por si deseas recuperarlos. Para
        restaurar una cuenta desactivada dentro de ese período, escribe a{' '}
        <a href="mailto:hello@zyndal.ca">hello@zyndal.ca</a>. Después de 90 días, todo se{' '}
        <strong>elimina de forma permanente e irreversible</strong>. Este proceso existe
        específicamente para cumplir con la Ley 25 de Quebec.
      </p>

      <h3>Sin venta de datos, sin publicidad</h3>
      <p>
        No vendemos, alquilamos ni intercambiamos tu información personal con terceros — nunca.
        Zyndal no tiene publicidad y nunca la tendrá mientras siga siendo una herramienta de estudio
        para estudiantes.
      </p>

      <h3>Cambios a esta política</h3>
      <p>Si hacemos un cambio significativo a esta política, publicaremos la actualización aquí con una nueva fecha de "última actualización".</p>

      <h3>Contáctanos</h3>
      <p>
        Preguntas, inquietudes o una solicitud sobre tus datos:{' '}
        <a href="mailto:hello@zyndal.ca">hello@zyndal.ca</a>. Para restaurar una cuenta
        desactivada: <a href="mailto:hello@zyndal.ca">hello@zyndal.ca</a>.
      </p>
    </div>
  )
}
