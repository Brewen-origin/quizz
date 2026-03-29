# 🎮 Backlog — Quiz Multijoueur (Next.js + Supabase)

---

## PHASE 1 — MVP jouable

> Objectif : une partie complète de bout en bout, sans fioritures.

---

### 🗄️ BACKEND / SUPABASE

---

#### [B-01] Schéma base de données initial
**Priorité :** Critique | **Complexité :** M

**Description :** Créer toutes les tables dans Supabase via l'éditeur SQL.

**Sous-tâches :**
- [ ] Créer table `questions` (id, type, question, choices jsonb, answer, difficulty, theme, image)
- [ ] Créer table `games` (id, code, host_id, status, current_question_index, question_count, themes jsonb, question_ids jsonb, paused_at, created_at)
- [ ] Créer table `players` (id, game_id, pseudo, score, is_host, connected, last_seen)
- [ ] Créer table `answers` (id, game_id, player_id, question_id, answer_value, is_correct, points, answered_at)
- [ ] Activer Realtime sur `games`, `players`, `answers`
- [ ] Ajouter index sur `games.code` (unique)

**Critères d'acceptation :**
- Toutes les tables existent dans Supabase
- Realtime est activé sur les 3 tables
- On peut insérer une question manuellement depuis l'interface Supabase

---

#### [B-02] Seed — jeu de questions de test
**Priorité :** Critique | **Complexité :** S

**Description :** Insérer ~20 questions de test dans la table `questions` pour avoir de quoi jouer pendant le dev.

**Sous-tâches :**
- [ ] Créer un fichier `scripts/seed-questions.ts`
- [ ] Insérer 5 QCM, 5 vrai/faux, 5 estimation, 5 réponse libre
- [ ] Varier les thèmes : `culture`, `sport`, `histoire`, `science`
- [ ] Varier les difficultés : 1, 2, 3

**Critères d'acceptation :**
- `SELECT count(*) FROM questions` retourne ≥ 20
- Au moins 1 question de chaque type est présente

---

#### [B-03] API — Créer une partie
**Priorité :** Critique | **Complexité :** M

**Description :** Route API `POST /api/games/create` qui crée une partie et le joueur host.

**Sous-tâches :**
- [ ] Générer un code lobby unique 6 caractères (ex: `PIRATE`)
- [ ] Sélectionner aléatoirement N questions selon les thèmes choisis
- [ ] Stocker les IDs dans `games.question_ids` (ordre aléatoire fixé à la création)
- [ ] Créer le joueur host dans `players`
- [ ] Retourner `{ gameCode, playerId }` → stocker dans `localStorage`

**Critères d'acceptation :**
- Deux appels successifs produisent deux codes différents
- Les questions sont bien filtrées par thème si des thèmes sont fournis
- Le host apparaît dans `players` avec `is_host = true`

---

#### [B-04] API — Rejoindre une partie
**Priorité :** Critique | **Complexité :** S

**Description :** Route API `POST /api/games/join` pour rejoindre via code + pseudo.

**Sous-tâches :**
- [ ] Vérifier que la partie existe et que `status = 'lobby'`
- [ ] Vérifier que le nombre de joueurs < 10
- [ ] Insérer le joueur dans `players`
- [ ] Retourner `{ playerId, gameId }` → stocker dans `localStorage`

**Critères d'acceptation :**
- Erreur si code invalide
- Erreur si partie déjà en cours ou pleine
- Le joueur apparaît dans la liste en temps réel pour tous les autres

---

#### [B-05] API — Soumettre une réponse
**Priorité :** Critique | **Complexité :** M

**Description :** Route `POST /api/games/answer` pour enregistrer la réponse d'un joueur.

**Sous-tâches :**
- [ ] Vérifier que la partie est en cours (`status = 'playing'`)
- [ ] Vérifier que le joueur n'a pas déjà répondu à cette question
- [ ] Calculer `is_correct` selon le type de question
- [ ] Calculer les points : `difficulty * 100` (bonus rapidité optionnel phase 2)
- [ ] Insérer dans `answers`
- [ ] Mettre à jour `players.score`

