import { Link } from 'react-router-dom';

const LEGAL_NAME = '[LEGAL_BUSINESS_NAME]';
const TRADING_NAME = 'FX Kontrol';
const CONTACT_EMAIL = 'support@fxkontrol.online';

export default function Terms() {
  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-12">
      <article className="max-w-3xl mx-auto space-y-6">
        <header className="space-y-2">
          <Link to="/" className="text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-primary">← Home</Link>
          <h1 className="text-3xl font-bold">Terms &amp; Conditions</h1>
          <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">1. Who we are</h2>
          <p>These Terms &amp; Conditions ("Terms") govern your access to and use of the {TRADING_NAME} platform, websites, and related services (the "Service"), provided by <strong>{LEGAL_NAME}</strong> (also trading as {TRADING_NAME}, "we", "us", "our"). By creating an account or using the Service, you enter into a binding agreement with {LEGAL_NAME}.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">2. Acceptance</h2>
          <p>By accessing, registering for, or continuing to use the Service, you confirm that you have read, understood, and agree to be bound by these Terms. If you do not agree, you must stop using the Service. If you are using the Service on behalf of an organization, you represent that you have authority to bind that organization.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">3. The Service</h2>
          <p>{TRADING_NAME} is a professional show-control and simulation platform for pyrotechnics, drones, lasers, and related stage-effect hardware. Features and tier availability are described on our pricing page and may evolve over time.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">4. Account &amp; accuracy</h2>
          <p>You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account. You agree to provide accurate information and keep it up to date.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">5. Acceptable use</h2>
          <p>You must not misuse the Service. In particular, you agree not to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>use the Service for any unlawful, fraudulent, or harmful purpose;</li>
            <li>send spam or unsolicited communications;</li>
            <li>infringe any intellectual property, privacy, or other rights;</li>
            <li>introduce malware, probe, scan, or attempt to breach security or authentication;</li>
            <li>scrape, reverse-engineer, or attempt to derive source code from the Service;</li>
            <li>resell or redistribute the Service or circumvent technical limits.</li>
          </ul>
          <p>You are solely responsible for ensuring that any real-world use of the Service (including hardware control, firing sequences, drone flights, and laser output) complies with all applicable laws, permits, and safety standards in your jurisdiction.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">6. Intellectual property</h2>
          <p>The Service, including all software, documentation, designs, and branding, is owned by {LEGAL_NAME} or its licensors and is protected by intellectual-property laws. We grant you a limited, non-exclusive, non-transferable, revocable right to use the Service in accordance with your subscription tier and these Terms. All rights not expressly granted are reserved.</p>
          <p>You retain ownership of content you upload (show plans, designs, telemetry). You grant us a limited license to host and process that content solely to provide the Service to you.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">7. Service availability</h2>
          <p>We work to keep the Service available and reliable, but we do not guarantee uninterrupted, error-free, or fault-tolerant operation. The Service is provided "as is" and "as available" and, to the fullest extent permitted by law, we disclaim all implied warranties, including merchantability and fitness for a particular purpose.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">8. Payments, subscriptions &amp; Merchant of Record</h2>
          <p>Our order process is conducted by our online reseller <strong>Paddle.com</strong>. Paddle.com is the Merchant of Record for all our orders. Paddle provides all customer service inquiries and handles returns.</p>
          <p>Payment, billing, taxes, subscription renewal, cancellation, and refund mechanics are governed by Paddle's <a href="https://www.paddle.com/legal/checkout-buyer-terms" target="_blank" rel="noopener noreferrer" className="text-primary underline">Checkout Buyer Terms</a> and our <Link to="/legal/refund" className="text-primary underline">Refund Policy</Link>.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">9. Suspension &amp; termination</h2>
          <p>We may suspend or terminate your access to the Service if you: (a) materially breach these Terms; (b) fail to pay applicable fees; (c) create a security or fraud risk; or (d) repeatedly or seriously violate our policies. Upon termination, your right to use the Service ends and we may delete your data after a reasonable export window.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">10. Limitation of liability</h2>
          <p>To the fullest extent permitted by law, our aggregate liability arising out of or relating to the Service is limited to the fees you paid to us in the twelve (12) months preceding the event giving rise to the claim. We are not liable for indirect, incidental, special, consequential, or punitive damages, including loss of profits, revenue, data, or goodwill. Nothing in these Terms excludes liability that cannot be excluded by law (including for fraud, death, or personal injury caused by negligence).</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">11. Indemnity</h2>
          <p>You agree to indemnify and hold harmless {LEGAL_NAME} from any claims, losses, or damages arising out of your content, your unlawful or unsafe use of the Service, or your breach of these Terms.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">12. Changes to these Terms</h2>
          <p>We may update these Terms from time to time. Material changes will be communicated via the Service or by email. Continued use of the Service after changes take effect constitutes acceptance.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">13. Governing law</h2>
          <p>These Terms are governed by the laws of the jurisdiction in which {LEGAL_NAME} is established, without regard to conflict-of-law rules. Disputes will be resolved by the competent courts of that jurisdiction, except where mandatory consumer-protection law provides otherwise.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">14. Contact</h2>
          <p>Questions about these Terms? Contact us at <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">{CONTACT_EMAIL}</a>.</p>
        </section>
      </article>
    </main>
  );
}
