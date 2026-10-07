-- Fecha de inicio, distinta de la de vencimiento.
--
-- No es un token de todo.txt estándar, y no hace falta que lo sea: tuxedo conserva
-- cualquier `clave:valor` que no conozca — por eso funciona el `uid:` — así que
-- `start:2026-11-01` sobrevive a que lo edite tuxedo y a que lo escriba esta app.

alter table task add column if not exists start_date date;

comment on column task.start_date is 'Comienzo de la tarea; en el archivo, start:AAAA-MM-DD';
