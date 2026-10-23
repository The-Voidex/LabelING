from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.db import get_session
from app.errors import AppError
from app.models import ModelConfig, Project, utcnow
from app.providers.base import ModelConfigSpec, ProviderError, normalize_params
from app.providers.discovery import rank_models
from app.providers.registry import get_provider
from app.schemas import (
    ModelConfigCreate,
    ModelConfigRead,
    ModelConfigTestDraft,
    ModelConfigUpdate,
    ModelDiscoveryRequest,
    ModelDiscoveryResult,
    ProviderTestResult,
)

router = APIRouter(prefix="/model-configs", tags=["model-configs"])


def _mask_key(key: str) -> str:
    if not key:
        return ""
    if len(key) <= 8:
        return "****"
    return f"{key[:3]}****{key[-4:]}"


def _to_read(config: ModelConfig) -> ModelConfigRead:
    return ModelConfigRead(
        id=config.id,
        name=config.name,
        provider_type=config.provider_type,
        base_url=config.base_url,
        api_key_masked=_mask_key(config.api_key),
        has_api_key=bool(config.api_key),
        model_name=config.model_name,
        params=config.params or {},
        is_default=config.is_default,
        created_at=config.created_at,
        updated_at=config.updated_at,
    )


def _validate_provider(provider_type: str, base_url: str, model_name: str) -> None:
    if provider_type not in {"openai_compat", "mock"}:
        raise AppError("接口类型只能是 OpenAI 兼容或模拟", code="invalid_provider_type")
    if provider_type == "openai_compat":
        if not base_url.strip():
            raise AppError("OpenAI 兼容接口需要填写接口地址", code="missing_base_url")
        if not model_name.strip():
            raise AppError("OpenAI 兼容接口需要填写模型名称", code="missing_model_name")


def _get_config(session: Session, config_id: int) -> ModelConfig:
    config = session.get(ModelConfig, config_id)
    if config is None:
        raise AppError("模型配置不存在", status_code=404, code="model_config_not_found")
    return config


def _spec_from(config: ModelConfig, api_key: str | None = None) -> ModelConfigSpec:
    return ModelConfigSpec(
        provider_type=config.provider_type,
        base_url=config.base_url,
        api_key=config.api_key if api_key is None else api_key,
        model_name=config.model_name,
        params=normalize_params(config.params),
    )


def _clear_other_defaults(session: Session, keep_id: int | None) -> None:
    for item in session.exec(select(ModelConfig).where(ModelConfig.is_default == True)).all():  # noqa: E712
        if item.id != keep_id:
            item.is_default = False
            session.add(item)


@router.get("", response_model=list[ModelConfigRead])
def list_configs(session: Session = Depends(get_session)) -> list[ModelConfigRead]:
    configs = session.exec(select(ModelConfig).order_by(ModelConfig.id)).all()
    return [_to_read(item) for item in configs]


@router.post("", response_model=ModelConfigRead, status_code=201)
def create_config(
    payload: ModelConfigCreate, session: Session = Depends(get_session)
) -> ModelConfigRead:
    _validate_provider(payload.provider_type, payload.base_url, payload.model_name)
    config = ModelConfig(
        name=payload.name.strip(),
        provider_type=payload.provider_type,
        base_url=payload.base_url.strip(),
        api_key=payload.api_key.strip(),
        model_name=payload.model_name.strip(),
        params=normalize_params(payload.params),
        is_default=payload.is_default,
    )
    session.add(config)
    session.flush()
    if config.is_default:
        _clear_other_defaults(session, config.id)
    session.commit()
    session.refresh(config)
    return _to_read(config)


@router.patch("/{config_id}", response_model=ModelConfigRead)
def update_config(
    config_id: int, payload: ModelConfigUpdate, session: Session = Depends(get_session)
) -> ModelConfigRead:
    config = _get_config(session, config_id)
    data = payload.model_dump(exclude_unset=True)
    provider_type = data.get("provider_type", config.provider_type)
    base_url = data.get("base_url", config.base_url)
    model_name = data.get("model_name", config.model_name)
    _validate_provider(provider_type, base_url, model_name)
    if "name" in data and data["name"] is not None:
        config.name = data["name"].strip()
    config.provider_type = provider_type
    config.base_url = (base_url or "").strip()
    config.model_name = (model_name or "").strip()
    if "api_key" in data and data["api_key"]:
        config.api_key = data["api_key"].strip()
    if "params" in data and data["params"] is not None:
        config.params = normalize_params(data["params"])
    if "is_default" in data and data["is_default"] is not None:
        config.is_default = bool(data["is_default"])
        if config.is_default:
            _clear_other_defaults(session, config.id)
    config.updated_at = utcnow()
    session.add(config)
    session.commit()
    session.refresh(config)
    return _to_read(config)


@router.delete("/{config_id}", status_code=204)
def delete_config(config_id: int, session: Session = Depends(get_session)) -> None:
    config = _get_config(session, config_id)
    in_use = session.exec(
        select(Project).where(Project.model_config_id == config_id)
    ).first()
    if in_use is not None:
        raise AppError(
            f"该模型配置正被项目「{in_use.name}」使用，请先在项目设置中更换模型",
            status_code=409,
            code="model_config_in_use",
        )
    session.delete(config)
    session.commit()
    return None


@router.post("/{config_id}/test", response_model=ProviderTestResult)
async def test_config(config_id: int, session: Session = Depends(get_session)) -> ProviderTestResult:
    config = _get_config(session, config_id)
    provider = get_provider(config.provider_type)
    result = await provider.test(_spec_from(config))
    return ProviderTestResult(**result.__dict__)


@router.post("/test-draft", response_model=ProviderTestResult)
async def test_draft(
    payload: ModelConfigTestDraft, session: Session = Depends(get_session)
) -> ProviderTestResult:
    saved = _get_config(session, payload.config_id) if payload.config_id else None
    base_url = payload.base_url.strip() or (saved.base_url if saved else "")
    model_name = payload.model_name.strip() or (saved.model_name if saved else "")
    api_key = payload.api_key.strip() or (saved.api_key if saved else "")
    _validate_provider(payload.provider_type, base_url, model_name)
    provider = get_provider(payload.provider_type)
    spec = ModelConfigSpec(
        provider_type=payload.provider_type,
        base_url=base_url,
        api_key=api_key,
        model_name=model_name,
        params=normalize_params(payload.params),
    )
    result = await provider.test(spec)
    return ProviderTestResult(**result.__dict__)


@router.post("/discover-models", response_model=ModelDiscoveryResult)
async def discover_models(
    payload: ModelDiscoveryRequest, session: Session = Depends(get_session)
) -> ModelDiscoveryResult:
    saved = _get_config(session, payload.config_id) if payload.config_id else None
    base_url = payload.base_url.strip() or (saved.base_url if saved else "")
    api_key = payload.api_key.strip() or (saved.api_key if saved else "")
    if payload.provider_type != "mock" and not base_url:
        raise AppError("请填写接口地址", code="missing_base_url")

    provider = get_provider(payload.provider_type)
    spec = ModelConfigSpec(
        provider_type=payload.provider_type,
        base_url=base_url,
        api_key=api_key,
        model_name=(payload.default_model or "").strip(),
        params=normalize_params({}),
    )
    try:
        models = await provider.list_models(spec)
    except ProviderError as exc:
        raise AppError(exc.message, status_code=400, code=exc.kind, details=exc.raw[:500]) from exc

    ordered, recommended = rank_models(models, payload.default_model)
    return ModelDiscoveryResult(
        models=ordered,
        recommended=recommended,
        count=len(ordered),
    )
