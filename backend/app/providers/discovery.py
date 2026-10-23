from __future__ import annotations

VISION_HINTS = ("vision", "-vl", "vl-", "vlm", "multimodal", "omni", "4v")
KNOWN_VISION_MODELS = {"deepseek-flash"}


def _vision_score(model: str) -> int:
    lowered = model.lower()
    score = 0
    for hint in VISION_HINTS:
        if hint in lowered:
            score += 5
    if lowered in KNOWN_VISION_MODELS:
        score += 10
    if "flash" in lowered:
        score += 1
    return score


def rank_models(
    models: list[str], default_model: str | None = None
) -> tuple[list[str], str | None]:
    unique = sorted({model.strip() for model in models if model and model.strip()})
    if not unique:
        return [], None

    default = (default_model or "").strip()
    if default and default in unique:
        recommended = default
    else:
        ranked = sorted(unique, key=lambda model: (-_vision_score(model), model))
        recommended = ranked[0]

    ordered = [recommended] + [model for model in unique if model != recommended]
    return ordered, recommended
