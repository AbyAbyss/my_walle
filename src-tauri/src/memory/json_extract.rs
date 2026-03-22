//! Extract the first top-level `{ ... }` from model output (same idea as `actionParser.ts`).

/// Returns the substring containing the first balanced JSON object, or `None`.
pub fn extract_json_object(raw: &str) -> Option<String> {
    let clean = raw.replace("```json", "").replace("```", "");
    let start = clean.find('{')?;
    let bytes = clean.as_bytes();
    let mut depth = 0i32;
    let mut in_string = false;
    let mut escape = false;
    for (i, &c) in bytes.iter().enumerate().skip(start) {
        let ch = c as char;
        if escape {
            escape = false;
            continue;
        }
        if ch == '\\' && in_string {
            escape = true;
            continue;
        }
        if ch == '"' {
            in_string = !in_string;
            continue;
        }
        if !in_string {
            if ch == '{' {
                depth += 1;
            } else if ch == '}' {
                depth -= 1;
                if depth == 0 {
                    return Some(clean[start..=i].to_string());
                }
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_object_with_prefix() {
        let s = r#"Here: {"message":"hi","memories":[]}"#;
        assert_eq!(
            extract_json_object(s).as_deref(),
            Some(r#"{"message":"hi","memories":[]}"#)
        );
    }
}
