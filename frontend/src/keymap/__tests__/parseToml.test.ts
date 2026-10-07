import { describe, expect, it } from 'vitest';
import { parseKeybindsToml } from '../parseToml';

describe('parseKeybindsToml', () => {
  it('lee un valor simple y uno con alternativas', () => {
    const parsed = parseKeybindsToml(`
[normal]
begin_add = "n"
open_command_palette = [":", "Ctrl-P"]
`);

    expect(parsed.normal?.begin_add).toEqual(['n']);
    expect(parsed.normal?.open_command_palette).toEqual([':', 'Ctrl-P']);
  });

  it('ignora comentarios y espacios', () => {
    const parsed = parseKeybindsToml(`
# esto es un comentario
[normal]
   toggle_complete   =   "x"   # y uno al final
`);

    expect(parsed.normal?.toggle_complete).toEqual(['x']);
  });

  it('ignora secciones desconocidas', () => {
    const parsed = parseKeybindsToml(`
[otra_seccion]
begin_add = "Z"
[normal]
begin_add = "n"
`);

    expect(Object.keys(parsed)).toEqual(['normal']);
    expect(parsed.normal?.begin_add).toEqual(['n']);
  });

  it('ignora claves desconocidas sin soltar las conocidas', () => {
    const parsed = parseKeybindsToml(`
[normal]
tecla_inventada = "z"
begin_add = "n"
`);

    expect(parsed.normal?.tecla_inventada).toBeUndefined();
    expect(parsed.normal?.begin_add).toEqual(['n']);
  });

  it('salta una linea malformada sin tirar el archivo entero', () => {
    // Tuxedo hot-reloads and, if parsing fails mid-write, keeps the previous config. Losing
    // the whole file over a typo would be worse.
    const parsed = parseKeybindsToml(`
[normal]
esto no es una asignacion
begin_add = "n"
= "sin clave"
toggle_complete = "x"
`);

    expect(parsed.normal?.begin_add).toEqual(['n']);
    expect(parsed.normal?.toggle_complete).toEqual(['x']);
  });

  it('trata "+" como tecla y no como separador de modificador', () => {
    // This is the real case: tuxedo's parser splits on "+", so it cannot write this line. We
    // still have to read it.
    const parsed = parseKeybindsToml(`
[normal]
begin_prompt_project = "+"
`);

    expect(parsed.normal?.begin_prompt_project).toEqual(['+']);
  });

  it('acepta una lista vacia como desvinculacion', () => {
    const parsed = parseKeybindsToml(`
[normal]
cycle_theme = []
`);

    expect(parsed.normal?.cycle_theme).toEqual([]);
  });

  it('lee la seccion de recurrencia', () => {
    const parsed = parseKeybindsToml(`
[recurrence]
focus_next = ["j", "Down", "Tab"]
accept = "Enter"
`);

    expect(parsed.recurrence?.focus_next).toEqual(['j', 'Down', 'Tab']);
    expect(parsed.recurrence?.accept).toEqual(['Enter']);
  });

  it('no inventa secciones que no aparecen', () => {
    const parsed = parseKeybindsToml('[normal]\nbegin_add = "n"\n');

    expect(parsed.recurrence).toBeUndefined();
  });

  it('tolera CRLF y un archivo vacio', () => {
    expect(parseKeybindsToml('')).toEqual({});
    expect(parseKeybindsToml('[normal]\r\nbegin_add = "n"\r\n').normal?.begin_add).toEqual(['n']);
  });

  it('no confunde un # entrecomillado con un comentario', () => {
    const parsed = parseKeybindsToml(`
[normal]
open_share = "#etiqueta"
`);

    expect(parsed.normal?.open_share).toEqual(['#etiqueta']);
  });
});