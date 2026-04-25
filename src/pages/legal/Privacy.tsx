import { Link } from 'react-router-dom';

const LEGAL_NAME = '[LEGAL_BUSINESS_NAME]';
const TRADING_NAME = 'FX Kontrol';
const CONTACT_EMAIL = 'support@fxkontrol.online';

export default function Privacy() {
  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-12">
      <article className="max-w-3xl mx-auto space-y-6">
        <header className="space-y-2">
          <Link to="/" className="text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-primary">← Home</Link>
          <h1 className="text-3xl font-bold">Privacy Notice</h1>
          <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">1. Who we are</h2>
          <p>This Privacy Notice describes how <strong>{LEGAL_NAME}</strong> (trading as {TRADING_NAME}, "we", "us", "our") collects and processes personal data when you use our platform and websites (the "Service"). {LEGAL_NAME} acts as the <strong>data controller</strong> for the personal data described below.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">2. Personal data we collect</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Account data</strong> — name, email address, login credentials, profile information (company, role, phone, bio).</li>
            <li><strong>Support &amp; communications</strong> — messages you send us and any attachments.</li>
            <li><strong>Usage &amp; telemetry</strong> — features used, pages visited, performance metrics, error logs.</li>
            <li><strong>Device &amp; technical data</strong> — IP address, device identifiers, browser type, operating system.</li>
            <li><strong>Show &amp; project data</strong> — project files, show plans, hardware configurations and telemetry you create or upload.</li>
          </ul>
          <p>Payment card details are collected and processed by Paddle, our Merchant of Record — we do not receive or store card numbers.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">3. Why we use your data &amp; legal basis</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>To create and operate your account and provide the Service — <em>performance of contract</em>.</li>
            <li>To process subscriptions, invoices, and tax compliance via Paddle — <em>performance of contract</em> and <em>legal obligation</em>.</li>
            <li>To provide customer support — <em>performance of contract</em>.</li>
            <li>To secure the Service and prevent fraud or abuse — <em>legitimate interests</em>.</li>
            <li>To improve and develop the Service through analytics and diagnostics — <em>legitimate interests</em>.</li>
            <li>To send service-related communications and, where permitted, marketing — <em>legitimate interests</em> or <em>consent</em>.</li>
            <li>To comply with our legal obligations — <em>legal obligation</em>.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">4. Who we share data with</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Service providers / subprocessors</strong> — hosting, database, analytics, error monitoring, email delivery, and customer-support tooling.</li>
            <li><strong>Paddle.com Market Limited</strong> — our Merchant of Record. Paddle handles checkout, payments, subscription management, tax compliance, invoicing, and refund processing.</li>
            <li><strong>Professional advisers</strong> — legal, accounting, and compliance advisers under duties of confidentiality.</li>
            <li><strong>Authorities</strong> — where required by law, court order, or to protect rights, property, or safety.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">5. International transfers</h2>
          <p>Some of our service providers may be located outside your country of residence, including outside the UK and EEA. Where data is transferred internationally, we rely on appropriate safeguards such as Standard Contractual Clauses or adequacy decisions.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">6. Retention</h2>
          <p>We retain personal data for as long as necessary to provide the Service, comply with legal obligations (such as tax and accounting), resolve disputes, and enforce our agreements. When data is no longer needed, we delete or anonymize it.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">7. Your rights</h2>
          <p>Depending on your jurisdiction, you may have the right to: access your personal data; request correction or deletion; restrict or object to certain processing; receive a copy in a portable format; withdraw consent; and lodge a complaint with your local data-protection authority. For EEA/UK users, we will respond within one month.</p>
          <p>To exercise any right, contact <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">{CONTACT_EMAIL}</a>.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">8. Security</h2>
          <p>We implement appropriate technical and organizational measures to protect personal data, including encryption in transit, access controls, and regular review of our security practices. No system is perfectly secure, but we work to protect your data against unauthorized access, alteration, or loss.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">9. Cookies</h2>
          <p>We use strictly necessary cookies to authenticate sessions and remember preferences, and limited analytics cookies to understand how the Service is used. You can manage cookie preferences through your browser settings.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">10. Changes to this Notice</h2>
          <p>We may update this Privacy Notice from time to time. The "last updated" date at the top reflects the latest revision. Material changes will be communicated via the Service or by email.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">11. Contact</h2>
          <p>Questions about this Privacy Notice or our data practices? Contact us at <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">{CONTACT_EMAIL}</a>.</p>
        </section>
      </article>
    </main>
  );
}
