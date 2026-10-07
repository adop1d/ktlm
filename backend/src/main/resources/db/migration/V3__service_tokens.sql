-- Tokens de servicio para automatizaciones y servidores MCP.
--
-- Uno por usuario y por herramienta, no uno global: un token global tendría que recibir el
-- id de usuario por otra parte, y eso es exactamente el agujero por el que un token de
-- servicio acabaría leyendo las tareas de cualquiera.

create table if not exists service_token (
    id           uuid primary key default gen_random_uuid(),
    user_id      bigint       not null,
    label        varchar(120) not null,
    -- Solo el hash: el token en claro se devuelve una vez, al crearlo, y no se guarda.
    token_hash   varchar(255) not null,
    created_at   timestamp(6) not null default now(),
    last_used_at timestamp(6),
    revoked_at   timestamp(6),
    constraint fk_service_token_user foreign key (user_id) references app_user (id) on delete cascade
);

-- Buscar por hash es lo único que se hace en cada petición.
create index if not exists idx_service_token_hash on service_token (token_hash);

-- Un token vivo por usuario y etiqueta.
create unique index if not exists uk_service_token_live
    on service_token (user_id, label)
    where revoked_at is null;