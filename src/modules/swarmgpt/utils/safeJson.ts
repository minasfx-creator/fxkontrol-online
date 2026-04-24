/**
 * SwarmGPT 2.0 — Lenient JSON extractor for LLM outputs that include
 * markdown fences or surrounding prose. Throws if no parseable object is found.
 */
export function extractJsonObject(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first === -1 || last === -1 || last <= first) {
      throw new Error('No JSON object found in model output.');
    }
    return JSON.parse(text.slice(first, last + 1));
  }
}
