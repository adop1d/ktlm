-- Notas: el texto largo que va detrás de una tarea.
--
-- En el archivo es `note:...`. Antes vivía dentro de `extras`, que ya lo conservaba al
-- reescribir, pero desde ahí no se puede editar: una nota no es un campo más, es lo que
-- la gente escribe en `o` y abre en `O`.

alter table task add column if not exists note text;

comment on column task.note is 'Cuerpo largo de la tarea; en el archivo, note:...';