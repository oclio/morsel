# SPEC-MORSEL-ACCESSORS-1.0.0: Dot-Path Store Accessors & Mutations Plugin

| Metadata            | Value                                                              |
| :------------------ | :----------------------------------------------------------------- |
| **Package**         | `@oclio/morsel-accessors`                                          |
| **Author**          | @oclio                                                             |
| **Status**          | `DRAFT`                                                            |
| **Spec version**    | `1.0.0`                                                            |
| **Created**         | 2026-08-22                                                         |
| **Target runtimes** | Node.js >= 18                                                      |
| **Dependencies**    | **0 dependencies** (`node:path` / pure TypeScript algorithms only) |

---

## 1. Vue d'Ensemble & Objectifs

`@oclio/morsel-accessors` est une extension de store pour `@oclio/morsel` fournissant une API ergonomique de manipulation par chemins pointés (_dot-paths_).

Il résout le pain-point classique de manipulation des configurations imbriquées :

```typescript
// Sans accessors : verbeux et risqué
const maxConn = config.database?.pool?.connections?.max ?? 10;

// Avec accessors :
const maxConn = store.get('database.pool.connections.max', 10);
```

---

## 2. Invariants Normatifs

1. **Zero Runtime Dependencies** : 0 paquet externe. Implémentation algorithmique pure en TypeScript.
2. **Protection Anti-Prototype-Pollution** : Tout chemin contenant `__proto__`, `constructor`, ou `prototype` est formellement bloqué et ignoré (ou lève une exception selon le mode configuré).
3. **Tolérance aux chemins inexistants** : `get(path, default)` ne lève jamais d'exception sur un chemin intermédiaire inexistant (`null`/`undefined`), et retourne `defaultValue` (ou `undefined`).
4. **Support hybride Dot & Array Index** : `users[0].name`, `users.0.name`, `servers.primary.hosts[2]` sont tous des chemins valides et résolus de façon identique.
5. **Support des clés avec points échappés** : `app\.config.host` cible la clé littérale `"app.config"` puis `"host"`.
6. **Dual Mode API** :
   - Mode Plugin Store : enrichit l'instance `MorselStore` avec les méthodes d'accès directes.
   - Mode Fonctions Pures : fonctions autonomes exportées (`get(obj, path)`, `set(obj, path, val)`, etc.) utilisables sans instance de store.

---

## 3. Contrat de l'API

### 3.1 Fonctions Pures Exportées

```typescript
export function all<
  T extends Record<string, unknown> = Record<string, unknown>,
>(target: unknown): T;

export function get<T = unknown>(
  target: unknown,
  path: string | (string | number)[],
  defaultValue?: T,
): T;

export function set(
  target: Record<string, unknown>,
  path: string | (string | number)[],
  value: unknown,
): boolean;

export function has(
  target: unknown,
  path: string | (string | number)[],
): boolean;

export function unset(
  target: Record<string, unknown>,
  path: string | (string | number)[],
): boolean;

export function flatten(
  target: Record<string, unknown>,
  separator?: string,
): Record<string, unknown>;

export function unflatten(
  target: Record<string, unknown>,
  separator?: string,
): Record<string, unknown>;
```

### 3.2 Extension du Store Morsel (`accessorsPlugin`)

```typescript
import {
  accessorsPlugin,
  type AccessorStoreExtensions,
} from '@oclio/morsel-accessors';

const store = await loadConfig<AppConfig, AccessorStoreExtensions>({
  name: 'my-app',
  plugins: [accessorsPlugin()],
});

// Méthodes injectées sur le store :
store.all(); // Retourne une copie profonde de tout l'objet config
store.get('database.pool.max', 10); // number
store.set('database.pool.max', 20); // boolean
store.has('database.pool.max'); // true
store.unset('database.pool.idleTimeout'); // boolean
store.flatten(); // { 'database.pool.max': 20, ... }
```

---

## 4. Spécification Détaillée des Méthodes

### 4.1 `get(target, path, defaultValue)`

- **Paramètres** :
  - `target` : L'objet source (`unknown`).
  - `path` : Chaîne de caractères (`"server.port"`, `"items[2].id"`) ou tableau de segments `['server', 'port']`.
  - `defaultValue` : Valeur de secours retournée si le chemin n'existe pas ou résout à `undefined`.
- **Règles de Résolution** :
  - Si `target` est `null` ou `undefined` : retourne `defaultValue`.
  - Si le chemin est vide `""` ou `[]` : retourne `target`.
  - Si la valeur finale résolue est `undefined` : retourne `defaultValue`.
  - Si la valeur finale est `null`, `false`, `0`, ou `""` : retourne cette valeur exacte (ne substitue pas `defaultValue`).

### 4.2 `set(target, path, value)`

- **Paramètres** :
  - `target` : L'objet cible à muter (`Record<string, unknown>`).
  - `path` : Le chemin d'accès.
  - `value` : La valeur à affecter.
