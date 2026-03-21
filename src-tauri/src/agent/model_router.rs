use crate::agent::adapters::LLMConfig;

const COMPLEX_LENGTH_THRESHOLD: usize = 120;
const COMPLEX_PATTERNS: [&str; 14] = [
    "explain",
    "analyse",
    "analyze",
    "summarize",
    "write",
    "create",
    "plan",
    "design",
    "compare",
    "workflow",
    "sequence",
    "multiple",
    "steps",
    "tell me about",
];

pub fn select_model(user_message: &str, config: &LLMConfig) -> String {
    let default_model = config.default_model_name().to_string();
    if !config.smart_routing_enabled() {
        return default_model;
    }

    let lower = user_message.to_ascii_lowercase();
    let has_pattern = COMPLEX_PATTERNS
        .iter()
        .any(|pattern| lower.contains(pattern))
        || lower.contains("first") && lower.contains("then")
        || lower.contains("how does")
        || lower.contains("what is")
        || lower.contains("before")
        || lower.contains("after")
        || lower.contains("why");

    let is_complex = user_message.chars().count() > COMPLEX_LENGTH_THRESHOLD || has_pattern;
    let model = if is_complex {
        config.complex_model_name().to_string()
    } else {
        default_model
    };

    if cfg!(debug_assertions) {
        println!(
            "[WALLE] Model routing: \"{}\" for: \"{}\"",
            model,
            user_message.chars().take(50).collect::<String>()
        );
    }

    model
}
