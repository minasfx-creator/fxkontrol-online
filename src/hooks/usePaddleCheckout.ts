/**
 * usePaddleCheckout — Opens Paddle's overlay checkout for a given price ID.
 *
 * Pass the human-readable price ID (e.g. "pro_monthly"); the hook resolves it
 * to the Paddle internal ID at click time, so the same code works in sandbox + live.
 *
 * `customData.userId` is forwarded so the webhook handler can attribute the
 * subscription to the right user.
 */
import { useState } from "react";
import { initializePaddle, getPaddlePriceId } from "@/lib/paddle";

export interface OpenCheckoutOptions {
  priceId: string;
  quantity?: number;
  customerEmail?: string;
  userId?: string;
  successUrl?: string;
}

export function usePaddleCheckout() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const openCheckout = async (options: OpenCheckoutOptions) => {
    setLoading(true);
    setError(null);
    try {
      await initializePaddle();
      const paddlePriceId = await getPaddlePriceId(options.priceId);

      window.Paddle.Checkout.open({
        items: [{ priceId: paddlePriceId, quantity: options.quantity ?? 1 }],
        customer: options.customerEmail ? { email: options.customerEmail } : undefined,
        customData: options.userId ? { userId: options.userId } : undefined,
        settings: {
          displayMode: "overlay",
          successUrl: options.successUrl || `${window.location.origin}/checkout/success`,
          allowLogout: false,
          variant: "one-page",
        },
      });
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { openCheckout, loading, error };
}