- **Règles de Mutation & Création d'Arborescence** :
  - Crée les objets et tableaux intermédiaires s'ils n'existent pas.
  - Si un segment est un entier (`[0]` ou `"0"`), un `Array` est instancié si la structure intermédiaire n'existait pas.
  - **Sécurité** : Si un segment est `"__proto__"`, `"prototype"`, ou `"constructor"`, la fonction refuse la mutation et retourne `false`.
  - Retourne `true` si la mutation a réussi, `false` sinon.

### 4.3 `has(target, path)`

- **Objectif** : Détermine si un chemin est défini sur l'objet cible.
- **Différence avec `get !== undefined`** : `has` retourne `true` même si la valeur de la propriété vaut explicitement `undefined` mais existe comme clé sur l'objet (`Object.prototype.hasOwnProperty`).

### 4.4 `unset(target, path)` (alias `delete`)

- **Objectif** : Supprime la clé ciblée par le chemin pointé.
- **Comportement** :
  - Pour un objet : exécute `delete current[key]`.
  - Pour un tableau : supprime l'élément via `splice(index, 1)` (ou `delete` selon option).
  - Retourne `true` si la clé a été supprimée, `false` si le chemin n'existait pas.

### 4.5 `flatten(target)` & `unflatten(target)`

- **`flatten`** : Convertit un objet profondément imbriqué en un objet 1D avec chemins pointés :

  ```typescript
  flatten({ db: { host: 'localhost', port: 5432 } });
  // -> { 'db.host': 'localhost', 'db.port': 5432 }
  ```

- **`unflatten`** : Opération inverse, reconstruit la structure d'arbre hiérarchique à partir d'un objet aplati.

---

## 5. Algorithme de Tokenization du Chemin (Lexer)

Pour supporter à la fois les points, les crochets d'indexation et les échappements sans regex complexe ni vulnérabilité ReDoS :

```typescript
export function parsePath(path: string): string[] {
  const segments: string[] = [];
  let current = '';
  let inBracket = false;
  let isEscaped = false;

  for (let i = 0; i < path.length; i++) {
    const char = path[i];

    if (isEscaped) {
      current += char;
      isEscaped = false;
      continue;
    }

    if (char === '\\') {
      isEscaped = true;
      continue;
    }

    if (char === '[') {
      if (current.length > 0) {
        segments.push(current);
        current = '';
      }
      inBracket = true;
      continue;
    }

    if (char === ']') {
      if (inBracket) {
        if (current.length > 0) {
          segments.push(current);
          current = '';
        }
        inBracket = false;
        continue;
      }
    }

    if (char === '.' && !inBracket) {
      if (current.length > 0) {
        segments.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current.length > 0) {
    segments.push(current);
  }

  return segments;
}
```

---

## 6. Matrice de Tests Unitaires & E2E Requise

| ID       | Cas de test                                                     | Attendu                                      |
| :------- | :-------------------------------------------------------------- | :------------------------------------------- |
| `ACC-01` | `get` sur clé top-level                                         | Retourne la valeur                           |
| `ACC-02` | `get` sur clé profondément imbriquée (`a.b.c.d`)                | Retourne la valeur                           |
| `ACC-03` | `get` sur index de tableau (`a.b[2].c`)                         | Retourne l'élément à l'index                 |
| `ACC-04` | `get` sur chemin inexistant avec fallback                       | Retourne `defaultValue`                      |
| `ACC-05` | `get` sur chemin inexistant sans fallback                       | Retourne `undefined`                         |
| `ACC-06` | `get` sur valeur falsy (`false`, `0`, `""`, `null`)             | Retourne la valeur, pas le fallback          |
| `ACC-07` | `get` avec point échappé (`a\.b.c`)                             | Segment `"a.b"` puis `"c"`                   |
| `ACC-08` | `set` sur chemin simple et imbriqué                             | Mute l'objet en place                        |
| `ACC-09` | `set` avec auto-création de tableaux                            | Instancie `Array` pour les index numériques  |
| `ACC-10` | `set` tentative d'injection `__proto__`                         | Opération bloquée, `target` intact           |
| `ACC-11` | `set` tentative d'injection `prototype` / `constructor`         | Opération bloquée, `target` intact           |
| `ACC-12` | `has` sur clé existante valant `undefined`                      | Retourne `true`                              |
| `ACC-13` | `unset` supprime la clé ciblée                                  | Clé absente de l'objet                       |
| `ACC-14` | `flatten` & `unflatten` réversibilité                           | `unflatten(flatten(obj)) === deepClone(obj)` |
| `ACC-15` | Intégration `accessorsPlugin` avec `loadConfig` / `watchConfig` | Méthodes disponibles sur l'instance `store`  |

---

## 7. Structure du Package

```text
packages/accessors/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── src/
│   ├── index.ts              # Exports publics + accessorsPlugin
│   ├── parse-path.ts         # Lexer / Tokenizer sécurisé
│   ├── get.ts                # Implémentation get
│   ├── set.ts                # Implémentation set (sécurisée)
│   ├── has.ts                # Implémentation has
│   ├── unset.ts              # Implémentation unset
│   ├── flatten.ts            # Implémentation flatten & unflatten
│   ├── types.ts              # Types TypeScript & génériques
│   ├── __tests__/            # 100% test coverage (unitaires)
│   └── __tests__/            # 100% test coverage (end-to-end)
```