**Critères d'acceptation :**
- Double-soumission ignorée (idempotent)
- Le score du joueur est bien mis à jour dans `players`
- Fonctionne pour les types qcm, vrai/faux, estimation (tolérance ±10%)

---

#### [B-06] API — Passer à la question suivante (host)
**Priorité :** Critique | **Complexité :** M

**Description :** Route `POST /api/games/next-question` déclenchée par le host.

**Sous-tâches :**
- [ ] Incrémenter `games.current_question_index`
- [ ] Si `current_question_index >= question_count` → `status = 'finished'`
- [ ] Sinon → `status = 'playing'` (au cas où on était en révélation)
- [ ] Mettre à jour `games.question_started_at = now()` (pour le timer)

**Critères d'acceptation :**
- Tous les clients reçoivent la mise à jour via Realtime
- La partie passe en `finished` à la dernière question

---

### 🎨 FRONTEND

---

#### [F-01] Page d'accueil — Authentification + pseudo
**Priorité :** Critique | **Complexité :** S

**Description :** Page `/` avec saisie du mot de passe "piriac" et du pseudo.

**Sous-tâches :**
- [ ] Formulaire : champ mot de passe + champ pseudo
- [ ] Vérification côté client `password === 'piriac'`
- [ ] Stocker `pseudo` dans `localStorage`
- [ ] Rediriger vers `/home` si OK
- [ ] Design mobile-first (Tailwind, plein écran)

**Critères d'acceptation :**
- Impossible d'aller plus loin sans le bon mot de passe
- Le pseudo est conservé entre les sessions

---

#### [F-02] Page home — Créer ou rejoindre une partie
**Priorité :** Critique | **Complexité :** S

**Description :** Page `/home` avec deux actions : créer / rejoindre.

**Sous-tâches :**
- [ ] Bouton "Créer une partie" → ouvre modal de configuration
- [ ] Modal config : nombre de questions (5/10/15/20), sélection thèmes (checkboxes)
- [ ] Bouton "Rejoindre" → input code + appel `POST /api/games/join`
- [ ] Rediriger vers `/lobby/[code]` dans les deux cas

**Critères d'acceptation :**
- La création appelle [B-03] et redirige vers le lobby
- Le rejoindre appelle [B-04] et redirige vers le lobby
- Si `localStorage` contient déjà un `gameCode` actif → proposer de reprendre

---

#### [F-03] Page lobby — Salle d'attente
**Priorité :** Critique | **Complexité :** M

**Description :** Page `/lobby/[code]` — attente avant le lancement.

**Sous-tâches :**
- [ ] Afficher le code lobby en grand (pour le partager)
- [ ] Liste des joueurs en temps réel (abonnement Realtime sur `players`)
- [ ] Le host voit un bouton "Lancer la partie"
- [ ] "Lancer" appelle `PATCH /api/games/[code]` → `status = 'playing'`
- [ ] Tous les clients redirigent vers `/game/[code]` dès que `status = 'playing'`

**Critères d'acceptation :**
- Un nouveau joueur qui rejoint apparaît dans les 2s pour tous
- Seul le host peut lancer
- La redirection est automatique et simultanée

---

#### [F-04] Page jeu — Affichage question
**Priorité :** Critique | **Complexité :** L

**Description :** Page `/game/[code]` — cœur du jeu.

**Sous-tâches :**
- [ ] S'abonner aux changements de `games` via Realtime
- [ ] Récupérer la question courante depuis `games.question_ids[current_question_index]`
- [ ] Afficher selon le type :
  - `qcm` → 4 boutons
  - `true_false` → 2 boutons Vrai/Faux
  - `estimation` → input numérique
  - `free_text` → input texte
  - `image` → image + 4 boutons
  - `petit_bac` → inputs par catégorie
