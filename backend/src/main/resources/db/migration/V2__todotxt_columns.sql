-- Campos de interoperabilidad con todo.txt (tuxedo).
-- uid es la identidad estable para el round-trip archivo <-> base de datos.

alter table task add column if not exists completed_at timestamp(6);
alter table task add column if not exists recurrence    varchar(50);
alter table task add column if not exists threshold     varchar(50);
alter table task add column if not exists todo_uid      varchar(64);
alter table task add column if not exists extras         text;

create table if not exists task_project (
    task_id bigint      not null,
    project varchar(255),
    constraint fk_task_project_task foreign key (task_id) references task (id) on delete cascade
);

create table if not exists task_context (
    task_id bigint      not null,
    context varchar(255),
    constraint fk_task_context_task foreign key (task_id) references task (id) on delete cascade
);

-- Scope de usuario: hoy se filtra por user_id en cada consulta.
create index if not exists idx_task_user_id on task (user_id);

-- El uid solo es único dentro de una cuenta.
create unique index if not exists uk_task_todo_uid on task (todo_uid) where todo_uid is not null;