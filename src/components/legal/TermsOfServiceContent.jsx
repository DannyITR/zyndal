// NOT REVIEWED BY A LAWYER. Working draft written to the client's
// specification, not legal advice — a Quebec-licensed lawyer should review
// this (especially the liability and simulated-wallet sections) before real
// users, particularly minors, start relying on the app.

const LAST_UPDATED = 'July 2026'

export default function TermsOfServiceContent() {
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
        Zyndal is an educational study tool for students in grades 9-11 (Secondary 3-5): a daily
        practice question in six subjects, streaks and a leaderboard, AI-assisted study guides
        and test prep, a place to store your own uploaded schoolwork, and a reward system parents
        can use to encourage their kids. It is a study aid, not a substitute for a teacher, and
        AI-generated content can be wrong — always check it against your own class material.
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
        <a href="mailto:privacy@zyndal.com">Privacy Policy</a> for how.
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
        Questions about these Terms: <a href="mailto:legal@zyndal.com">legal@zyndal.com</a>.
      </p>
    </div>
  )
}
