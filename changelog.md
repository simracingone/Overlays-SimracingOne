# Changelog - iRacing Overlay System

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

---

## [3.3.0] - 2026-02-09

### 🇫🇷 Français
#### Ajouté
- **Denise (Alertes Stratégiques)** : Implémentation d'un système de paliers d'incidents. Pour éviter de polluer la concentration du pilote, Denise ne commente plus chaque 1x, mais intervient désormais sur des seuils critiques (4x, 8x, 12x, 15x) avec des messages de mise en garde progressifs.
- **Vocalisation Dynamique** : Les messages d'incidents sont maintenant contextuels à la gravité et à la proximité de la disqualification.

#### Corrigé
- **SDK iRacing (Python)** : Résolution d'un bug critique où les incidents restaient à 0 en multijoueur. Le système utilise maintenant une double vérification (Télémétrie brute + `DriverInfo`) pour garantir la fiabilité des données.
- **Communication Temps Réel** : Stabilisation du flux de données entre le serveur Python et l'interface JS pour assurer une mise à jour instantanée du compteur d'incidents.

---

### 🇺🇸 English
#### Added
- **Denise (Strategic Alerts)**: Implementation of an incident threshold system. To maintain driver focus, Denise no longer comments on every 1x, but instead intervenes at critical milestones (4x, 8x, 12x, 15x) with progressive warning messages.
- **Dynamic Voice-over**: Incident messages are now contextual based on the severity and proximity to disqualification.

#### Fixed
- **iRacing SDK (Python)**: Fixed a critical bug where incidents stayed at 0 in multiplayer. The system now uses double-checking (Raw Telemetry + `DriverInfo`) to ensure data reliability.
- **Real-time Communication**: Stabilized the data stream between the Python server and the JS interface to ensure instantaneous incident counter updates.

---

## [3.2.1] - 2026-01-29

### 🇫🇷 Français
#### Corrigé
- **HUD Radio** : Le panneau des experts de l'équipe s'affiche désormais correctement à l'écran lorsqu'un message audio est diffusé.
- **Visibilité** : Correction d'un conflit entre l'état de visibilité par défaut (sauvegardé dans le localStorage) et le déclenchement dynamique des messages. Le module force maintenant son apparition lors de la prise de parole.
- **Synchronisation** : Amélioration de la fluidité entre l'API TTS et l'affichage visuel pour éviter que le texte ne disparaisse trop tôt.

---

### 🇺🇸 English
#### Fixed
- **Radio HUD**: The team expert panel now correctly displays on-screen whenever an audio message is broadcasted.
- **Visibility**: Fixed a conflict between the default visibility state (stored in localStorage) and dynamic message triggering. The module now forces itself to be visible during speech.
- **Synchronization**: Improved timing between the TTS API and the visual UI to ensure the text remains visible throughout the audio playback.