- [ ] Désactiver les boutons après soumission
- [ ] Appeler [B-05] au clic

**Critères d'acceptation :**
- L'UI change automatiquement quand `current_question_index` change
- Les boutons sont désactivés après réponse
- L'image se charge correctement pour le type `image`

---

#### [F-05] Composant Timer
**Priorité :** Critique | **Complexité :** M

**Description :** Timer visuel 15s côté client, synchronisé sur `games.question_started_at`.

**Sous-tâches :**
- [ ] Calculer le temps restant = `15 - (now() - question_started_at)`
- [ ] Barre de progression animée (Tailwind)
- [ ] Couleur qui vire au rouge sous 5s
- [ ] Quand timer = 0 → désactiver les inputs (l'UI attend le host pour passer à la suite)
- [ ] Si le joueur recharge la page → recalculer depuis `question_started_at` (pas recommencer à 15)

**Critères d'acceptation :**
- Deux joueurs voient le même temps restant (±1s)
- Le timer se recalcule correctement après un refresh

---

#### [F-06] Page révélation — Résultat de la question
**Priorité :** Critique | **Complexité :** M

**Description :** Affichage du résultat après que le timer expire ou que le host passe à la suite.

**Sous-tâches :**
- [ ] Afficher la bonne réponse en vert
- [ ] Afficher la réponse du joueur (correcte ✅ ou incorrecte ❌)
- [ ] Afficher les points gagnés
- [ ] Bouton "Question suivante" visible uniquement pour le host
- [ ] Déclenchement automatique via `status = 'revealing'` dans `games`

**Critères d'acceptation :**
- Tous les joueurs voient la révélation en même temps
- Seul le host peut avancer

---

#### [F-07] Composant Leaderboard
**Priorité :** Critique | **Complexité :** S

**Description :** Leaderboard affiché toutes les 5 questions et à la fin.

**Sous-tâches :**
- [ ] Fetch les scores depuis `players` triés par score desc
- [ ] Afficher rang, pseudo, score
- [ ] Mettre en avant le joueur courant
- [ ] Bouton "Continuer" pour le host
- [ ] Trigger : `current_question_index % 5 === 0` → injecter écran leaderboard dans le flow

**Critères d'acceptation :**
- Le leaderboard est identique pour tous les joueurs
- Le joueur courant est mis en évidence
- Le flow reprend normalement après

---

#### [F-08] Page fin de partie
**Priorité :** Haute | **Complexité :** S

**Description :** Écran final quand `status = 'finished'`.

**Sous-tâches :**
- [ ] Afficher le podium (top 3 avec médailles)
- [ ] Afficher le classement complet
- [ ] Bouton "Rejouer" (recréer une partie) visible pour le host
- [ ] Bouton "Retour accueil" pour tous

**Critères d'acceptation :**
- Tous les joueurs arrivent sur cet écran automatiquement
- Le score final correspond bien à la somme des points

---

### ⚡ REALTIME / SYNCHRONISATION

---

#### [R-01] Hook `useGame` — abonnement central
**Priorité :** Critique | **Complexité :** M

**Description :** Hook React qui centralise tous les abonnements Realtime pour une partie.

**Sous-tâches :**
- [ ] `useGame(code)` → retourne `{ game, players, currentQuestion, myPlayer }`
- [ ] Subscribe à `games WHERE code = X`
- [ ] Subscribe à `players WHERE game_id = X`
- [ ] Cleanup propre au unmount (`channel.unsubscribe()`)
- [ ] Gestion d'état local avec `useState` ou Zustand

**Critères d'acceptation :**
- Pas de fuite mémoire (unsubscribe au démontage)
- Les données sont à jour dans les 500ms après un changement

---

#### [R-02] Reconnexion après refresh
**Priorité :** Critique | **Complexité :** M

**Description :** Un joueur qui recharge la page retrouve sa session.

**Sous-tâches :**
- [ ] À l'entrée sur `/game/[code]` → lire `playerId` depuis `localStorage`
- [ ] Si absent → rediriger vers `/home` avec message "session perdue"
- [ ] Si présent → `UPDATE players SET connected = true, last_seen = now()`
- [ ] Récupérer l'état courant de la partie et afficher le bon écran
- [ ] Si la partie est en `revealing` → aller directement à la révélation

**Critères d'acceptation :**
- Un joueur qui refresh revient sur le bon écran en < 3s
- Son score n'est pas perdu
- Il ne peut pas rejouer une question déjà répondue

---

#### [R-03] Détection déconnexion joueur
**Priorité :** Haute | **Complexité :** M

**Description :** Marquer un joueur comme déconnecté s'il quitte.

**Sous-tâches :**
- [ ] Utiliser Supabase Presence sur le channel `game:[code]`
- [ ] Quand un joueur quitte → `UPDATE players SET connected = false`
- [ ] Dans le lobby : afficher "(déconnecté)" à côté du pseudo
- [ ] En jeu : le joueur déconnecté n'est pas attendu pour avancer
- [ ] À la reconnexion → repasser `connected = true`

**Critères d'acceptation :**
- La déconnexion est détectée en < 10s
- La partie peut continuer sans les joueurs déconnectés

---

## PHASE 2 — Gameplay amélioré

---

#### [G-01] Timer côté serveur (autorité serveur)
**Priorité :** Haute | **Complexité :** M

**Description :** Le passage automatique à la question suivante est géré serveur, pas client.

**Sous-tâches :**
- [ ] Quand le host lance une question → stocker `question_started_at = now()` dans `games`
- [ ] Créer une Supabase Edge Function `auto-next-question`
- [ ] La fonction vérifie si `now() - question_started_at > 15s` → appelle [B-06]
- [ ] Appeler cette Edge Function via un cron (Supabase Cron) toutes les 5s
- [ ] Alternative simple : le host déclenche le passage après le timer client (plus simple pour MVP)

**Critères d'acceptation :**
- Si le host perd sa connexion, la partie avance quand même
- Le timer client reste purement cosmétique

---

#### [G-02] Pause / Reprise
**Priorité :** Haute | **Complexité :** S

**Description :** Le host peut mettre la partie en pause.

**Sous-tâches :**
- [ ] Bouton "Pause" sur l'interface host
- [ ] `PATCH games SET status = 'paused', paused_at = now()`
- [ ] Tous les clients affichent un overlay "Partie en pause"
- [ ] Bouton "Reprendre" → `status = 'playing'`, recalculer le temps restant
- [ ] Le timer reprend là où il s'est arrêté (`time_remaining = 15 - (paused_at - question_started_at)`)

**Critères d'acceptation :**
- Le timer est gelé pendant la pause pour tous les joueurs
- À la reprise, le temps restant est correct

---

#### [G-03] Calcul de score avec bonus rapidité
**Priorité :** Moyenne | **Complexité :** S

**Description :** Bonus de points pour les réponses rapides.

**Sous-tâches :**
- [ ] Enregistrer `answer.answered_at`
- [ ] Points = `difficulty * 100 + max(0, (15 - response_time_seconds) * 5)`
- [ ] Afficher les points gagnés sur l'écran de révélation
- [ ] Afficher le temps de réponse

**Critères d'acceptation :**
- Répondre en 1s donne plus de points qu'en 14s
- Score visible immédiatement après révélation

---

#### [G-04] Type de question — Estimation
**Priorité :** Haute | **Complexité :** S

**Description :** Logique de validation pour les questions estimation.

**Sous-tâches :**
- [ ] L'`answer` dans la question est la valeur exacte (ex: 1969)
- [ ] Tolérance : ±10% de la valeur → points pleins ; ±25% → points partiels
- [ ] Afficher sur la révélation : la bonne valeur + le guess de chaque joueur
- [ ] Trier les joueurs par proximité sur l'écran de révélation

**Critères d'acceptation :**
- Un guess exact = points pleins
- Un guess à 5% = points pleins
- Un guess à 20% = points partiels
- Un guess à 50% = 0 point

---

#### [G-05] Type de question — Petit bac
**Priorité :** Moyenne | **Complexité :** L

**Description :** Mode petit bac : lettre aléatoire, plusieurs catégories, validation par vote.

**Sous-tâches :**
- [ ] La question définit les catégories (ex: `choices: ["Prénom", "Ville", "Animal"]`)
- [ ] L'`answer` est la lettre imposée (ou générée aléatoirement au moment du jeu)
- [ ] UI : un input par catégorie
- [ ] À la fin du timer → afficher toutes les réponses de tous les joueurs
- [ ] Vote : chaque joueur vote OK/KO pour chaque réponse des autres
- [ ] Points selon votes positifs reçus

**Critères d'acceptation :**
- Tous voient les réponses de tous en phase de vote
- Un joueur ne peut pas voter pour ses propres réponses
- Les points sont calculés après le vote

---

#### [G-06] Type de question — Réponse libre (validation flexible)
**Priorité :** Moyenne | **Complexité :** S

**Description :** Comparaison souple pour les réponses texte libres.

**Sous-tâches :**
- [ ] Normaliser les réponses : lowercase, trim, retirer accents
- [ ] Comparaison exacte après normalisation
- [ ] Option : distance de Levenshtein ≤ 2 → correct quand même (fautes de frappe)
- [ ] Afficher toutes les réponses lors de la révélation

**Critères d'acceptation :**
- "paris", "Paris", "PARIS" → tous corrects si réponse = "Paris"
- "napoléon" correct si réponse = "napoleon"

---

## PHASE 3 — Robustesse & polish

---

#### [P-01] Interface host dédiée
**Priorité :** Haute | **Complexité :** M

**Description :** Page `/host/[code]` avec les contrôles de la partie.

**Sous-tâches :**
- [ ] Voir la question courante avec la bonne réponse visible
- [ ] Bouton "Question suivante" / "Révéler"
- [ ] Bouton "Pause" / "Reprendre"
- [ ] Liste des joueurs avec leur statut (a répondu ✅ / pas encore ⏳)
- [ ] Indicateur : X/Y joueurs ont répondu

**Critères d'acceptation :**
- Le host peut voir en temps réel combien de joueurs ont répondu
- Il peut forcer le passage avant la fin du timer

---

#### [P-02] Gestion des réponses simultanées (race conditions)
**Priorité :** Haute | **Complexité :** S

**Description :** Éviter les doublons si un joueur soumet deux fois.

**Sous-tâches :**
- [ ] Contrainte UNIQUE sur `(player_id, question_id)` dans la table `answers`
- [ ] Côté API : `INSERT ... ON CONFLICT DO NOTHING`
- [ ] Désactiver le bouton côté client dès le premier appel (pas après la réponse serveur)
- [ ] État optimiste : désactivation immédiate au clic

**Critères d'acceptation :**
- Double-clic rapide → une seule réponse en base
- Pas d'erreur visible pour l'utilisateur

---

#### [P-03] Persistance session — Middleware
**Priorité :** Haute | **Complexité :** S

**Description :** Protéger les routes `/game/*`, `/lobby/*`, `/host/*`.

**Sous-tâches :**
- [ ] Middleware Next.js : si pas de `playerId` dans `localStorage` → redirect `/`
- [ ] Vérifier que le joueur appartient bien à cette partie
- [ ] Si partie `finished` → redirect vers `/home`

**Critères d'acceptation :**
- On ne peut pas accéder à une partie sans s'être authentifié
- Un joueur ne peut pas accéder à la partie d'un autre

---

#### [P-04] Gestion joueur host qui part
**Priorité :** Haute | **Complexité :** M

**Description :** Que se passe-t-il si le host se déconnecte ?

**Sous-tâches :**
- [ ] Détecter déconnexion host via Presence
- [ ] Afficher "Le host est déconnecté, en attente..." aux joueurs
- [ ] Si reconnexion < 60s → reprise normale
- [ ] Si > 60s → promouvoir le joueur suivant comme host (UPDATE players SET is_host = true)

**Critères d'acceptation :**
- La partie n'est pas bloquée indéfiniment si le host part
- Le nouveau host a accès aux contrôles

---

#### [P-05] UI — Polish mobile
**Priorité :** Moyenne | **Complexité :** M

**Description :** S'assurer que tout est parfaitement utilisable sur mobile.

**Sous-tâches :**
- [ ] Empêcher le zoom sur double-tap (meta viewport)
- [ ] Boutons de réponse : min 60px de hauteur, faciles à tapper
- [ ] Pas de scroll horizontal
- [ ] Keyboard handling : les inputs ne cachent pas les boutons
- [ ] Test sur iOS Safari + Android Chrome

**Critères d'acceptation :**
- Utilisable avec un pouce sur un téléphone 5"
- Pas de comportement inattendu au clavier

---

#### [P-06] Nettoyage parties terminées
**Priorité :** Basse | **Complexité :** S

**Description :** Supprimer les vieilles parties automatiquement.

**Sous-tâches :**
- [ ] Supabase Cron : DELETE FROM games WHERE created_at < now() - interval '24h' AND status = 'finished'
- [ ] Cascade sur players et answers

**Critères d'acceptation :**
- La base ne grossit pas indéfiniment
- Les parties actives ne sont pas touchées

---

---

## 🚀 CHECKLIST — ORDRE EXACT DE DEV

```
SEMAINE 1 — Fondations
[ ] B-01  Schéma DB
[ ] B-02  Seed questions
[ ] F-01  Page accueil (password + pseudo)
[ ] F-02  Page home (créer/rejoindre)
[ ] B-03  API créer partie
[ ] B-04  API rejoindre partie
[ ] F-03  Page lobby (realtime liste joueurs)
[ ] R-01  Hook useGame

SEMAINE 2 — Boucle de jeu
[ ] B-05  API soumettre réponse
[ ] B-06  API question suivante
[ ] F-04  Page jeu (affichage question par type)
[ ] F-05  Composant Timer
[ ] F-06  Page révélation
[ ] F-07  Leaderboard
[ ] F-08  Page fin de partie

SEMAINE 3 — Robustesse
[ ] R-02  Reconnexion après refresh
[ ] R-03  Détection déconnexion
[ ] P-02  Race conditions (double réponse)
[ ] P-03  Middleware session
[ ] G-01  Timer côté serveur
[ ] G-02  Pause / Reprise
[ ] P-01  Interface host dédiée

SEMAINE 4 — Gameplay avancé
[ ] G-03  Bonus rapidité
[ ] G-04  Type estimation (tolérance)
[ ] G-06  Réponse libre (Levenshtein)
[ ] G-05  Petit bac
[ ] P-04  Host déconnecté
[ ] P-05  Polish mobile
[ ] P-06  Nettoyage DB
```

---

## ⚡ TICKETS PARALLÉLISABLES

Ces tickets peuvent être faits en même temps par deux personnes (ou deux branches) :

| Groupe A | Groupe B |
|---|---|
| B-01, B-02, B-03, B-04 | F-01, F-02 (pas besoin de l'API pour builder l'UI) |
| F-04 (UI question) | B-05 (API réponse) |
| F-05 (Timer composant) | F-06 (révélation UI) |
| G-04 (estimation logic) | G-06 (free text logic) |
| P-01 (host UI) | P-05 (polish mobile) |

---

## 📊 Résumé

| Phase | Tickets | Complexité totale |
|---|---|---|
| Phase 1 MVP | 14 tickets | ~30-40h |
| Phase 2 Gameplay | 6 tickets | ~15-20h |
| Phase 3 Robustesse | 6 tickets | ~10-15h |
| **Total** | **26 tickets** | **~55-75h** |
