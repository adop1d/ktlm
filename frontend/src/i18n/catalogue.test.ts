import { describe, expect, it } from 'vitest';
import { CATALOGUE } from './catalogue';
import { format, t } from './index';

/**
 * The catalogue is the one place where a string that used to be hardcoded now has to exist
 * twice, so these check the three ways that can go wrong: a copy that drifted from the
 * source, a translation missing, and a placeholder that only one side has.
 */
describe('catálogo', () => {
  const claves = Object.keys(CATALOGUE);

  it('tiene entradas', () => {
    expect(claves.length).toBeGreaterThan(100);
  });

  it('ninguna entrada está vacía en los dos idiomas', () => {
    const vacias = claves.filter((clave) => {
      const entrada = CATALOGUE[clave as keyof typeof CATALOGUE];
      return !entrada.es.trim() || !entrada.en.trim();
    });
    expect(vacias).toEqual([]);
  });

  it('cada entrada tiene los mismos marcadores que la española', () => {
    // A placeholder that only exists on one side silently drops a value: "{name}" in Spanish
    // and "name" in English reads as the literal text where the name should be.
    const marcadores = (texto: string) =>
      [...texto.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

    const distintos = claves.filter((clave) => {
      const entrada = CATALOGUE[clave as keyof typeof CATALOGUE];
      return marcadores(entrada.es).join(',') !== marcadores(entrada.en).join(',');
    });
    expect(distintos).toEqual([]);
  });

  it('cada entrada conserva las mismas etiquetas HTML', () => {
    const etiquetas = (texto: string) =>
      [...texto.matchAll(/<(\/?[a-zA-Z]+)/g)].map((m) => m[1]).sort();

    const distintos = claves.filter((clave) => {
      const entrada = CATALOGUE[clave as keyof typeof CATALOGUE];
      return etiquetas(entrada.es).join(',') !== etiquetas(entrada.en).join(',');
    });
    expect(distintos).toEqual([]);
  });

  it('las claves son únicos y con puntos', () => {
    // An object literal already rejects duplicates, so this checks the shape instead: a key
    // that is a Spanish sentence would be a sign the copy went in verbatim.
    const sinPuntos = claves.filter((clave) => !clave.includes('.'));
    expect(sinPuntos).toEqual([]);
  });
});

describe('translate', () => {
  const catalogo = {
    'a.b': { es: 'Hola', en: 'Hello' },
    'con.valor': { es: 'Tienes {n} tareas', en: 'You have {n} tasks' },
  };

  it('devuelve el idioma pedido', () => {
    expect(t(catalogo, 'es', 'a.b')).toBe('Hola');
    expect(t(catalogo, 'en', 'a.b')).toBe('Hello');
  });

  it('una clave que no existe devuelve la clave, no undefined', () => {
    // Returning the key makes the gap visible on screen, which is what a missing translation
    // is. Returning undefined would render an empty box and look like a layout bug.
    expect(t(catalogo, 'en', 'no.existe')).toBe('no.existe');
  });

  it('sustituye los marcadores', () => {
    expect(format('Tienes {n} tareas', { n: 3 })).toBe('Tienes 3 tareas');
  });

  it('deja intacto un marcador sin valor', () => {
    // Silently dropping it would hide the omission; leaving it makes the caller see which
    // value it forgot to pass.
    expect(format('Tienes {n} tareas', {})).toBe('Tienes {n} tareas');
  });
});