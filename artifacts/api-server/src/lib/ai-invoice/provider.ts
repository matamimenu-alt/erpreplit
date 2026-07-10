import type { InvoiceProvider } from "./types";
import { AnthropicInvoiceProvider } from "./anthropic-provider";
import { MockInvoiceProvider } from "./mock-provider";

/**
 * Resolve the active extraction provider. This is the single seam future AI
 * providers plug into — add a case here and the rest of the system is unchanged.
 *
 *   provider = "anthropic" → force Claude (requires ANTHROPIC_API_KEY)
 *   provider = "mock"      → force the offline sample provider
 *   provider = "auto"      → Claude when a key is configured, else mock
 */
export function getInvoiceProvider(provider: string): InvoiceProvider {
  const hasKey = !!process.env.ANTHROPIC_API_KEY;
  switch (provider) {
    case "anthropic":
      return new AnthropicInvoiceProvider();
    case "mock":
      return new MockInvoiceProvider();
    case "auto":
    default:
      return hasKey ? new AnthropicInvoiceProvider() : new MockInvoiceProvider();
  }
}
