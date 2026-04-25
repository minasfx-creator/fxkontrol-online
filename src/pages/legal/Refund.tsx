import { Link } from 'react-router-dom';

const LEGAL_NAME = '[LEGAL_BUSINESS_NAME]';
const TRADING_NAME = 'FX Kontrol';
const CONTACT_EMAIL = 'support@fxkontrol.online';

export default function Refund() {
  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-12">
      <article className="max-w-3xl mx-auto space-y-6">
        <header className="space-y-2">
          <Link to="/" className="text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-primary">← Home</Link>
          <h1 className="text-3xl font-bold">Refund Policy</h1>
          <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">30-day money-back guarantee</h2>
          <p>We want you to be satisfied with {TRADING_NAME}, provided by <strong>{LEGAL_NAME}</strong>. If you are not happy with your purchase, you may request a full refund within <strong>30 days</strong> of your order date.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">How to request a refund</h2>
          <p>Refunds are processed by our payment provider and Merchant of Record, <strong>Paddle</strong>. To request a refund:</p>
          <ol className="list-decimal pl-6 space-y-1">
            <li>Visit <a href="https://paddle.net" target="_blank" rel="noopener noreferrer" className="text-primary underline">paddle.net</a> and locate your order using the email address used at checkout.</li>
            <li>Submit a refund request directly through Paddle, or</li>
            <li>Contact us at <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">{CONTACT_EMAIL}</a> and we will coordinate with Paddle on your behalf.</li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Subscriptions</h2>
          <p>You can cancel a subscription at any time from your billing portal (accessible via Paddle). Cancellation stops future renewals. The 30-day refund window applies to the most recent renewal charge.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Processing time</h2>
          <p>Approved refunds are typically issued back to the original payment method within 5–10 business days, depending on your bank or card issuer.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Questions</h2>
          <p>For any questions about this policy, contact <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">{CONTACT_EMAIL}</a>.</p>
        </section>
      </article>
    </main>
  );
}
