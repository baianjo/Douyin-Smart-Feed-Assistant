# Changelog

## Unreleased

## 2.3.1 - 2026-05-06

- Prefer manually maintained model recommendations such as `gemini-3.1-flash-lite-preview` and `glm-4.7-flash` over pure low-cost heuristics.
- Restore richer novice setup guidance and expand in-panel usage instructions with API Key links, model fetching, model selection, and troubleshooting steps.
- Clarify in developer documentation that project docs and UI copy should be freely updated to match real usage and best practices.

## 2.3.0 - 2026-05-06

- Remember the last custom OpenAI-compatible API profile when switching between presets.
- Add a model fetching flow that reads `/models`, fills the model selector, and guides users to test after selecting a model.

## 2.2.0 - 2026-05-05

- Rework API configuration around a custom OpenAI-compatible API Base URL.
- Treat GPT, DeepSeek, Kimi, Qwen, GLM, and Google/Gemini as Base URL presets that only prefill the endpoint and default model.
- Support local OpenAI-compatible Base URLs such as `http://cliproxyapi:8317` and `http://127.0.0.1:8317` with automatic `/v1/chat/completions` completion.
- Keep all model calls on the same OpenAI-compatible request path and common request body.
- Auto-switch to custom mode when the Base URL field is edited away from the selected preset.

## 2.1.2 - 2026-05-05

- Allow reasoning/thinking models by extracting only the final answer and ignoring reasoning side-channel fields.
- Keep provider requests on OpenAI-compatible common parameters by default instead of chasing model-specific thinking controls.
- Hide API key prefixes and redact reasoning fields in debug response logs.
- Update the settings copy to explain the new reasoning-model compatibility behavior.

## 2.1.1 - 2026-05-05

- Publish the engineeringized codebase as a versioned patch release so installed userscript clients can detect and apply the update reliably.
