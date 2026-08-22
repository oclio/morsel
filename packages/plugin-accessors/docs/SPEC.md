# SPEC-MORSEL-ACCESSORS-1.0.0 : Plugin d'Accessors par Chemins Pointés

| Metadata            | Value                     |
| :------------------ | :------------------------ |
| **Package**         | `@oclio/morsel-accessors` |
| **Author**          | @oclio                    |
| **Status**          | `DRAFT`                   |
| **Spec version**    | `1.0.0`                   |
| **Created**         | 2026-08-22                |
| **Target runtimes** | Node.js >= 18             |
| **Dependencies**    | 0                         |

---

## 1. Vue d'Ensemble & Objectifs

`@oclio/morsel-accessors` est un wrapper de store pour `@oclio/morsel` fournissant une API ergonomique de manipulation par chemins pointés (_dot-paths_).

Il résout le pain-point classique de manipulation des configurations imbriquées :

```typescript
// Sans accessors : verbeux et risqué
config.database.pool.connections.max = 20; // mute en mémoire, pas persisté

// Avec accessors :
await store.set('database.pool.connections.max', 20); // persisté dans le fichier source
```

Les mutations (`set`, `unset`) utilisent un **modèle transactionnel** : elles délèguent au core l'écriture dans le fichier source. La config reste frozen, le core gère la persistence et le re-merge via `fs.watch`.

---

## 2. Invariants Normatifs

1. **Zero Runtime Dependencies** : 0 paquet externe. Implémentation algorithmique pure en TypeScript.
2. **Protection Anti-Prototype-Pollution** : Tout chemin contenant `__proto__`, `constructor`, ou `prototype` est formellement bloqué.
3. **Tolérance aux chemins inexistants** : `get(path, default)` ne lève jamais d'exception sur un chemin intermédiaire inexistant (`null`/`undefined`), et retourne `defaultValue` (ou `undefined`).
4. **Support hybride Dot & Array Index** : `users[0].name`, `users.0.name`, `servers.primary.hosts[2]` sont tous des chemins valides et résolus de façon identique.
5. **Support des clés avec points échappés** : `app\.config.host` cible la clé littérale `"app.config"` puis `"host"`.
6. **API Wrapper-Only** : Le plugin exporte une seule fonction `withAccessors(store)` qui étend une instance `MorselStore` avec les méthodes d'access. Pas de fonctions pures exportées — les accessors n'ont de sens que sur un store.
7. **Modèle Transactionnel** : `set` et `unset` ne mutent pas la config en mémoire. Ils délèguent au core qui effectue un read-modify-write sur le fichier source. La config reste frozen. La mise à jour de la config en mémoire se fait via le cycle naturel `fs.watch` → re-merge → events.
8. **Config Toujours Frozen** : Aucune mutation en mémoire. `configMutability: 'mutable'` n'est pas requis. La config du core reste immuable à tout moment.

---

## 3. Contrat de l'API

### 3.1 `withAccessors(store)`

Le plugin utilise un pattern wrapper — aucune modification de l'interface publique `MorselStore` du core n'est nécessaire.

```typescript
import { watchConfig } from '@oclio/morsel';
import { withAccessors } from '@oclio/morsel-accessors';

const store = withAccessors(
  await watchConfig({
    name: 'my-app',
    defaults: { database: { pool: { max: 10 } } },
  }),
);

// Méthodes natives de MorselStore toujours disponibles :
store.on('database.pool.max', (next, prev) => {});
await store.stop();

// Méthodes d'accessors ajoutées par le wrapper :
store.all(); // copie profonde de toute la config
store.get('database.pool.max', 10); // number
await store.set('database.pool.max', 20); // Promise<boolean>
store.has('database.pool.max'); // true
await store.unset('database.pool.idleTimeout'); // Promise<boolean>
store.flatten(); // { 'database.pool.max': 20, ... }
```

### 3.2 Types TypeScript

```typescript
export type StoreTarget = 'closest' | 'global' | 'project' | 'local';

export interface SetOptions {
  target?: StoreTarget;
}

export interface AccessorStore<T = Record<string, unknown>> {
  readonly config: T;
  readonly layers: readonly MorselLayer[];
  on(keyPath: string, listener: Listener): () => void;
  stop(): Promise<void>;

  all(): T;
  get<P = unknown>(path: string | (string | number)[], defaultValue?: P): P;
  set(
    path: string | (string | number)[],
    value: unknown,
    options?: SetOptions,
  ): Promise<boolean>;
  has(path: string | (string | number)[]): boolean;
  unset(
    path: string | (string | number)[],
    options?: SetOptions,
  ): Promise<boolean>;
  flatten(): Record<string, unknown>;
}

export function withAccessors<S extends MorselStore>(
  store: S,
): S & AccessorStore<S['config']>;
```

### 3.3 Modèle Transactionnel

```text
store.set('db.port', 5432)
  │
  ▼
ACCESSOR valide le path (prototype pollution, format)
  │
  ▼
CORE _applyOptimistic(path, value)
  → config frozen mise à jour immédiatement
  → get/has/all reflètent la nouvelle valeur sans latence
  │
  ▼
CORE resolveKeyOrigin → writeConfig (read-modify-write sur le fichier source)
  │
  ├─ succès → return true
  │           fs.watch fire plus tard → re-merge = no-op (déjà à jour)
  │
  └─ échec → _remerge() (rollback depuis les fichiers)
             → config revient à l'état d'origine
             → return false
```

- `set` et `unset` sont **async** (I/O fichier).
- **Update optimiste** : la config en mémoire est mise à jour avant l'écriture du fichier. `get` est à jour immédiatement.
- Si l'écriture échoue, rollback via re-merge depuis les fichiers.
- Les events `store.on` firent après l'update optimiste.
- Pas de race condition : le core sérialise les écritures sur un même fichier.

---

## 4. Spécification Détaillée des Méthodes

### 4.1 `store.get(path, defaultValue)`

- **Paramètres** :
  - `path` : Chaîne de caractères (`"server.port"`, `"items[2].id"`) ou tableau de segments `['server', 'port']`.
  - `defaultValue` : Valeur de secours retournée si le chemin n'existe pas ou résout à `undefined`.
- **Règles de Résolution** :
  - Si le chemin est vide `""` ou `[]` : retourne `store.config`.
  - Si la valeur finale résolue est `undefined` : retourne `defaultValue`.
  - Si la valeur finale est `null`, `false`, `0`, ou `""` : retourne cette valeur exacte (ne substitue pas `defaultValue`).
- **Sync** : lecture directe sur `store.config` (frozen).

### 4.2 `store.set(path, value, options?)`

- **Paramètres** :
  - `path` : Le chemin d'accès.
  - `value` : La valeur à affecter.
  - `options.target` : Cible du fichier source (`'closest'` par défaut, `'global'`, `'project'`, `'local'`).
- **Comportement** :
  - Valide le path (prototype pollution → retourne `false`).
  - Délègue au core : `mutateKey(path, value, target)`.
  - Le core effectue un read-modify-write sur le fichier source ciblé.
  - Crée les objets et tableaux intermédiaires s'ils n'existent pas dans le fichier.
  - Si un segment est un entier (`[0]` ou `"0"`), un `Array` est instancié si la structure intermédiaire n'existait pas.
  - Retourne `true` si l'écriture a réussi, `false` sinon.
- **Async** : `Promise<boolean>`.

### 4.3 `store.has(path)`

- **Objectif** : Détermine si un chemin est défini sur l'objet de config.
- **Différence avec `get !== undefined`** : `has` retourne `true` même si la valeur de la propriété vaut explicitement `undefined` mais existe comme clé sur l'objet (`Object.prototype.hasOwnProperty`).
- **Sync** : lecture directe sur `store.config` (frozen).

### 4.4 `store.unset(path, options?)`

- **Paramètres** :
  - `path` : Le chemin d'accès.
  - `options.target` : Cible du fichier source (`'closest'` par défaut).
- **Comportement** :
  - Valide le path (prototype pollution → retourne `false`).
  - Délègue au core : `mutateKey(path, undefined, target, { delete: true })`.
  - Le core effectue un read-modify-write sur le fichier source ciblé.
  - Pour un objet : supprime la clé du fichier.
  - Pour un tableau : supprime l'élément via `splice(index, 1)`.
  - Retourne `true` si la suppression a réussi, `false` si le chemin n'existait pas.
- **Async** : `Promise<boolean>`.

### 4.5 `store.all()`

- **Objectif** : Retourne une copie profonde de toute la config.
- **DX** : Prête à l'emploi sans que l'utilisateur ait à connaître `structuredClone`.
- **Sync** : `structuredClone(store.config)`.

### 4.6 `store.flatten()`

- **Objectif** : Convertit la config profondément imbriquée en un objet 1D avec chemins pointés (séparateur `.`) :

  ```typescript
  store.flatten();
  // { 'database.pool.max': 20, 'database.pool.idleTimeout': 5000, ... }
  ```

- **Sync** : lecture directe sur `store.config` (frozen).

---

## 5. Historique des Révisions

- **1.0.0** (2026-08-22) : Draft initial. API wrapper-only, modèle transactionnel, config frozen, pas de fonctions pures exportées.
